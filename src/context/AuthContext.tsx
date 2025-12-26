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
  const fetchUserData = async (userId: string, retries = 3, delay = 1000) => {
    console.log(`fetchUserData called for ${userId}. Retries left: ${retries}`);
    try {
      // 1. Fetch user profile
      console.log('Fetching user profile from DB...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('User profile fetch result:', { userData, error: userError });

      if (userError || !userData) {
        if (retries > 0) {
          console.log(`User profile missing or error. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchUserData(userId, retries - 1, delay);
        }
        throw userError || new Error('User profile not found');
      }

      setUser(userData);

      // 2. Fetch accessible booksets (owned + granted)
      console.log('Fetching booksets...');
      const { data: booksetsData, error: booksetsError } = await supabase
        .from('booksets')
        .select('*');

      if (booksetsError) {
        throw booksetsError;
      }

      const booksets = booksetsData || [];
      setMyBooksets(booksets);

      // 3. Set active bookset
      const activeId = userData.active_bookset_id;
      const active = booksets.find((b) => b.id === activeId) || booksets[0] || null;
      setActiveBookset(active);
      console.log('fetchUserData completed successfully');
    } catch (err) {
      console.error('Error fetching user data:', err);
      // If aborted, it's a timeout
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          new Error('Database connection timed out. Please check your internet or API keys.')
        );
      } else {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
      // Ensure user is null if fetch fails, so ProtectedRoute redirects correctly
      setUser(null);
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

    // Check active session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSupabaseUser(session?.user ?? null);
        if (session?.user && !initialSessionHandledRef.current) {
          initialSessionHandledRef.current = true;
          runFetchUserData(session.user.id).finally(() => setLoading(false));
          return;
        }
        if (!session?.user) setLoading(false);
      })
      .catch((err) => {
        console.error('getSession error', err);
        setLoading(false);
      });
  }, []);

  // Effect 2: Listen for auth changes (subscribe/unsubscribe correctly)
  useEffect(() => {
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state change event:', _event, 'has session:', !!session?.user);
      setSupabaseUser(session?.user ?? null);

      if (session?.user) {
        setLoading(true);
        try {
          // For new signups/logins, we want to ensure we fetch fresh data
          // fetchUserData has built-in retry logic for DB triggers
          if (_event === 'INITIAL_SESSION' && initialSessionHandledRef.current) {
            // Skip if we already handled initial session
            return;
          }

          if (_event === 'INITIAL_SESSION') {
            initialSessionHandledRef.current = true;
          }

          console.log('Fetching user data for:', session.user.id);
          await runFetchUserData(session.user.id);
          console.log('User data fetch complete');
        } catch (err) {
          console.error('Error in auth state change handler:', err);
        } finally {
          setLoading(false);
        }
      } else {
        // User signed out or session expired
        console.log('No session - clearing user state');
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
    console.log('signOut called');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
    console.log('Sign out successful');

    // Manually clear state immediately (don't wait for auth state change event)
    // This ensures the UI updates even if the event listener doesn't fire
    setUser(null);
    setActiveBookset(null);
    setMyBooksets([]);
    setSupabaseUser(null);
    setLoading(false);
    console.log('User state cleared');
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
