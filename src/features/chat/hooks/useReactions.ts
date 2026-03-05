'use client';
// src/features/chat/hooks/useReactions.ts
// Optimistic emoji reaction toggle.
// The sync trigger on message_reactions keeps messages.reactions JSONB
// in sync, so the Realtime UPDATE on messages propagates to all clients.

import { useCallback, useRef } from 'react';
import type { ReactionMap } from '@/types';

type UpdateFn = (messageId: string, reactions: ReactionMap) => void;

export function useReactions(currentUserId: string, onOptimisticUpdate: UpdateFn) {
  const pending = useRef<Set<string>>(new Set());

  const toggle = useCallback(
    async (messageId: string, emoji: string, current: ReactionMap) => {
      const key = `${messageId}:${emoji}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);

      // Optimistic update
      const users   = current[emoji] ?? [];
      const mine    = users.includes(currentUserId);
      const updated = mine ? users.filter((id) => id !== currentUserId) : [...users, currentUserId];
      const next    = { ...current };
      if (updated.length === 0) delete next[emoji]; else next[emoji] = updated;
      onOptimisticUpdate(messageId, next);

      try {
        const res = await fetch('/api/messages/react', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, emoji }),
        });
        if (!res.ok) onOptimisticUpdate(messageId, current); // rollback
      } catch {
        onOptimisticUpdate(messageId, current); // rollback
      } finally {
        pending.current.delete(key);
      }
    },
    [currentUserId, onOptimisticUpdate]
  );

  return { toggle };
}
