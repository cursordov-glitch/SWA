'use client';

// ============================================================
// src/features/search/components/UserResultCard.tsx
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { formatLastSeen } from '@/features/chat/utils';
import { createClient } from '@/lib/supabase/client';
import { ConversationService } from '@/services/conversation.service';
import type { UserResult } from '../types';

type Props = {
  user: UserResult;
  query: string;
};

export function UserResultCard({ user, query }: Props) {
  const router  = useRouter();
  const [starting, setStarting] = useState(false);

  const displayName = user.full_name ?? user.username;
  const lastSeen    = user.is_online ? 'Active now' : formatLastSeen(user.last_seen_at);

  // Navigate to DM — creates conversation if needed
  const handleMessage = async () => {
    setStarting(true);
    try {
      const supabase = createClient();
      const convService = new ConversationService(supabase);
      const { data: convId } = await convService.createDirectMessage({ otherUserId: user.id });
      if (convId) router.push(`/chat/${convId}`);
    } catch {
      // fail silently — user can retry
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl group">
      {/* Avatar links to profile */}
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <Avatar
          src={user.avatar_url}
          name={displayName}
          size="md"
          isOnline={user.is_online}
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/profile/${user.username}`}
            className="text-sm font-semibold text-gray-900 hover:text-pink-500 transition-colors truncate"
          >
            {highlightMatch(displayName, query)}
          </Link>
          <span className="text-xs text-gray-400 shrink-0">{lastSeen}</span>
        </div>
        <p className="text-xs text-gray-400 truncate">
          @{highlightMatch(user.username, query)}
          {user.bio && <span className="ml-2 text-gray-300">· {user.bio.slice(0, 60)}</span>}
        </p>
      </div>

      {/* Message button */}
      <button
        onClick={handleMessage}
        disabled={starting}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-md disabled:opacity-50"
        aria-label={`Message ${displayName}`}
      >
        {starting ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        Message
      </button>
    </div>
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
          ? <mark key={i} className="bg-pink-100 text-pink-700 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
