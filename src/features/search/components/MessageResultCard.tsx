'use client';

// ============================================================
// src/features/search/components/MessageResultCard.tsx
// ============================================================
// A message search result row.
// Shows: conversation name → sender avatar + name → message snippet
// Clicking navigates to /chat/:conversationId
// (Future: deep-link to the specific message once message jumping lands)
// ============================================================

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { formatMessageTime } from '@/features/chat/utils';
import type { MessageResult } from '../types';

type Props = {
  msg: MessageResult;
  query: string;
};

export function MessageResultCard({ msg, query }: Props) {
  const senderName = msg.sender_full_name ?? msg.sender_username ?? 'Unknown';

  return (
    <Link
      href={`/chat/${msg.conversation_id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
    >
      <Avatar
        src={msg.sender_avatar_url}
        name={senderName}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex-1 min-w-0">
        {/* Conversation + timestamp */}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-pink-500 truncate">
            {msg.conversation_name}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0">
            {formatMessageTime(msg.created_at)}
          </span>
        </div>

        {/* Sender name */}
        <p className="text-xs text-gray-500 mb-1">{senderName}</p>

        {/* Message snippet with highlighted match */}
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2 break-words">
          {highlightMatch(msg.content, query)}
        </p>
      </div>
    </Link>
  );
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5 not-italic font-medium">{part}</mark>
          : part
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
