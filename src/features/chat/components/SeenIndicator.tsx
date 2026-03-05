'use client';

// ============================================================
// src/features/chat/components/SeenIndicator.tsx
// ============================================================
// Renders delivery/read receipt icons for sent messages.
//
// Visual states (matching Instagram DM):
//   sending   — animated clock (optimistic, not yet in DB)
//   sent      — single grey check  (DB confirmed, not delivered)
//   delivered — double grey check  (recipient device received it)
//   seen      — double pink check  (recipient opened the conversation)
//
// Only rendered for the sender's own messages (isMine = true)
// and only on the last message in a sender-group to avoid
// cluttering the UI with repeated indicators.
//
// Accessibility: each state includes an aria-label for screen readers.
// ============================================================

import { cn } from '@/lib/utils';
import type { MessageDeliveryStatus } from '../hooks/useMessageStatus';

type SeenIndicatorProps = {
  /** The current delivery/read status for this message */
  status: MessageDeliveryStatus | 'sending' | null;
  /** Size variant — 'sm' for inline, 'xs' for compact layouts */
  size?: 'xs' | 'sm';
  className?: string;
};

export function SeenIndicator({ status, size = 'xs', className }: SeenIndicatorProps) {
  if (!status) return null;

  const iconSize = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (status === 'sending') {
    return (
      <span
        className={cn('inline-flex items-center text-gray-300', className)}
        aria-label="Sending"
        title="Sending"
      >
        <svg className={cn(iconSize, 'animate-spin')} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </span>
    );
  }

  if (status === 'sent') {
    // Single grey check
    return (
      <span
        className={cn('inline-flex items-center text-gray-400', className)}
        aria-label="Sent"
        title="Sent"
      >
        <CheckIcon className={iconSize} />
      </span>
    );
  }

  if (status === 'delivered') {
    // Double grey check
    return (
      <span
        className={cn('inline-flex items-center text-gray-400', className)}
        aria-label="Delivered"
        title="Delivered"
      >
        <DoubleCheckIcon className={iconSize} />
      </span>
    );
  }

  if (status === 'seen') {
    // Double pink/blue check (we use brand pink to match the app palette)
    return (
      <span
        className={cn('inline-flex items-center text-pink-500', className)}
        aria-label="Seen"
        title="Seen"
      >
        <DoubleCheckIcon className={iconSize} />
      </span>
    );
  }

  return null;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* Second check (behind) */}
      <polyline points="17 6 9 14 6 11" />
      {/* First check (front, offset right) */}
      <polyline points="23 6 12 17 9 14" />
    </svg>
  );
}
