// ============================================================
// src/features/profile/types/index.ts
// ============================================================

import type { DbUser } from '@/types';

// ─── Form / edit state ────────────────────────────────────────────────────────

export type ProfileFormValues = {
  username: string;
  full_name: string;
  bio: string;
  website: string;
};

export type ProfileEditState = {
  saving: boolean;
  error: string | null;
  success: boolean;
};

// ─── Avatar upload state ──────────────────────────────────────────────────────

export type AvatarUploadState =
  | { stage: 'idle' }
  | { stage: 'previewing'; file: File; localUrl: string }
  | { stage: 'uploading';  file: File; localUrl: string }
  | { stage: 'error';      message: string };

// ─── View model ───────────────────────────────────────────────────────────────

/** Enriched profile with computed display fields */
export type ProfileViewModel = DbUser & {
  displayName: string;
  joinedLabel: string;
  lastSeenLabel: string;
  isOwnProfile: boolean;
};
