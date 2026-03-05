'use client';

// ============================================================
// src/features/profile/components/SettingsForm.tsx
// ============================================================
// The Settings page Client Component.
// Owns the full edit lifecycle for the current user's profile.
// Composed of AvatarUploader + ProfileEditor sections.
//
// Receives: initialProfile (from Server Component)
// Data flow:
//   useProfile hook owns all state + mutations
//   → AvatarUploader renders the avatar section
//   → ProfileEditor renders the text fields
//   → Both call back into useProfile's methods
// ============================================================

import { useProfile } from '../hooks/useProfile';
import { AvatarUploader } from './AvatarUploader';
import { ProfileEditor }  from './ProfileEditor';
import type { DbUser } from '@/types';

type Props = {
  initialProfile: DbUser;
  email: string;
};

export function SettingsForm({ initialProfile, email }: Props) {
  const {
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
  } = useProfile({ initialProfile });

  const displayName = profile.full_name ?? profile.username;

  return (
    <div className="flex flex-col gap-8 max-w-md w-full mx-auto px-4 py-8">

      {/* ── Page heading ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your profile and account</p>
      </div>

      {/* ── Avatar section ────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
          Profile photo
        </h2>
        <div className="flex flex-col items-center">
          <AvatarUploader
            currentAvatarUrl={profile.avatar_url}
            displayName={displayName}
            avatarState={avatarState}
            onFileSelected={selectAvatarFile}
            onConfirm={uploadAvatar}
            onCancel={cancelAvatarSelection}
            onDismissError={dismissAvatarError}
          />
        </div>
      </section>

      {/* ── Profile fields section ────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
          Profile info
        </h2>
        <ProfileEditor
          user={profile}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          onSave={async (values) => {
            setSaveError(null);
            return update(values);
          }}
        />
      </section>

      {/* ── Account info section (read-only) ─────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
          Account
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Email address</p>
              <p className="text-xs text-gray-400 mt-0.5">Used for sign-in and notifications</p>
            </div>
            <span className="text-sm text-gray-600 font-mono bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 max-w-[180px] truncate">
              {email}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Member since</p>
              <p className="text-xs text-gray-400 mt-0.5">Your account creation date</p>
            </div>
            <span className="text-sm text-gray-500">
              {new Date(profile.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">User ID</p>
              <p className="text-xs text-gray-400 mt-0.5">Your unique identifier</p>
            </div>
            <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
              {profile.id.slice(0, 8)}…
            </span>
          </div>
        </div>
      </section>

      {/* ── Danger zone ───────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">
          Danger zone
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Delete account</p>
            <p className="text-xs text-gray-400 mt-0.5">Permanently remove your account and all data</p>
          </div>
          <button
            disabled
            title="Account deletion coming soon"
            className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-200 bg-red-50 opacity-50 cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
