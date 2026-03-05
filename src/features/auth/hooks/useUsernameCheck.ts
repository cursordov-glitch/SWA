'use client';

// ============================================================
// src/features/auth/hooks/useUsernameCheck.ts
// ============================================================
// Debounced real-time username availability check.
// Used on the register form to give instant feedback.
// ============================================================

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { AuthService } from '../services/auth.service';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function useUsernameCheck(username: string) {
  const [status, setStatus] = useState<UsernameStatus>('idle');

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();

    if (!trimmed || trimmed.length < 3) {
      setStatus('idle');
      return;
    }

    // Validate format client-side first
    const validFormat = /^[a-zA-Z0-9_\.]+$/.test(trimmed);
    if (!validFormat) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const authService = new AuthService(supabase);
      const available = await authService.checkUsernameAvailable(trimmed);
      setStatus(available ? 'available' : 'taken');
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [username]);

  return status;
}
