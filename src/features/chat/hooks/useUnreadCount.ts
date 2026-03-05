'use client';

// ============================================================
// src/features/chat/hooks/useUnreadCount.ts
// ============================================================
// Tracks the TOTAL unread message count across all conversations.
// Used to show a numeric badge on the "Messages" nav link and
// to update the browser tab title.
//
// Two update sources:
//   1. Initial fetch from /api/messages/status/total (simple count query)
//   2. Realtime subscription: message_status INSERT events
//      (new messages → unread count goes up)
//      + conversationId-specific events when user opens a chat
//      (user marks messages seen → count goes down via refetch)
//
// Design:
//   - Count is approximate between fetches (incremented optimistically
//     on new message, reset to 0 when conversation is opened)
//   - We do NOT decrement on every individual 'seen' update —
//     instead we refetch when the active conversation changes
//   - Browser Notification API request is made here after user
//     interaction so the permission prompt is well-timed
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

type Options = {
  currentUserId: string;
  /** ID of the conversation currently visible — its messages are being auto-marked seen */
  activeConversationId?: string;
};

export function useUnreadCount({ currentUserId, activeConversationId }: Options) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  const supabaseRef = useRef(createClient());
  const channelRef  = useRef<RealtimeChannel | null>(null);
  const activeIdRef = useRef(activeConversationId);

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // ── Fetch total unread count ──────────────────────────────────────────────

  const fetchTotal = useCallback(async () => {
    try {
      // Direct Supabase client count query — no extra API route needed.
      // Uses the idx_msg_status_unseen partial index for O(log n) performance.
      const { count } = await supabaseRef.current
        .from('message_status')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .neq('status', 'seen');

      setTotalUnread(count ?? 0);
    } catch {
      // Fail silently — badge just won't update
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchTotal();
  }, [fetchTotal]);

  // ── Refresh when active conversation changes (marking seen resets count) ──

  useEffect(() => {
    if (activeConversationId) {
      // Small delay so mark-seen API call completes before we re-count
      const t = setTimeout(fetchTotal, 800);
      return () => clearTimeout(t);
    }
  }, [activeConversationId, fetchTotal]);

  // ── Realtime: watch for new message_status rows (new incoming messages) ───

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `unread-count:${currentUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'message_status',
          // Filter: only rows for this user (one status row per recipient)
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          // A new message_status row was inserted for us.
          // This means a new message arrived in one of our conversations.
          // We only increment if the conversation is NOT currently active
          // (active conversation auto-marks messages as seen via useMessages).
          const newRow = payload.new as { user_id: string; status: string };

          if (newRow.status !== 'seen') {
            // We'll refetch the accurate count rather than blindly incrementing,
            // because multiple messages can arrive in a burst.
            fetchTotal();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'message_status',
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string };
          // A status row was updated to 'seen' — re-count to reflect the decrease
          if (updated.status === 'seen') {
            fetchTotal();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, fetchTotal]);

  // ── Browser Notification permission ──────────────────────────────────────

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    return result;
  }, []);

  // ── Show browser notification ─────────────────────────────────────────────

  const showNotification = useCallback(
    (title: string, body: string, conversationId?: string) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag:  conversationId ?? 'chat',  // replaces previous notif for same convo
        renotify: false,
      });

      n.onclick = () => {
        window.focus();
        if (conversationId) {
          window.location.href = `/chat/${conversationId}`;
        }
        n.close();
      };
    },
    []
  );

  return {
    totalUnread,
    notifPermission,
    requestNotificationPermission,
    showNotification,
    refetch: fetchTotal,
  };
}
