'use client';

// ============================================================
// src/features/chat/hooks/usePresence.ts
// ============================================================
// Tracks which users are currently online in a conversation
// using Supabase Presence.
//
// Supabase Presence is different from Broadcast:
//   - Presence maintains a shared state (who is connected)
//   - It auto-removes users when they disconnect (tab close, network drop)
//   - No need to manually send "I went offline" — the server handles it
//
// Channel: presence:{conversationId}
//
// How it works:
//   1. On mount: join the channel and "track" our presence
//   2. Supabase merges all tracked presences into a shared state
//   3. onSync fires whenever anyone joins/leaves
//   4. On unmount: the channel is removed, Supabase auto-broadcasts leave
//
// The green dot in ConversationItem (sidebar) and ChatHeader uses
// the `is_online` DB field (updated on sign-in/out).
// THIS hook provides real-time within-conversation presence —
// it's more accurate and updates instantly without a DB write.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import type { DbUser } from '@/types';
import type { PresenceUser } from '../types';

type UsePresenceOptions = {
  conversationId: string;
  currentUser: DbUser;
};

export function usePresence({ conversationId, currentUser }: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceUser>>(new Map());

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Scoped per conversation — only users in this chat contribute presence
    const channelName = `presence:${conversationId}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUser.id, // unique key per user in this channel
        },
      },
    });

    channel
      // onSync fires on initial join and whenever any user's presence changes
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<{
          userId: string;
          username: string;
          avatarUrl: string | null;
          onlineAt: string;
        }>();

        const nextMap = new Map<string, PresenceUser>();

        // presenceState is keyed by the presence key (userId).
        // Each key maps to an array of presence objects (one per tab/device).
        for (const [userId, presences] of Object.entries(presenceState)) {
          if (presences.length > 0) {
            const p = presences[0]; // take first presence per user
            nextMap.set(userId, {
              userId: p.userId,
              username: p.username,
              avatarUrl: p.avatarUrl,
              onlineAt: p.onlineAt,
            });
          }
        }

        setOnlineUsers(nextMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our own presence — this is what gets broadcast to others
          await channel.track({
            userId: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatar_url,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      // untrack() signals our departure; removeChannel() tears down the WS sub
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUser.id, currentUser.username, currentUser.avatar_url]);

  // ── Derived helpers ───────────────────────────────────────────────────────

  const isUserOnline = useCallback(
    (userId: string): boolean => onlineUsers.has(userId),
    [onlineUsers]
  );

  const onlineCount = onlineUsers.size;

  return {
    onlineUsers,
    isUserOnline,
    onlineCount,
  };
}
