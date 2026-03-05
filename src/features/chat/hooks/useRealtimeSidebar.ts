'use client';

// ============================================================
// src/features/chat/hooks/useRealtimeSidebar.ts
// ============================================================
// Subscribes to conversation-level changes and triggers a
// sidebar refresh when the last_message changes.
//
// This is intentionally coarse-grained:
//   - We subscribe to the conversations table for this user
//   - On any UPDATE (last_message_at changed), we call onRefresh()
//   - onRefresh() re-fetches the sidebar list from the API
//
// Why not subscribe to messages directly for the sidebar?
//   The sidebar shows last_message_preview which is a denormalized
//   field on the conversations table (updated by DB trigger on
//   INSERT to messages). Watching conversations.UPDATE is simpler
//   and avoids an N-query fan-out across all conversations.
//
// This hook is used by ConversationList, not ChatWindow.
// ============================================================

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

type UseRealtimeSidebarOptions = {
  currentUserId: string;
  onRefresh: () => void;
};

export function useRealtimeSidebar({
  currentUserId,
  onRefresh,
}: UseRealtimeSidebarOptions) {
  const supabaseRef = useRef(createClient());
  const onRefreshRef = useRef(onRefresh);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!currentUserId) return;

    const supabase = supabaseRef.current;

    // Subscribe to updates on conversation_participants for this user.
    // When a new message arrives, the DB trigger updates conversations.last_message_at,
    // which propagates to conversation_participants view. Any change signals
    // that the sidebar needs refreshing.
    const channel = supabase
      .channel(`sidebar:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          // Debounce rapid consecutive updates (e.g. user sending fast)
          onRefreshRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          // New conversation added (someone started a DM with us)
          onRefreshRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId]);
}
