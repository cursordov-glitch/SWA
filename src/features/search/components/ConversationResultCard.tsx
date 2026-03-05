'use client';

// ============================================================
// src/features/search/components/ConversationResultCard.tsx
// ============================================================

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { formatConversationTime } from '@/features/chat/utils';
import { UnreadBadge } from '@/features/chat/components/UnreadBadge';
import type { ConversationResult } from '../types';

type Props = {
  conv: ConversationResult;
  query: string;
};

export function ConversationResultCard({ conv, query }: Props) {
  const isGroup     = conv.is_group;
  const displayName = isGroup
    ? (conv.group_name ?? 'Group Chat')
    : (conv.other_full_name ?? conv.other_username ?? 'Unknown');
  const avatarSrc   = isGroup ? conv.group_avatar_url : conv.other_avatar_url;
  const isOnline    = !isGroup ? (conv.other_is_online ?? false) : undefined;
  const timestamp   = formatConversationTime(conv.last_message_at);

  return (
    <Link
      href={`/chat/${conv.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
    >
      <Avatar src={avatarSrc} name={displayName} size="md" isOnline={isOnline} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {highlightMatch(displayName, query)}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-400 shrink-0">{timestamp}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-gray-400 truncate">
            {conv.last_message_preview
              ? highlightMatch(conv.last_message_preview, query)
              : 'No messages yet'
            }
          </p>
          {conv.unread_count > 0 && (
            <UnreadBadge count={conv.unread_count} variant="sidebar" />
          )}
        </div>
      </div>
    </Link>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-pink-100 text-pink-700 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
