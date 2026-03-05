'use client';

// ============================================================
// src/features/profile/hooks/useProfile.ts
// ============================================================
// Owns all profile state for the Settings and Profile pages.
//
//   - profile: the current DbUser from the server
//   - update(): PATCH /api/profile/update — text fields
//   - uploadAvatar(): POST /api/profile/avatar — image file
//   - checkUsername(): GET /api/users/check?username=X (debounced)
//
// Optimistic updates: the profile state is updated immediately
// on the client before the server confirms, then corrected on
// error so the UI feels instant without being inaccurate.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import type { DbUser } from '@/types';
import type { ProfileFormValues, AvatarUploadState } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type UseProfileOptions = {
  initialProfile: DbUser;
};

type UpdateResult = { success: boolean; error?: string };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile({ initialProfile }: UseProfileOptions) {
  const [profile, setProfile]     = useState<DbUser>(initialProfile);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [avatarState, setAvatarState] = useState<AvatarUploadState>({ stage: 'idle' });
  const blobUrlRef = useRef<string | null>(null);

  // ── Text field update ─────────────────────────────────────────────────────

  const update = useCallback(
    async (values: Partial<ProfileFormValues>): Promise<UpdateResult> => {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // Optimistic: apply changes immediately
      const previousProfile = profile;
      setProfile((p) => ({
        ...p,
        username:  values.username  ?? p.username,
        full_name: values.full_name !== undefined ? (values.full_name || null) : p.full_name,
        bio:       values.bio       !== undefined ? (values.bio || null)       : p.bio,
        website:   values.website   !== undefined ? (values.website || null)   : p.website,
      }));

      try {
        const res = await fetch('/api/profile/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username:  values.username  || undefined,
            full_name: values.full_name || null,
            bio:       values.bio       || null,
            website:   values.website   || null,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          // Roll back optimistic update on error
          setProfile(previousProfile);
          setSaveError(json.error ?? 'Failed to save. Please try again.');
          return { success: false, error: json.error };
        }

        // Confirm with server-returned data
        if (json.data) setProfile(json.data as DbUser);
        setSaveSuccess(true);

        // Auto-clear success banner after 3s
        setTimeout(() => setSaveSuccess(false), 3000);
        return { success: true };

      } catch {
        setProfile(previousProfile);
        setSaveError('Network error. Please check your connection.');
        return { success: false, error: 'Network error' };
      } finally {
        setSaving(false);
      }
    },
    [profile]
  );

  // ── Avatar: select file ───────────────────────────────────────────────────

  const selectAvatarFile = useCallback((file: File) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setAvatarState({ stage: 'previewing', file, localUrl });
  }, []);

  const cancelAvatarSelection = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setAvatarState({ stage: 'idle' });
  }, []);

  // ── Avatar: upload ────────────────────────────────────────────────────────

  const uploadAvatar = useCallback(async (): Promise<UpdateResult> => {
    if (avatarState.stage !== 'previewing') return { success: false };

    const { file, localUrl } = avatarState;
    setAvatarState({ stage: 'uploading', file, localUrl });

    // Optimistically show the new avatar immediately
    const previousAvatarUrl = profile.avatar_url;
    setProfile((p) => ({ ...p, avatar_url: localUrl }));

    const form = new FormData();
    form.append('file', file);

    try {
      const res  = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) {
        // Roll back avatar preview
        setProfile((p) => ({ ...p, avatar_url: previousAvatarUrl }));
        setAvatarState({ stage: 'error', message: json.error ?? 'Upload failed' });
        return { success: false, error: json.error };
      }

      // Update profile with confirmed CDN URL
      setProfile((p) => ({ ...p, avatar_url: json.url }));
      setAvatarState({ stage: 'idle' });

      // Clean up blob URL — we no longer need it
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      return { success: true };

    } catch {
      setProfile((p) => ({ ...p, avatar_url: previousAvatarUrl }));
      setAvatarState({ stage: 'error', message: 'Network error. Please try again.' });
      return { success: false, error: 'Network error' };
    }
  }, [avatarState, profile.avatar_url]);

  const dismissAvatarError = useCallback(() => {
    setAvatarState({ stage: 'idle' });
  }, []);

  return {
    profile,
    saving,
    saveError,
    saveSuccess,
    setSaveError,
    update,
    avatarState,
    selectAvatarFile,
    cancelAvatarSelection,
    uploadAvatar,
    dismissAvatarError,
    isUploadingAvatar: avatarState.stage === 'uploading',
    isPreviewing:      avatarState.stage === 'previewing',
  };
}
