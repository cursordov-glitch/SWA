'use client';

// ============================================================
// src/features/chat/components/MessageList.tsx
// ============================================================
// Step 8: statusMap → seenStatus + showSeenIndicator per bubble
// Step 11: onReact and onReply callbacks forwarded to each bubble
//
// Indicator placement rule:
//   Only the LAST sent message in a group from the current user
//   gets the seen indicator. Earlier messages in the same group
//   don't show it — it would be visually cluttered.
//
//   "Last sent message" = last message where isMine = true
//   and the next message (if any) is either NOT mine or the
//   conversation ends.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';
import type { DbUser, MessageWithSender } from '@/types';
import type { StatusMap } from '../hooks/useMessageStatus';

type OptimisticMessage = MessageWithSender & {
  isOptimistic?: boolean;
  hasFailed?: boolean;
};

type MessageListProps = {
  messages: OptimisticMessage[];
  currentUser: DbUser;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: (id: string) => void;
  /** Step 8: map of messageId → delivery status for the sender's messages */
  statusMap?: StatusMap;
  /** Step 11: reaction toggle callback */
  onReact?: (messageId: string, emoji: string) => void;
  /** Step 11: set the message being replied to */
  onReply?: (message: OptimisticMessage) => void;
};

// ─── Date divider helpers ─────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const diff = Math.floor(
    (now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86_400_000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageList({
  messages,
  currentUser,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRetry,
  statusMap,
}: MessageListProps) {
  const bottomRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const atBottomRef  = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    const cur  = messages.length;
    const prev = prevCountRef.current;
    if (cur > prev && atBottomRef.current && cur - prev <= 3) {
      bottomRef.current?.scrollIntoView({ behavior: prev === 0 ? 'instant' : 'smooth' });
    }
    prevCountRef.current = cur;
  }, [messages.length]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loading]);

  // ── Find the index of the last message sent by the current user ───────────
  // This is the ONLY message that gets the seen indicator rendered.
  const lastMyMessageIndex = messages.reduce(
    (lastIdx, msg, idx) =>
      msg.sender_id === currentUser.id && !msg.hasFailed ? idx : lastIdx,
    -1
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-end gap-3 px-4 py-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <MessageSkeleton key={i} isMine={i % 3 === 0} />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div>
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">No messages yet</p>
          <p className="text-xs text-gray-400 mt-1">Say hello! 👋</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 scrollbar-hide"
    >
      {/* Load more */}
      <div className="flex justify-center pb-2">
        {loadingMore ? (
          <span className="text-xs text-gray-400 animate-pulse">Loading…</span>
        ) : hasMore ? (
          <button
            onClick={onLoadMore}
            className="text-xs text-gray-400 hover:text-pink-500 font-medium px-3 py-1 rounded-full hover:bg-pink-50 transition-all"
          >
            Load older messages
          </button>
        ) : (
          <span className="text-xs text-gray-300">Beginning of conversation</span>
        )}
      </div>

      {messages.map((msg, idx) => {
        const prev = messages[idx - 1];
        const next = messages[idx + 1];

        const isMine = msg.sender_id === currentUser.id;

        const isSameSenderAsPrev =
          prev &&
          prev.sender_id === msg.sender_id &&
          !prev.hasFailed &&
          Math.abs(new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;

        const isSameSenderAsNext =
          next &&
          next.sender_id === msg.sender_id &&
          Math.abs(new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) < 5 * 60_000;

        const showDateDivider = !prev || !isSameDay(prev.created_at, msg.created_at);
        const showTimestamp   = !isSameSenderAsNext;

        // Step 8: Show seen indicator only on the last sent message from current user
        const showSeenIndicator = isMine && idx === lastMyMessageIndex;
        const seenStatus        = statusMap?.get(msg.id) ?? null;

        return (
          <div key={msg.id}>
            {showDateDivider && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400 font-medium shrink-0">
                  {getDateLabel(msg.created_at)}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )}

            <MessageBubble
              id={msg.id}
              content={msg.content}
              messageType={msg.message_type}
              mediaUrl={msg.media_url}
              createdAt={msg.created_at}
              senderUsername={msg.sender_username}
              senderFullName={msg.sender_full_name}
              senderAvatarUrl={msg.sender_avatar_url}
              isMine={isMine}
              isOptimistic={msg.isOptimistic}
              hasFailed={msg.hasFailed}
              showAvatar={!isSameSenderAsPrev}
              showTimestamp={showTimestamp}
              seenStatus={seenStatus}
              showSeenIndicator={showSeenIndicator}
              onRetry={onRetry}
              reactions={msg.reactions}
              currentUserId={currentUser.id}
              onReact={onReact ? (emoji) => onReact(msg.id, emoji) : undefined}
              replyToContent={msg.reply_to_id
                ? (messages.find((m) => m.id === msg.reply_to_id)?.content ?? '…')
                : null}
              replyToSender={msg.reply_to_id
                ? (messages.find((m) => m.id === msg.reply_to_id)?.sender_full_name
                   ?? messages.find((m) => m.id === msg.reply_to_id)?.sender_username
                   ?? null)
                : null}
              onReply={onReply ? () => onReply(msg) : undefined}
            />
          </div>
        );
      })}

      <div ref={bottomRef} className="h-1 shrink-0" />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MessageSkeleton({ isMine }: { isMine: boolean }) {
  return (
    <div className={cn('flex items-end gap-2 px-4', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {!isMine && <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 animate-pulse" />}
      <div className={cn('h-9 rounded-2xl bg-gray-200 animate-pulse', isMine ? 'w-40' : 'w-52')} />
    </div>
  );
}
