'use client';
// src/features/chat/components/ReactionBar.tsx
// Shows emoji + count pills below a message.
// Highlights emojis the current user has reacted with.

import { cn } from '@/lib/utils';
import type { ReactionMap } from '@/types';

type Props = {
  reactions:     ReactionMap;
  currentUserId: string;
  isMine:        boolean;
  onToggle:      (emoji: string) => void;
};

export function ReactionBar({ reactions, currentUserId, isMine, onToggle }: Props) {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
      {entries.map(([emoji, users]) => {
        const mine  = users.includes(currentUserId);
        const count = users.length;
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all duration-100',
              mine
                ? 'bg-pink-100 border-pink-300 text-pink-700 hover:bg-pink-200'
                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200',
              'hover:scale-105 active:scale-95'
            )}
            title={mine ? 'Remove reaction' : 'Add reaction'}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
