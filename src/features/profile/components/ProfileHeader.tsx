'use client';

// ============================================================
// src/features/profile/components/ProfileHeader.tsx
// ============================================================
// Hero section at the top of the profile page.
// Shows avatar, name, username, bio, stats, and action buttons.
// Read-only (no editing here — that's in ProfileEditor/Settings).
// ============================================================

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { formatLastSeen } from '@/features/chat/utils';
import type { DbUser } from '@/types';

type Props = {
  user: DbUser;
  isOwnProfile: boolean;
};

export function ProfileHeader({ user, isOwnProfile }: Props) {
  const displayName = user.full_name ?? user.username;

  const joinedDate = new Date(user.created_at).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  const lastSeenText = user.is_online
    ? 'Active now'
    : formatLastSeen(user.last_seen_at);

  return (
    <div className="flex flex-col items-center gap-5 pt-8 pb-6 px-6 border-b border-gray-100">
      {/* Avatar */}
      <div className="relative">
        <Avatar src={user.avatar_url} name={displayName} size="xl" />
        {user.is_online && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white" aria-label="Online" />
        )}
      </div>

      {/* Name + username */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">@{user.username}</p>
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-sm text-gray-600 text-center max-w-xs leading-relaxed">
          {user.bio}
        </p>
      )}

      {/* Website */}
      {user.website && (
        <a
          href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-pink-500 hover:text-pink-600 transition-colors font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {user.website.replace(/^https?:\/\//, '')}
        </a>
      )}

      {/* Meta: join date + last seen */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Joined {joinedDate}
        </span>
        <span className="w-px h-3 bg-gray-200" aria-hidden="true" />
        <span className="flex items-center gap-1">
          <span className={user.is_online ? 'text-green-500' : 'text-gray-400'}>●</span>
          {lastSeenText}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {isOwnProfile ? (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit profile
          </Link>
        ) : (
          <Link
            href={`/chat/new?userId=${user.id}`}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-md transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Message
          </Link>
        )}
      </div>
    </div>
  );
}
