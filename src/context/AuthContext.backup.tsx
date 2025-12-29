import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/config';
import { User, Bookset } from '../types/database';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  error: Error | null;
  activeBookset: Bookset | null;
  myBooksets: Bookset[];
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchBookset: (booksetId: string) => Promise<void>;
  canEdit: boolean;
  canAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeBookset, setActiveBookset] = useState<Bookset | null>(null);
  const [myBooksets, setMyBooksets] = useState<Bookset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const didInitRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const initialSessionHandledRef = useRef(false);

  // Helper to fetch user profile and booksets with retry logic

  const fetchUserData = async (userId: string, retries = 2, delay = 500) => {
    // Helper to enforce timeouts on DB requests

    const withTimeout = async <T,>(
      promise: PromiseLike<T>,
      ms = 5000,
      name = 'Request'
    ): Promise<T> => {
      const timeoutPromise = new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
      );

      return Promise.race([promise as Promise<T>, timeoutPromise]);
    };

    try {
      // 1. Fetch user profile

      const userQuery = supabase

        .from('users')

        .select('*')

        .eq('id', userId)

        .single();

      const { data: userData, error: userError } = await withTimeout(
        userQuery,
        8000,
        'User profile fetch'
      );

      if (userError || !userData) {
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));

          return fetchUserData(userId, retries - 1, delay);
        }

        throw userError || new Error('User profile not found');
      }

      setUser(userData);

      // 2. Fetch accessible booksets (owned + granted)

      const booksetsQuery = supabase

        .from('booksets')

        .select('*');

      const { data: booksetsData, error: booksetsError } = await withTimeout(
        booksetsQuery,
        8000,
        'Booksets fetch'
      );

      if (booksetsError) {
        throw booksetsError;
      }

      const booksets: Bookset[] = booksetsData || [];

      setMyBooksets(booksets);

      // 3. Set active bookset

      const activeId = userData.active_bookset_id;

      const active = booksets.find((b) => b.id === activeId) || booksets[0] || null;

      setActiveBookset(active);
    } catch (err) {
      console.error('Error fetching user data:', err);

      // If aborted, it's a timeout
      if (
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('timed out'))
      ) {
        setError(
          new Error(
            'Database connection timed out. Please check your internet connection or try again.'
          )
        );
      } else {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }

      // DON'T clear session on timeout - that would sign out valid users with slow connections
      // The session is still valid; we just couldn't fetch profile data
      // The user will see the error message and can refresh to try again
    }
  };
  const runFetchUserData = (userId: string) => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    const promise = fetchUserData(userId).finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  };

  // Effect 1: Check active session on mount (once)
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    let isMounted = true;

    // Check active session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;

        // If there's an error getting the session, treat it as no session
        if (error) {
          console.error('getSession error:', error);
          setSupabaseUser(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          // Validate session is not expired
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);

          if (expiresAt && expiresAt < now) {
            // Session is expired, don't try to fetch user data
            console.warn('Session expired, skipping user data fetch');
            setSupabaseUser(null);
            setLoading(false);
            return;
          }

          setSupabaseUser(session.user);

          // Only fetch user data if we haven't already started
          if (!initialSessionHandledRef.current) {
            initialSessionHandledRef.current = true;
            runFetchUserData(session.user.id)
              .then(() => {
                if (isMounted) setLoading(false);
              })
              .catch((err) => {
                console.error('Error loading user data:', err);
                // CRITICAL FIX: Always set loading to false, even on error
                // Otherwise the app gets stuck in loading state forever
                if (isMounted) setLoading(false);
              });
          } else {
            // Session already handled by onAuthStateChange, just stop loading
            setLoading(false);
          }
        } else {
          // No session
          setSupabaseUser(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('getSession error', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Effect 2: Listen for auth changes (subscribe/unsubscribe correctly)
  useEffect(() => {
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupabaseUser(session?.user ?? null);

      if (session?.user) {
        // CRITICAL FIX: Only skip INITIAL_SESSION events until getSession() completes
        // INITIAL_SESSION fires before Supabase client auth is fully initialized
        // But we MUST handle SIGNED_IN events (from actual login) immediately
        if (_event === 'INITIAL_SESSION' && !initialSessionHandledRef.current) {
          return;
        }

        setLoading(true);
        try {
          await runFetchUserData(session.user.id);
        } catch (err) {
          console.error('Error fetching user data:', err);
        } finally {
          // CRITICAL FIX: Always set loading to false in finally block
          // This ensures loading state is cleared even if fetchUserData throws
          setLoading(false);
        }
      } else {
        // User signed out or session expired
        setUser(null);
        setActiveBookset(null);
        setMyBooksets([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }

    // Manually clear state immediately (don't wait for auth state change event)
    // This ensures the UI updates even if the event listener doesn't fire
    setUser(null);
    setActiveBookset(null);
    setMyBooksets([]);
    setSupabaseUser(null);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const switchBookset = async (booksetId: string) => {
    if (!user) return;

    // Optimistic update
    const target = myBooksets.find((b) => b.id === booksetId);
    if (target) {
      setActiveBookset(target);

      // Update in DB
      const { error } = await supabase
        .from('users')
        .update({ active_bookset_id: booksetId })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update active bookset', error);
        // Revert? For now just log
      } else {
        // Update local user state
        setUser({ ...user, active_bookset_id: booksetId });
      }
    }
  };

  const canEdit = !!activeBookset; // Phase 1 simplified: assume if you can see it you can edit it unless RLS stops you.
  // Real implementation needs to check grants.
  // We'll refine this when we pull grants.

  const canAdmin = !!user?.is_admin;

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        loading,
        error,
        activeBookset,
        myBooksets,
        signUp,
        signIn,
        signOut,
        resetPassword,
        switchBookset,
        canEdit,
        canAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
