'use client';

// ============================================================
// src/features/chat/components/ChatHeader.tsx
// ============================================================
// Step 9: The other user's name is now a Link to /profile/[username].
// This connects the chat UI to the profile system without any
// data fetching changes — we already have the participant's
// full profile (including username) passed from the server.
// ============================================================

import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { formatLastSeen } from '../utils';
import type { DbUser, DbConversation } from '@/types';

type ChatHeaderProps = {
  conversation: DbConversation;
  otherUser: DbUser | null;
  isGroup: boolean;
  participantCount?: number;
};

export function ChatHeader({
  conversation,
  otherUser,
  isGroup,
  participantCount,
}: ChatHeaderProps) {
  const displayName = isGroup
    ? (conversation.group_name ?? 'Group Chat')
    : (otherUser?.full_name ?? otherUser?.username ?? 'Unknown');

  const avatarUrl = isGroup
    ? conversation.group_avatar_url
    : otherUser?.avatar_url;

  const subtitle = isGroup
    ? `${participantCount ?? 0} members`
    : otherUser?.is_online
      ? 'Active now'
      : formatLastSeen(otherUser?.last_seen_at ?? null);

  // Profile URL — only for DMs where we know the other user
  const profileHref = !isGroup && otherUser?.username
    ? `/profile/${otherUser.username}`
    : null;

  return (
    <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
      {/* Back button — visible on mobile */}
      <Link
        href="/chat"
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
        aria-label="Back to conversations"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* Avatar — links to profile for DMs */}
      {profileHref ? (
        <Link href={profileHref} className="shrink-0 hover:opacity-80 transition-opacity">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size="sm"
            isOnline={!isGroup ? otherUser?.is_online : undefined}
          />
        </Link>
      ) : (
        <Avatar
          src={avatarUrl}
          name={displayName}
          size="sm"
          isOnline={!isGroup ? otherUser?.is_online : undefined}
        />
      )}

      {/* Name + subtitle — name links to profile for DMs */}
      <div className="flex-1 min-w-0">
        {profileHref ? (
          <Link
            href={profileHref}
            className="text-sm font-semibold text-gray-900 truncate hover:text-pink-500 transition-colors block"
          >
            {displayName}
          </Link>
        ) : (
          <h1 className="text-sm font-semibold text-gray-900 truncate">{displayName}</h1>
        )}
        <p className="text-xs text-gray-400 truncate">{subtitle}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {profileHref && (
          <Link
            href={profileHref}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            aria-label="View profile"
            title="View profile"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        )}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          aria-label="More options"
          title="More options"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
