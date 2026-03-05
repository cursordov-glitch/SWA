'use client';
// src/features/chat/components/ReactionPicker.tsx
// Small floating emoji picker shown on message hover.
// Only the 8 most-used reactions — keeps the UI tight.

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢', '👏', '🙏'];

type Props = {
  onSelect: (emoji: string) => void;
  onClose:  () => void;
  isMine:   boolean;
};

export function ReactionPicker({ onSelect, onClose, isMine }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute bottom-full mb-1 z-20',
        'flex items-center gap-0.5 px-2 py-1.5',
        'bg-white rounded-2xl shadow-lg border border-gray-100',
        'animate-in fade-in zoom-in-95 duration-100',
        isMine ? 'right-0' : 'left-0'
      )}
      role="toolbar"
      aria-label="React to message"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-lg hover:bg-gray-100 hover:scale-125 transition-all duration-100 active:scale-95"
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
