import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  resolveCurrentUserRole,
  type AccountRole,
  type AccountRoleResolution,
} from '../services/roleService';

interface RoleContextValue extends AccountRoleResolution {
  loading: boolean;
  isGamePlayer: boolean;
  isAdminAccount: boolean;
  isDealerAccount: boolean;
  refreshRole: () => Promise<AccountRoleResolution>;
}

const DEFAULT_RESOLUTION: AccountRoleResolution = {
  role: 'anonymous',
  userId: null,
  email: null,
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resolution, setResolution] = useState<AccountRoleResolution>(DEFAULT_RESOLUTION);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshRole = useCallback(async (explicitToken?: string | null): Promise<AccountRoleResolution> => {
    try {
      const resolved = await resolveCurrentUserRole(explicitToken);
      setResolution(resolved);
      return resolved;
    } catch {
      setResolution(DEFAULT_RESOLUTION);
      return DEFAULT_RESOLUTION;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setResolution(DEFAULT_RESOLUTION);
          setLoading(false);
        }
        return;
      }
      const resolved = await resolveCurrentUserRole();
      if (mounted) {
        setResolution(resolved);
        setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setResolution(DEFAULT_RESOLUTION);
        setLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setLoading(true);
        const resolved = await resolveCurrentUserRole(session.access_token);
        if (mounted) {
          setResolution(resolved);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const role: AccountRole = resolution.role;

  const value: RoleContextValue = {
    ...resolution,
    loading,
    isGamePlayer: role === 'player',
    isAdminAccount: role === 'admin',
    isDealerAccount: role === 'dealer',
    refreshRole: () => refreshRole(),
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return ctx;
}
