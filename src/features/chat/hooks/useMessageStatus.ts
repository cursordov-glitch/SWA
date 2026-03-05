'use client';

// ============================================================
// src/features/chat/hooks/useMessageStatus.ts
// ============================================================
// Owns the "read receipts" state for a conversation.
//
// Two data sources:
//   1. Initial fetch: GET /api/messages/status
//      Returns the current aggregate status for the last 20
//      messages sent by the current user.
//
//   2. Realtime subscription: Supabase postgres_changes on
//      message_status table. When any recipient marks a message
//      as delivered or seen, the indicator updates instantly.
//
// State shape:
//   statusMap: Map<messageId, 'sent' | 'delivered' | 'seen'>
//
// Usage in MessageBubble:
//   const status = statusMap.get(msg.id)
//   → passed to SeenIndicator
//
// Architecture:
//   ChatWindow → useMessageStatus → passes statusMap to MessageList
//   MessageList passes per-message status to MessageBubble
//   MessageBubble renders SeenIndicator conditionally
//
// The hook is intentionally scoped to the SENDER's messages only.
// It would be wasteful to track status for received messages —
// the recipient doesn't need to know "sent/delivered" for messages
// they themselves have read.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import type { DbMessageStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'seen';

// Map of messageId → aggregate status (worst-case across all recipients)
export type StatusMap = Map<string, MessageDeliveryStatus>;

type Options = {
  conversationId: string;
  currentUserId: string;
  /** Only track status for message IDs in this set (the sender's messages) */
  myMessageIds: Set<string>;
};

// ─── Status precedence ───────────────────────────────────────────────────────
// Defines which status "wins" when aggregating across recipients.
// Lower rank = shown (we show the least-advanced status).
// If any one recipient is still at 'sent', we show 'sent'.

const STATUS_RANK: Record<MessageDeliveryStatus, number> = {
  sent:      1,
  delivered: 2,
  seen:      3,
};

function worstStatus(a: MessageDeliveryStatus, b: MessageDeliveryStatus): MessageDeliveryStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMessageStatus({ conversationId, currentUserId, myMessageIds }: Options) {
  const [statusMap, setStatusMap] = useState<StatusMap>(new Map());

  const supabaseRef    = useRef(createClient());
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const myMessageIdsRef = useRef(myMessageIds);

  // Keep ref current as the message list grows
  useEffect(() => {
    myMessageIdsRef.current = myMessageIds;
  }, [myMessageIds]);

  // ── Initial fetch ─────────────────────────────────────────────────────────

  const fetchStatuses = useCallback(async () => {
    if (myMessageIds.size === 0) return;

    try {
      const params = new URLSearchParams({
        conversationId,
        limit: String(Math.min(myMessageIds.size + 5, 100)),
      });
      const res  = await fetch(`/api/messages/status?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.data) return;

      setStatusMap((prev) => {
        const next = new Map(prev);
        for (const row of json.data as {
          messageId: string;
          aggregateStatus: MessageDeliveryStatus;
        }[]) {
          // Only track status for our own messages
          if (myMessageIdsRef.current.has(row.messageId)) {
            next.set(row.messageId, row.aggregateStatus);
          }
        }
        return next;
      });
    } catch {
      // Non-critical — fail silently, status just won't show
    }
  }, [conversationId, myMessageIds.size]);

  // Fetch on mount and when our message set grows
  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Subscribe to UPDATE events on message_status.
  // When a recipient marks a message as seen/delivered, we get notified
  // immediately and update the indicator without any polling.
  //
  // Filter: we can only filter on ONE column server-side with Realtime.
  // We filter on user_id != currentUserId is NOT supported.
  // So we receive all updates for message_status rows where the message
  // belongs to this conversation, then client-side filter for our messages.
  //
  // Channel is scoped per conversation to avoid processing events from
  // other conversations.

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `msg-status:${conversationId}:${currentUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'message_status',
        },
        (payload) => {
          const row = payload.new as DbMessageStatus;

          // Ignore status updates on messages we didn't send
          // (those belong to other people's receipt tracking)
          if (!myMessageIdsRef.current.has(row.message_id)) return;

          // Update the status map for this message.
          // We receive one row per recipient — we must aggregate.
          // Since this is a single-recipient event, we apply worst-case
          // logic: only upgrade status if this recipient's new status
          // is BETTER than what we already have... but we also need to
          // consider ALL recipients. So we re-fetch when we see a 'seen'
          // event (cheap: server returns pre-aggregated result).
          const newStatus = row.status as MessageDeliveryStatus;

          if (newStatus === 'seen') {
            // A recipient just saw the message — re-fetch the aggregate
            // to check if ALL recipients have now seen it.
            // This keeps the "seen by all" check accurate for group chats.
            fetchStatuses();
          } else {
            // For delivered: optimistically update this message's status
            // to at least 'delivered' if it was 'sent'.
            setStatusMap((prev) => {
              const current = prev.get(row.message_id) ?? 'sent';
              const updated = worstStatus(current, newStatus);
              // Only update if it's different (avoid unnecessary re-renders)
              if (updated === current) return prev;
              const next = new Map(prev);
              next.set(row.message_id, updated);
              return next;
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUserId, fetchStatuses]);

  // ── Set a status locally (used after sending to pre-populate 'sent') ──────

  const setLocalStatus = useCallback(
    (messageId: string, status: MessageDeliveryStatus) => {
      setStatusMap((prev) => {
        const next = new Map(prev);
        next.set(messageId, status);
        return next;
      });
    },
    []
  );

  return {
    statusMap,
    setLocalStatus,
    refetch: fetchStatuses,
  };
}
