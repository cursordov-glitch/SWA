'use client';

// ============================================================
// src/features/chat/components/TypingIndicator.tsx
// ============================================================
// Displays "Jane is typing…" with animated bounce dots.
// Renders nothing (zero height) when no one is typing,
// so layout is unaffected when idle.
// ============================================================

import { cn } from '@/lib/utils';

type TypingIndicatorProps = {
  text: string | null;
};

export function TypingIndicator({ text }: TypingIndicatorProps) {
  // Null = no one typing — render nothing at all (no layout shift)
  if (!text) return null;

  return (
    <div className="shrink-0 flex items-center gap-2 px-5 py-1.5">
      {/* Animated bounce dots */}
      <div className="flex items-center gap-0.5" aria-hidden="true">
        <span className={cn('w-1.5 h-1.5 rounded-full bg-gray-400', 'animate-bounce [animation-delay:0ms]')} />
        <span className={cn('w-1.5 h-1.5 rounded-full bg-gray-400', 'animate-bounce [animation-delay:150ms]')} />
        <span className={cn('w-1.5 h-1.5 rounded-full bg-gray-400', 'animate-bounce [animation-delay:300ms]')} />
      </div>

      {/* Text */}
      <span className="text-xs text-gray-400 leading-none" role="status" aria-live="polite">
        {text}
      </span>
    </div>
  );
}
