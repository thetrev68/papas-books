import { createContext, useContext, useEffect, useState } from 'react';
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

  // Helper to fetch user profile and booksets with retry logic
  const fetchUserData = async (userId: string, retries = 3, delay = 1000) => {
    try {
      // 1. Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        if (retries > 0) {
          console.log(`User profile not found, retrying in ${delay}ms... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchUserData(userId, retries - 1, delay);
        }
        throw userError || new Error('User profile not found');
      }

      setUser(userData);

      // 2. Fetch accessible booksets (owned + granted)
      const { data: booksetsData, error: booksetsError } = await supabase
        .from('booksets')
        .select('*');

      if (booksetsError) throw booksetsError;
      
      const booksets = booksetsData || [];
      setMyBooksets(booksets);

      // 3. Set active bookset
      const activeId = userData.active_bookset_id;
      const active = booksets.find(b => b.id === activeId) || booksets[0] || null;
      setActiveBookset(active);

    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err);
      // Ensure user is null if fetch fails, so ProtectedRoute redirects correctly
      setUser(null);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        
        // If this is a new signup, give the DB trigger a moment
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
             // Small initial delay to allow trigger to complete
             await new Promise(resolve => setTimeout(resolve, 500));
             await fetchUserData(session.user.id);
        } else {
             await fetchUserData(session.user.id);
        }
        setLoading(false);
      } else {
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
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const switchBookset = async (booksetId: string) => {
    if (!user) return;
    
    // Optimistic update
    const target = myBooksets.find(b => b.id === booksetId);
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
    <AuthContext.Provider value={{
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
      canAdmin
    }}>
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
