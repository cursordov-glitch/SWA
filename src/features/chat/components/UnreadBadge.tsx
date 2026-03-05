'use client';

// ============================================================
// src/features/chat/components/UnreadBadge.tsx
// ============================================================
// Renders a numeric unread count badge.
//
// Variants:
//   'sidebar'  — small inline badge in ConversationItem (right edge)
//   'nav'      — floating badge on a nav icon (top-right corner)
//
// The badge is rendered as a live region so screen readers
// announce changes as they happen.
// ============================================================

import { cn } from '@/lib/utils';

type UnreadBadgeProps = {
  count: number;
  variant?: 'sidebar' | 'nav';
  className?: string;
};

export function UnreadBadge({ count, variant = 'sidebar', className }: UnreadBadgeProps) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);

  if (variant === 'nav') {
    return (
      <span
        className={cn(
          // Fixed positioning relative to parent — caller must set position:relative
          'absolute -top-1 -right-1',
          'min-w-[16px] h-4 px-1 rounded-full',
          'bg-gradient-to-r from-pink-500 to-purple-600',
          'text-white text-[10px] font-bold leading-4',
          'flex items-center justify-center',
          'ring-2 ring-white',
          'transition-all duration-200',
          className
        )}
        role="status"
        aria-live="polite"
        aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center justify-center',
        'min-w-[18px] h-[18px] px-1 rounded-full',
        'bg-gradient-to-r from-pink-500 to-purple-600',
        'text-white text-[10px] font-bold',
        'transition-all duration-200',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
    >
      {label}
    </span>
  );
}
