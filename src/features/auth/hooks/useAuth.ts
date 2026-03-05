'use client';

// ============================================================
// src/features/auth/hooks/useAuth.ts
// ============================================================
// Single source of truth for auth state on the client.
// Listens to Supabase Auth state changes and syncs presence.
// Use this in any Client Component that needs the current user.
// ============================================================

import { useEffect, useState, useCallback } from 'react';

import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

import type { DbUser } from '@/types';

type AuthState = {
  user: User | null;
  profile: DbUser | null;
  loading: boolean;
  initialized: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    initialized: false,
  });

  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string): Promise<DbUser | null> => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      return data as DbUser | null;
    },
    [supabase]
  );

  const setOnline = useCallback(
    async (userId: string, isOnline: boolean) => {
      await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId);
    },
    [supabase]
  );

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const profile = await fetchProfile(user.id);
        await setOnline(user.id, true);
        setState({ user, profile, loading: false, initialized: true });
      } else {
        setState({ user: null, profile: null, loading: false, initialized: true });
      }
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;

      if (user) {
        const profile = await fetchProfile(user.id);

        if (event === 'SIGNED_IN') {
          await setOnline(user.id, true);
        }

        setState({ user, profile, loading: false, initialized: true });
      } else {
        setState({ user: null, profile: null, loading: false, initialized: true });
      }
    });

    // 3. Presence: mark offline when tab closes
    const handleVisibilityChange = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setOnline(user.id, document.visibilityState === 'visible');
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProfile, setOnline, supabase]);

  const signOut = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await setOnline(user.id, false);
    await supabase.auth.signOut();
  }, [supabase, setOnline]);

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    initialized: state.initialized,
    isAuthenticated: !!state.user,
    signOut,
  };
}
