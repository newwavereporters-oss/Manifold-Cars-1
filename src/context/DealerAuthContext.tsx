import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dealerOnboardingService, DealerAccountStatus } from '../services/dealerOnboardingService';

interface DealerAuthContextType {
  user: User | null;
  session: Session | null;
  dealerAccount: DealerAccountStatus | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error: string | null; isPending?: boolean }>;
  signUp: (email: string, pass: string, fullName: string, phone: string) => Promise<{ success: boolean; error: string | null; requiresConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshDealerStatus: () => Promise<DealerAccountStatus>;
}

const DealerAuthContext = createContext<DealerAuthContextType | undefined>(undefined);

export const DealerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [dealerAccount, setDealerAccount] = useState<DealerAccountStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDealerAccount = useCallback(async (currentSession?: Session | null) => {
    if (!currentSession?.user) {
      setDealerAccount(null);
      return null;
    }
    const status = await dealerOnboardingService.getDealerAccountStatus();
    setDealerAccount(status);
    return status;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);
          if (initialSession?.user) {
            await fetchDealerAccount(initialSession);
          }
        }
      } catch (err) {
        console.warn('Dealer auth initialization warning:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setDealerAccount(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await fetchDealerAccount(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchDealerAccount]);

  const signIn = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; error: string | null; isPending?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !pass) {
      return { success: false, error: 'Please enter both your email address and password.' };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase credentials are not configured. Please verify your environment settings.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          return {
            success: false,
            error: 'Invalid email or password. Please verify your dealer credentials.',
          };
        }
        if (msg.includes('email not confirmed')) {
          return {
            success: false,
            error: 'Please verify your email address before signing in. Check your inbox for the confirmation link.',
          };
        }
        if (msg.includes('rate limit')) {
          return {
            success: false,
            error: 'Too many sign-in attempts. Please wait a few moments and try again.',
          };
        }
        return {
          success: false,
          error: 'Unable to sign in. Please verify your connection and try again.',
        };
      }

      if (!data?.user) {
        return { success: false, error: 'Authentication failed. Please try again.' };
      }

      setUser(data.user);
      setSession(data.session);

      // Check dealer account status
      const accStatus = await fetchDealerAccount(data.session);

      if (accStatus?.accountStatus === 'suspended') {
        return {
          success: false,
          error: 'Your dealership account is currently suspended. Please contact MANIFOLD dealer support.',
        };
      }

      return {
        success: true,
        error: null,
        isPending: accStatus?.accountStatus === 'pending',
      };
    } catch (err: any) {
      console.error('Dealer sign-in exception:', err);
      return {
        success: false,
        error: 'An unexpected connection error occurred during sign in. Please try again.',
      };
    }
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    phone: string
  ): Promise<{ success: boolean; error: string | null; requiresConfirmation?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !pass || !fullName.trim() || !phone.trim()) {
      return { success: false, error: 'All fields are required to register your dealership.' };
    }

    // Password strength check: at least 8 characters, at least 1 number, at least 1 letter
    if (pass.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) {
      return { success: false, error: 'Password must contain both letters and at least one number.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: fullName.trim(),
            contact_name: fullName.trim(),
            phone: phone.trim(),
            role: 'dealer',
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          return {
            success: false,
            error: 'An account with this email address already exists. Please sign in instead.',
          };
        }
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          return {
            success: false,
            error: 'Registration email limit reached. If you already created this account, please sign in.',
          };
        }
        return {
          success: false,
          error: 'Registration could not be completed. Please check your information and try again.',
        };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
        await fetchDealerAccount(data.session);
        return { success: true, error: null, requiresConfirmation: false };
      }

      // If Supabase requires email confirmation
      return { success: true, error: null, requiresConfirmation: true };
    } catch (err: any) {
      console.error('Dealer sign-up exception:', err);
      return {
        success: false,
        error: 'An unexpected connection error occurred. Please try again.',
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Dealer sign out notice:', e);
    }
    setUser(null);
    setSession(null);
    setDealerAccount(null);
  };

  const refreshDealerStatus = async (): Promise<DealerAccountStatus> => {
    const status = await fetchDealerAccount(session);
    return status || { hasAccount: false };
  };

  const value: DealerAuthContextType = {
    user,
    session,
    dealerAccount,
    loading,
    signIn,
    signUp,
    signOut,
    refreshDealerStatus,
  };

  return <DealerAuthContext.Provider value={value}>{children}</DealerAuthContext.Provider>;
};

export const useDealerAuth = (): DealerAuthContextType => {
  const context = useContext(DealerAuthContext);
  if (!context) {
    throw new Error('useDealerAuth must be used within a DealerAuthProvider');
  }
  return context;
};
