'use client';

// ============================================================
// src/features/chat/hooks/useRealtimeMessages.ts
// ============================================================
// Subscribes to a Supabase Realtime postgres_changes channel
// for a single conversation. Appends incoming messages to
// the list managed by useMessages via the addMessage() callback.
//
// Architecture:
//   useMessages (owns state)
//     └── useRealtimeMessages (pushes into state via addMessage)
//
// Separation of concerns:
// - useMessages handles HTTP fetch, optimistic UI, pagination
// - useRealtimeMessages handles ONLY the live push connection
//   This makes each hook independently testable and replaceable.
//
// Duplicate prevention strategy:
//   1. The sender's own message is already in the list as an
//      optimistic stub (id = "optimistic-XXX") which gets
//      REPLACED by the confirmed message when the API responds.
//   2. The Realtime INSERT event for the same row arrives ~50ms
//      later. addMessage() checks `s.messages.some(m => m.id ===
//      message.id)` — the confirmed id is already present, so
//      the duplicate is silently dropped.
//   3. If the API response and the Realtime event race and BOTH
//      arrive before the optimistic replacement: the Set-based
//      dedup inside addMessage still catches it.
//
// Vercel compatibility:
//   Supabase Realtime uses WebSockets managed entirely by the
//   Supabase JS client. The connection lives in the browser —
//   Vercel serverless functions are not involved at all.
// ============================================================

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import type { DbMessage, DbUser, MessageWithSender } from '@/types';

type UseRealtimeMessagesOptions = {
  conversationId: string;
  currentUser: DbUser;
  /** Callback from useMessages — appends message and deduplicates */
  onNewMessage: (message: MessageWithSender) => void;
};

export function useRealtimeMessages({
  conversationId,
  currentUser,
  onNewMessage,
}: UseRealtimeMessagesOptions) {
  // Stable ref — we must not recreate the Supabase client on each render
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);

  // Keep callback ref current without re-subscribing
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Channel name scoped per conversation — only participants receive
    // this channel's events because RLS on the messages table prevents
    // Supabase from sending rows the subscriber can't SELECT.
    const channelName = `conversation:${conversationId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Server-side filter — Supabase only broadcasts rows where
          // conversation_id matches. This is critical for performance:
          // the server filters, not the client.
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const rawMessage = payload.new as DbMessage;

          // Skip own messages — they're already in the list via
          // optimistic UI + API confirmation. The sender already has
          // the confirmed row; this realtime event is a duplicate for them.
          if (rawMessage.sender_id === currentUser.id) {
            return;
          }

          // The postgres_changes payload for messages table does NOT include
          // the joined sender profile fields (those come from the view).
          // We enrich the raw message with the sender's profile here.
          // This is a single targeted fetch by primary key — very fast.
          const { data: senderProfile } = await supabase
            .from('users')
            .select('username, full_name, avatar_url')
            .eq('id', rawMessage.sender_id ?? '')
            .single();

          const enrichedMessage: MessageWithSender = {
            ...rawMessage,
            sender_username: senderProfile?.username ?? null,
            sender_full_name: senderProfile?.full_name ?? null,
            sender_avatar_url: senderProfile?.avatar_url ?? null,
          };

          onNewMessageRef.current(enrichedMessage);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Channel error on ${channelName}`);
        }
      });

    channelRef.current = channel;

    // Cleanup: unsubscribe when conversation changes or component unmounts.
    // This is critical — leaving dangling subscriptions causes memory leaks
    // and unnecessary Supabase load.
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUser.id]);
  // Intentionally NOT including onNewMessage in deps — we use the ref.
  // Re-subscribing on every render would create/destroy channels constantly.
}
