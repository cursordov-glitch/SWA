'use client';

// ============================================================
// src/features/chat/components/MessageBubble.tsx
// ============================================================
// Step 8: seenStatus + SeenIndicator
// Step 11: reactions (ReactionBar + ReactionPicker on hover),
//          reply quote preview, voice message bubble,
//          reply callback passed to onReply prop
// ============================================================

import { memo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { ImageMessageBubble } from './ImageMessageBubble';
import { SeenIndicator } from './SeenIndicator';
import { ReactionPicker } from './ReactionPicker';
import { ReactionBar } from './ReactionBar';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { formatMessageTime } from '../utils';
import type { MessageDeliveryStatus } from '../hooks/useMessageStatus';
import type { ReactionMap } from '@/types';

type MessageBubbleProps = {
  id: string;
  content: string | null;
  messageType?: string;
  mediaUrl?: string | null;
  createdAt: string;
  senderUsername: string | null;
  senderFullName: string | null;
  senderAvatarUrl: string | null;
  isMine: boolean;
  isOptimistic?: boolean;
  hasFailed?: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  /** Step 8: delivery/read status — only shown for isMine messages */
  seenStatus?: MessageDeliveryStatus | 'sending' | null;
  /** Step 8: show the seen indicator for this specific message */
  showSeenIndicator?: boolean;
  onRetry?: (id: string) => void;
  /** Step 11: reactions */
  reactions?: ReactionMap;
  currentUserId?: string;
  onReact?: (emoji: string) => void;
  /** Step 11: reply */
  replyToContent?: string | null;
  replyToSender?: string | null;
  onReply?: () => void;
};

export const MessageBubble = memo(function MessageBubble({
  id,
  content,
  messageType = 'text',
  mediaUrl,
  createdAt,
  senderFullName,
  senderUsername,
  senderAvatarUrl,
  isMine,
  isOptimistic = false,
  hasFailed = false,
  showAvatar = true,
  showTimestamp = false,
  seenStatus = null,
  showSeenIndicator = false,
  onRetry,
  reactions = {},
  currentUserId = '',
  onReact,
  replyToContent = null,
  replyToSender = null,
  onReply,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const handleReact = useCallback((emoji: string) => { onReact?.(emoji); setPickerOpen(false); }, [onReact]);
  const displayName = senderFullName ?? senderUsername ?? 'Unknown';
  const isImage = messageType === 'image';
  const isAudio = messageType === 'audio';
  const imageUrl = isImage ? (mediaUrl ?? content) : null;

  // Show indicator only for our own messages and only when requested by parent
  const shouldShowStatus = isMine && showSeenIndicator && (isOptimistic || seenStatus !== null);
  const effectiveStatus  = isOptimistic && !hasFailed ? 'sending' : seenStatus;

  return (
    <div
      className={cn(
        'relative flex items-end gap-2 group px-4',
        isMine ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar — only for received messages */}
      {!isMine && (
        <div className="w-7 shrink-0 mb-0.5">
          {showAvatar && (
            <Avatar src={senderAvatarUrl} name={displayName} size="xs" />
          )}
        </div>
      )}

      {/* Bubble + metadata */}
      <div
        className={cn(
          'flex flex-col gap-1',
          isMine ? 'items-end' : 'items-start',
          !isImage && 'max-w-[72%]'
        )}
      >
        {/* Sender name — group chats, others only */}
        {!isMine && showAvatar && (
          <span className="text-xs text-gray-400 px-1">{displayName}</span>
        )}

        {/* Step 11: Reply quote preview */}
        {replyToContent && (
          <div className={cn(
            'px-2.5 py-1.5 rounded-xl text-xs border-l-2 mb-0.5 max-w-[220px] truncate',
            isMine
              ? 'bg-white/15 border-white/50 text-white/80'
              : 'bg-gray-50 border-pink-400 text-gray-500'
          )}>
            {replyToSender && <span className="font-semibold block">{replyToSender}</span>}
            <span className="truncate block">{replyToContent}</span>
          </div>
        )}

        {/* ── Image message ──────────────────────────────── */}
        {isImage && (
          <ImageMessageBubble
            id={id}
            imageUrl={imageUrl}
            createdAt={createdAt}
            isMine={isMine}
            isOptimistic={isOptimistic}
            hasFailed={hasFailed}
            showTimestamp={showTimestamp}
            onRetry={onRetry}
          />
        )}

        {/* Step 11: Audio message */}
        {isAudio && mediaUrl && (
          <VoiceMessageBubble mediaUrl={mediaUrl} content={content} isMine={isMine} />
        )}

        {/* ── Text message ───────────────────────────────── */}
        {!isImage && !isAudio && (
          <>
            <div
              className={cn(
                'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                'transition-opacity duration-150',
                isMine
                  ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm',
                isOptimistic && 'opacity-60',
                hasFailed && 'bg-red-100 text-red-800 border border-red-200'
              )}
            >
              {content}
            </div>

            {hasFailed && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-red-400">Failed to send</span>
                {onRetry && (
                  <button
                    onClick={() => onRetry(id)}
                    className="text-xs text-pink-500 font-medium hover:text-pink-600"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {isOptimistic && !hasFailed && (
              <span className="text-[10px] text-gray-400 px-1">Sending…</span>
            )}

            {!isOptimistic && !hasFailed && (
              <span
                className={cn(
                  'text-[10px] text-gray-400 px-1 transition-opacity duration-150',
                  showTimestamp ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                {formatMessageTime(createdAt)}
              </span>
            )}
          </>
        )}

        {/* Step 11: Reaction bar */}
        {Object.keys(reactions).length > 0 && currentUserId && (
          <ReactionBar
            reactions={reactions}
            currentUserId={currentUserId}
            isMine={isMine}
            onToggle={(emoji) => onReact?.(emoji)}
          />
        )}

        {/* Step 11: Reaction picker + reply button (on hover) */}
        {!isOptimistic && !hasFailed && (onReact || onReply) && (
          <div className={cn(
            'absolute top-0 flex items-center gap-0.5',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-100',
            isMine ? 'left-2' : 'right-2'
          )}>
            {onReact && (
              <div className="relative">
                {pickerOpen && (
                  <ReactionPicker
                    onSelect={handleReact}
                    onClose={() => setPickerOpen(false)}
                    isMine={isMine}
                  />
                )}
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-pink-500 hover:border-pink-200 transition-colors text-base"
                  title="React"
                  aria-label="Add reaction"
                >
                  😊
                </button>
              </div>
            )}
            {onReply && (
              <button
                onClick={onReply}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-pink-500 hover:border-pink-200 transition-colors"
                title="Reply"
                aria-label="Reply to message"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ── Seen Indicator — only on our messages ─────── */}
        {shouldShowStatus && (
          <div className="flex items-center justify-end px-1">
            <SeenIndicator status={effectiveStatus} size="xs" />
          </div>
        )}
      </div>

      {/* Spacer for "my" messages */}
      {isMine && <div className="w-7 shrink-0" />}
    </div>
  );
});
