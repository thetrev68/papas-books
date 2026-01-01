import { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/config';
import { User, Bookset } from '../types/database';
import { AUTH_TIMEOUT_MS, AUTH_RETRY_DELAY_MS } from '../lib/constants';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../lib/sentry';

type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  status: AuthStatus;
  supabaseUser: SupabaseUser | null;
  user: User | null;
  activeBookset: Bookset | null;
  myBooksets: Bookset[];
  error: Error | null;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchBookset: (booksetId: string) => Promise<void>;
  retryAuth: () => void;
  canEdit: boolean;
  canAdmin: boolean;
  // Backwards compatibility
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]) => DEBUG && console.log('[Auth]', ...args);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    status: 'initializing',
    supabaseUser: null,
    user: null,
    activeBookset: null,
    myBooksets: [],
    error: null,
  });

  // Track the latest fetch request to handle race conditions
  const fetchRequestId = useRef(0);

  // Helper to fetch user profile and booksets
  const fetchUserData = async (
    userId: string,
    retries = 2,
    delay = AUTH_RETRY_DELAY_MS
  ): Promise<{ user: User; booksets: Bookset[]; activeBookset: Bookset | null }> => {
    const withTimeout = async <T,>(
      promise: PromiseLike<T>,
      ms = AUTH_TIMEOUT_MS,
      name = 'Request'
    ): Promise<T> => {
      const timeoutPromise = new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
      );
      return Promise.race([promise as Promise<T>, timeoutPromise]);
    };

    log('Fetching user data for', userId);

    // Run queries in parallel for better performance
    const userQuery = supabase.from('users').select('*').eq('id', userId).single();
    const booksetsQuery = supabase.from('booksets').select('*');

    try {
      const [userResult, booksetsResult] = await Promise.all([
        withTimeout(userQuery, AUTH_TIMEOUT_MS, 'User profile fetch'),
        withTimeout(booksetsQuery, AUTH_TIMEOUT_MS, 'Booksets fetch'),
      ]);

      const { data: userData, error: userError } = userResult;
      const { data: booksetsData, error: booksetsError } = booksetsResult;

      if (userError || !userData) {
        throw userError || new Error('User profile not found');
      }

      if (booksetsError) {
        throw booksetsError;
      }

      log('User profile fetched:', userData.email);

      const booksets: Bookset[] = booksetsData || [];
      log('Booksets fetched:', booksets.length);

      // 3. Set active bookset
      const activeId = userData.active_bookset_id;
      const active = booksets.find((b) => b.id === activeId) || booksets[0] || null;

      log('Active bookset:', active?.name || 'none');

      return { user: userData, booksets, activeBookset: active };
    } catch (err) {
      if (retries > 0) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log(`User data fetch failed (${msg}), retrying (${retries} left)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchUserData(userId, retries - 1, delay);
      }
      throw err;
    }
  };

  // Single effect - only source of truth is onAuthStateChange
  useEffect(() => {
    log('Setting up auth state change listener');

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      log('Auth state change:', event, session ? 'session exists' : 'no session');

      // Token refresh shouldn't trigger re-initialization - just update the session
      // FIX: Prevents 10+ second "Loading..." screen when tokens auto-refresh (every ~1 hour)
      // Security: Token refresh is handled by Supabase automatically. The new session
      // is already validated before this event fires. User profile data doesn't change
      // during token refresh, so re-fetching is unnecessary and causes poor UX.
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        log('Token refreshed, updating session only (no re-fetch)');
        setAuthState((prev) => ({
          ...prev,
          supabaseUser: session.user,
        }));
        return;
      }

      // No session - user is logged out
      if (!session?.user) {
        log('No session, setting unauthenticated state');

        // Clear user context in Sentry
        clearSentryUser();

        // Increment ID to invalidate any pending fetches
        fetchRequestId.current += 1;

        setAuthState({
          status: 'unauthenticated',
          supabaseUser: null,
          user: null,
          activeBookset: null,
          myBooksets: [],
          error: null,
        });
        return;
      }

      // Validate session is not expired
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt && expiresAt < now) {
        log('Session expired, setting unauthenticated state');
        fetchRequestId.current += 1; // Invalidate fetches
        setAuthState({
          status: 'unauthenticated',
          supabaseUser: null,
          user: null,
          activeBookset: null,
          myBooksets: [],
          error: new Error('Session expired. Please log in again.'),
        });
        return;
      }

      // Set intermediate state - we have a session but need to fetch user data
      log('Valid session, fetching user data...');
      setAuthState((prev) => ({
        ...prev,
        status: 'initializing',
        supabaseUser: session.user,
        error: null,
      }));

      // Generate a new request ID for this fetch attempt
      const requestId = ++fetchRequestId.current;

      // Fetch user data
      try {
        const { user, booksets, activeBookset } = await fetchUserData(session.user.id);

        // If this request is stale (a newer one started), ignore the result
        if (requestId !== fetchRequestId.current) {
          log(`Ignoring stale fetch result (ID: ${requestId})`);
          return;
        }

        log('User data fetched successfully, setting authenticated state');

        // Set user context in Sentry for error tracking
        setSentryUser(user.id, user.email);

        setAuthState({
          status: 'authenticated',
          supabaseUser: session.user,
          user,
          activeBookset,
          myBooksets: booksets,
          error: null,
        });
      } catch (err) {
        // If this request is stale, ignore the error (don't log timeout)
        if (requestId !== fetchRequestId.current) {
          log(`Ignoring stale fetch error (ID: ${requestId})`);
          return;
        }

        const error = err instanceof Error ? err : new Error('Unknown error');
        const isTimeout = error.message.includes('timed out');

        log('Error fetching user data:', error.message);

        setAuthState((prev) => ({
          ...prev,
          status: 'error',
          error: isTimeout
            ? new Error('Database connection timed out. Please check your internet connection.')
            : error,
        }));
      }
    });

    return () => {
      log('Unsubscribing from auth state changes');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    log('Signing up:', email);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    log('Signing in:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // onAuthStateChange will handle the rest
  };

  const signOut = async () => {
    log('Signing out');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
    // onAuthStateChange will handle setting unauthenticated state
  };

  const resetPassword = async (email: string) => {
    log('Resetting password for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const switchBookset = async (booksetId: string) => {
    if (!authState.user) return;

    log('Switching bookset to:', booksetId);

    // Optimistic update
    const target = authState.myBooksets.find((b) => b.id === booksetId);
    if (target) {
      setAuthState((prev) => ({ ...prev, activeBookset: target }));

      // Update in DB
      const { error } = await supabase
        .from('users')
        .update({ active_bookset_id: booksetId })
        .eq('id', authState.user.id);

      if (error) {
        console.error('Failed to update active bookset', error);
        // Revert on error
        const original = authState.myBooksets.find(
          (b) => b.id === authState.user?.active_bookset_id
        );
        if (original) {
          setAuthState((prev) => ({ ...prev, activeBookset: original }));
        }
      } else {
        // Update local user state
        setAuthState((prev) => ({
          ...prev,
          user: prev.user ? { ...prev.user, active_bookset_id: booksetId } : null,
        }));
      }
    }
  };

  const retryAuth = () => {
    log('Retrying auth - reloading page');
    window.location.reload();
  };

  const canEdit = !!authState.activeBookset;
  const canAdmin = !!authState.user?.is_admin;

  // Backwards compatibility: loading is true when initializing
  const loading = authState.status === 'initializing';

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      ...authState,
      signUp,
      signIn,
      signOut,
      resetPassword,
      switchBookset,
      retryAuth,
      canEdit,
      canAdmin,
      loading,
    }),
    [authState, canEdit, canAdmin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
