'use client';

// ============================================================
// src/features/profile/components/ProfileEditor.tsx
// ============================================================
// The editable fields form used inside the Settings page.
// Handles: username (with live uniqueness check), full_name,
// bio (character counter), website.
//
// Does NOT handle avatar — that's AvatarUploader.
// Does NOT handle account deletion or password — future steps.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { DbUser } from '@/types';
import type { ProfileFormValues } from '../types';

const BIO_MAX = 160;
const USERNAME_RE = /^[a-zA-Z0-9_.]+$/;

type Props = {
  user: DbUser;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  onSave: (values: Partial<ProfileFormValues>) => Promise<{ success: boolean; error?: string }>;
};

type FieldErrors = Partial<Record<keyof ProfileFormValues, string>>;
type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export function ProfileEditor({ user, saving, saveError, saveSuccess, onSave }: Props) {
  const [values, setValues] = useState<ProfileFormValues>({
    username:  user.username,
    full_name: user.full_name ?? '',
    bio:       user.bio ?? '',
    website:   user.website ?? '',
  });

  const [fieldErrors, setFieldErrors]         = useState<FieldErrors>({});
  const [usernameAvail, setUsernameAvail]     = useState<UsernameAvailability>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live username availability check (debounced 500ms) ───────────────────

  useEffect(() => {
    const trimmed = values.username.trim();

    // Don't check if it's the current username or obviously invalid
    if (trimmed === user.username || trimmed.length < 3 || !USERNAME_RE.test(trimmed)) {
      setUsernameAvail('idle');
      return;
    }

    setUsernameAvail('checking');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check?username=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        setUsernameAvail(json.available ? 'available' : 'taken');
      } catch {
        setUsernameAvail('error');
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values.username, user.username]);

  // ── Field change handler ──────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K]
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  // ── Client-side validation ────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errors: FieldErrors = {};

    if (!values.username.trim()) {
      errors.username = 'Username is required';
    } else if (values.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (values.username.length > 30) {
      errors.username = 'Username must be 30 characters or fewer';
    } else if (!USERNAME_RE.test(values.username)) {
      errors.username = 'Only letters, numbers, underscores, and dots';
    } else if (usernameAvail === 'taken') {
      errors.username = 'This username is already taken';
    }

    if (values.full_name.length > 60) {
      errors.full_name = 'Name must be 60 characters or fewer';
    }

    if (values.bio.length > BIO_MAX) {
      errors.bio = `Bio must be ${BIO_MAX} characters or fewer`;
    }

    if (values.website && !/^https?:\/\/.+/.test(values.website)) {
      errors.website = 'Website must start with http:// or https://';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [values, usernameAvail]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    await onSave(values);
  }, [validate, onSave, values]);

  // ── Dirty check — only enable Save if something changed ──────────────────

  const isDirty =
    values.username  !== user.username  ||
    values.full_name !== (user.full_name ?? '') ||
    values.bio       !== (user.bio ?? '') ||
    values.website   !== (user.website ?? '');

  return (
    <div className="flex flex-col gap-5">

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <Input
          label="Username"
          value={values.username}
          onChange={(e) => setField('username', e.target.value)}
          error={fieldErrors.username}
          prefixIcon={<span className="text-gray-400 text-sm">@</span>}
          maxLength={31}
          autoComplete="username"
          spellCheck={false}
          suffixIcon={<UsernameStatus status={usernameAvail} currentUsername={values.username} originalUsername={user.username} />}
        />
        {usernameAvail === 'available' && !fieldErrors.username && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Username is available
          </p>
        )}
      </div>

      {/* Full name */}
      <Input
        label="Full name"
        value={values.full_name}
        onChange={(e) => setField('full_name', e.target.value)}
        error={fieldErrors.full_name}
        placeholder="Your display name"
        maxLength={61}
        autoComplete="name"
      />

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Bio</label>
        <div className="relative">
          <textarea
            value={values.bio}
            onChange={(e) => setField('bio', e.target.value)}
            placeholder="A short bio about yourself…"
            maxLength={BIO_MAX + 5}
            rows={3}
            className={cn(
              'w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 resize-none',
              'placeholder:text-gray-400',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent',
              fieldErrors.bio
                ? 'border-red-400'
                : 'border-gray-300 hover:border-gray-400'
            )}
          />
          <span className={cn(
            'absolute bottom-2 right-3 text-[11px] font-medium tabular-nums',
            values.bio.length >= BIO_MAX ? 'text-red-500' :
            values.bio.length >= BIO_MAX - 20 ? 'text-yellow-500' : 'text-gray-300'
          )}>
            {values.bio.length}/{BIO_MAX}
          </span>
        </div>
        {fieldErrors.bio && (
          <p className="text-xs text-red-500">{fieldErrors.bio}</p>
        )}
      </div>

      {/* Website */}
      <Input
        label="Website"
        value={values.website}
        onChange={(e) => setField('website', e.target.value)}
        error={fieldErrors.website}
        placeholder="https://yoursite.com"
        type="url"
        maxLength={200}
        autoComplete="url"
      />

      {/* Server-level error */}
      {saveError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-600">{saveError}</p>
        </div>
      )}

      {/* Success banner */}
      {saveSuccess && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-700 font-medium">Profile saved!</p>
        </div>
      )}

      {/* Save button */}
      <Button
        variant="primary"
        onClick={handleSubmit}
        loading={saving}
        disabled={!isDirty || saving}
        fullWidth
      >
        Save changes
      </Button>
    </div>
  );
}

// ─── Username status icon ─────────────────────────────────────────────────────

function UsernameStatus({
  status,
  currentUsername,
  originalUsername,
}: {
  status: UsernameAvailability;
  currentUsername: string;
  originalUsername: string;
}) {
  if (currentUsername === originalUsername || currentUsername.length < 3) return null;

  if (status === 'checking') {
    return (
      <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === 'available') {
    return (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'taken') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return null;
}
