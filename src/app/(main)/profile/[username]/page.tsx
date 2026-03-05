// ============================================================
// src/app/(main)/profile/[username]/page.tsx
// ============================================================
// Public profile page for any user.
// URL: /profile/:username
//
// Fetches the profile by username on the server.
// Compares to current user to determine isOwnProfile.
// Renders ProfileHeader (read-only view).
//
// isOwnProfile = true  → shows "Edit profile" button → /settings
// isOwnProfile = false → shows "Message" button → /chat/new?userId=X
// ============================================================

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';
import { ProfileHeader } from '@/features/profile';

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `${username}'s profile`,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

  const supabase = await createServerClient();

  // Auth
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  // Fetch the profile being viewed
  const userService = createUserService(supabase);
  const { data: profileUser } = await userService.getUserByUsername(username);
  if (!profileUser) notFound();

  // Fetch the current user's own profile to check isOwnProfile
  const { data: currentUser } = await userService.getCurrentUser();

  const isOwnProfile = currentUser?.id === profileUser.id;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-md mx-auto">
        {/* Back navigation */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Profile header — the main view */}
        <ProfileHeader
          user={profileUser}
          isOwnProfile={isOwnProfile}
        />

        {/* Shared conversations section could go here in a future step */}
        <div className="px-6 py-4 text-center">
          <p className="text-xs text-gray-300">
            {isOwnProfile
              ? 'This is how others see your profile'
              : `Message ${profileUser.full_name ?? `@${profileUser.username}`} to start chatting`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
