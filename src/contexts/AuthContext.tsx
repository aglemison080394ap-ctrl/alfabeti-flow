import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  role: 'admin' | 'teacher';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setSessionFromTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name, role')
        .eq('user_id', userId)
        .maybeSingle();
      setProfile(data as Profile | null);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    // Listener registered FIRST — always
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Fire profile fetch without blocking loading state
          fetchProfile(newSession.user.id).finally(() => setLoading(false));
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check existing session — if no session, unblock immediately
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!existingSession) {
        setLoading(false);
      }
      // If session exists, onAuthStateChange will handle loading(false)
    });

    // Hard safety timeout — never stay loading > 4s
    const timeout = setTimeout(() => setLoading(false), 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  const setSessionFromTokens = async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signIn,
      signOut,
      setSessionFromTokens,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
