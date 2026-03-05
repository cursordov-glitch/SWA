'use client';

// ============================================================
// src/features/chat/hooks/useTypingIndicator.ts
// ============================================================
// Manages the "User is typing…" indicator for a conversation.
//
// Uses Supabase Broadcast (not postgres_changes).
// Broadcast is the right tool here because:
//   - Typing state is ephemeral — it does NOT need to be stored in DB
//   - It needs ultra-low latency (<100ms round trip)
//   - It generates very high event frequency (every keystroke)
//   - postgres_changes would create unnecessary DB write load
//
// Channel: typing:{conversationId}
// Events:
//   - "typing"         → user started/continued typing
//   - "stopped_typing" → user stopped typing
//
// Auto-expire:
//   If a "stopped_typing" event is never received (e.g. user
//   closes tab while typing), the indicator self-clears after
//   TYPING_EXPIRE_MS milliseconds via a per-user timeout.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import type { DbUser } from '@/types';
import type { TypingUser } from '../types';

// How long after the last "typing" broadcast before we auto-clear
const TYPING_EXPIRE_MS = 3000;
// Minimum ms between outgoing "typing" broadcasts (rate limiting)
const BROADCAST_THROTTLE_MS = 1000;

type UseTypingIndicatorOptions = {
  conversationId: string;
  currentUser: DbUser;
};

export function useTypingIndicator({
  conversationId,
  currentUser,
}: UseTypingIndicatorOptions) {
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Per-user expiry timers — cleared when stopped_typing arrives or on expire
  const expiryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track when we last broadcast to throttle outgoing events
  const lastBroadcastRef = useRef<number>(0);
  // True if we've broadcast a "typing" and need to send "stopped_typing"
  const isTypingRef = useRef(false);
  // Timer to auto-send stopped_typing after user pauses
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Clear a user from the typing map ─────────────────────────────────────

  const clearTypingUser = useCallback((userId: string) => {
    const timer = expiryTimersRef.current.get(userId);
    if (timer) {
      clearTimeout(timer);
      expiryTimersRef.current.delete(userId);
    }
    setTypingUsers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  // ── Subscribe to broadcast events ────────────────────────────────────────

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channelName = `typing:${conversationId}`;

    const channel = supabase
      .channel(channelName)
      // Listen for "typing" broadcasts from other users
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, username, fullName } = payload as {
          userId: string;
          username: string;
          fullName: string | null;
        };

        // Never show current user typing to themselves
        if (userId === currentUser.id) return;

        // Reset expiry timer for this user
        const existing = expiryTimersRef.current.get(userId);
        if (existing) clearTimeout(existing);

        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(userId, {
            userId,
            username,
            fullName,
            lastTypedAt: Date.now(),
          });
          return next;
        });

        // Auto-expire after TYPING_EXPIRE_MS if no further events
        const timer = setTimeout(() => {
          clearTypingUser(userId);
        }, TYPING_EXPIRE_MS);

        expiryTimersRef.current.set(userId, timer);
      })
      // Listen for "stopped_typing" broadcasts
      .on('broadcast', { event: 'stopped_typing' }, ({ payload }) => {
        const { userId } = payload as { userId: string };
        if (userId === currentUser.id) return;
        clearTypingUser(userId);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Clear all expiry timers on unmount
      expiryTimersRef.current.forEach((timer) => clearTimeout(timer));
      expiryTimersRef.current.clear();

      // Send stopped_typing if we were typing when unmounting
      if (isTypingRef.current && channel) {
        channel.send({
          type: 'broadcast',
          event: 'stopped_typing',
          payload: { userId: currentUser.id },
        });
      }

      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);

      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUser.id, clearTypingUser]);

  // ── Outgoing: notify others that current user is typing ──────────────────

  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const now = Date.now();

    // Throttle: don't broadcast more than once per BROADCAST_THROTTLE_MS
    if (now - lastBroadcastRef.current < BROADCAST_THROTTLE_MS) {
      // Just reset the stop-typing timer without re-broadcasting
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = setTimeout(() => notifyStoppedTyping(), TYPING_EXPIRE_MS);
      return;
    }

    lastBroadcastRef.current = now;
    isTypingRef.current = true;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.full_name,
      },
    });

    // Auto-send stopped_typing after the user pauses
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => notifyStoppedTyping(), TYPING_EXPIRE_MS);
  }, [currentUser]);

  const notifyStoppedTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !isTypingRef.current) return;

    isTypingRef.current = false;

    channel.send({
      type: 'broadcast',
      event: 'stopped_typing',
      payload: { userId: currentUser.id },
    });
  }, [currentUser.id]);

  // ── Derived display string ────────────────────────────────────────────────

  const typingText = buildTypingText(typingUsers);

  return {
    typingUsers,
    typingText,
    notifyTyping,
    notifyStoppedTyping,
  };
}

// ─── Helper: build human-readable typing string ──────────────────────────────
// "Jane is typing…"
// "Jane and Bob are typing…"
// "3 people are typing…"

function buildTypingText(typingUsers: Map<string, TypingUser>): string | null {
  const users = Array.from(typingUsers.values());
  if (users.length === 0) return null;

  const names = users.map((u) => u.fullName?.split(' ')[0] ?? u.username);

  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}
