// ============================================================
// src/app/(main)/settings/page.tsx
// ============================================================
// Settings page — Server Component.
// Fetches the current user + their auth email on the server,
// then passes both to SettingsForm (Client Component).
//
// Why fetch here and not client-side?
//   - Zero loading flash: profile data arrives with HTML
//   - Auth email lives in supabase.auth (server only)
//   - Redirects to /login if session is missing before any
//     client-side JS runs (fast, no flicker)
//
// The SettingsForm Client Component owns all interactive
// state (form values, avatar upload, save status).
// ============================================================

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';
import { SettingsForm } from '@/features/profile';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and account settings',
};

export default async function SettingsPage() {
  const supabase = await createServerClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const userService = createUserService(supabase);
  const { data: profile } = await userService.getCurrentUser();
  if (!profile) redirect('/login');

  return (
    // Scrollable column — sits inside the (main) layout's <main> flex container
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <SettingsForm
        initialProfile={profile}
        email={authUser.email ?? ''}
      />
    </div>
  );
}
