'use client';

// ============================================================
// src/features/chat/hooks/useMessages.ts
// ============================================================
// Step 7: injectMessage, replaceMessage, failMessage (image upload)
// Step 11 additions:
//   - sendReply(content, replyToId)  — send a reply with optimistic update
//   - updateReactions(id, reactions) — optimistic reaction toggle from useReactions
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MessageWithSender, DbUser, ReactionMap } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptimisticMessage = MessageWithSender & {
  isOptimistic?: boolean;
  hasFailed?: boolean;
};

type MessagesState = {
  messages: OptimisticMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  error: string | null;
  sending: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMessages(conversationId: string, currentUser: DbUser) {
  const [state, setState] = useState<MessagesState>({
    messages: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    nextCursor: null,
    error: null,
    sending: false,
  });

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // ── Initial fetch + mark seen ─────────────────────────────────────────────

  const fetchMessages = useCallback(async (cursor?: string, append = false) => {
    const cid = conversationIdRef.current;
    setState((s) => ({ ...s, loading: !append, loadingMore: append, error: null }));

    try {
      const params = new URLSearchParams({ conversationId: cid, limit: '40' });
      if (cursor) params.set('cursor', cursor);

      const res  = await fetch(`/api/messages/list?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, loadingMore: false, error: json.error ?? 'Failed to load messages' }));
        return;
      }

      // API returns newest→oldest DESC; reverse to oldest→newest for display
      const incoming: OptimisticMessage[] = [...(json.data ?? [])].reverse();
      setState((s) => ({
        ...s,
        messages: append ? [...incoming, ...s.messages] : incoming,
        loading: false,
        loadingMore: false,
        hasMore: json.hasMore ?? false,
        nextCursor: json.nextCursor ?? null,
        error: null,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false, loadingMore: false, error: 'Network error. Please try again.' }));
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    fetch('/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
  }, [conversationId, fetchMessages]);

  // ── Pagination ────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!state.hasMore || state.loadingMore || !state.nextCursor) return;
    fetchMessages(state.nextCursor, true);
  }, [state.hasMore, state.loadingMore, state.nextCursor, fetchMessages]);

  // ── Text message send (optimistic) ────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || state.sending) return false;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: OptimisticMessage = {
        id: optimisticId,
        conversation_id: conversationIdRef.current,
        sender_id: currentUser.id,
        message_type: 'text',
        content: trimmed,
        media_url: null,
        media_type: null,
        media_metadata: null,
        reply_to_id: null,
        reactions: {},
        deleted_at: null,
        deleted_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_username: currentUser.username,
        sender_full_name: currentUser.full_name,
        sender_avatar_url: currentUser.avatar_url,
        isOptimistic: true,
      };

      setState((s) => ({ ...s, messages: [...s.messages, optimisticMsg], sending: true }));

      try {
        const res  = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            content: trimmed,
            messageType: 'text',
          }),
        });
        const json = await res.json();

        if (!res.ok || !json.data) {
          setState((s) => ({
            ...s,
            sending: false,
            messages: s.messages.map((m) => m.id === optimisticId ? { ...m, hasFailed: true } : m),
          }));
          return false;
        }

        const confirmed: OptimisticMessage = {
          ...json.data,
          sender_username: currentUser.username,
          sender_full_name: currentUser.full_name,
          sender_avatar_url: currentUser.avatar_url,
          isOptimistic: false,
        };
        setState((s) => ({
          ...s,
          sending: false,
          messages: s.messages.map((m) => m.id === optimisticId ? confirmed : m),
        }));
        return true;
      } catch {
        setState((s) => ({
          ...s,
          sending: false,
          messages: s.messages.map((m) => m.id === optimisticId ? { ...m, hasFailed: true } : m),
        }));
        return false;
      }
    },
    [state.sending, currentUser]
  );

  // ── Retry failed text message ────────────────────────────────────────────

  const retryMessage = useCallback(
    async (optimisticId: string) => {
      const msg = state.messages.find((m) => m.id === optimisticId);
      if (!msg?.content || msg.message_type !== 'text') return;
      setState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== optimisticId) }));
      await sendMessage(msg.content);
    },
    [state.messages, sendMessage]
  );

  // ── Reply (Step 11) ──────────────────────────────────────────────────────
  // Same optimistic pattern as sendMessage but includes reply_to_id.
  // The quoted preview is rendered in MessageBubble by looking up the
  // parent message from the local messages array — no extra DB call.

  const sendReply = useCallback(
    async (content: string, replyToId: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || state.sending) return false;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: OptimisticMessage = {
        id: optimisticId,
        conversation_id: conversationIdRef.current,
        sender_id: currentUser.id,
        message_type: 'text',
        content: trimmed,
        media_url: null,
        media_type: null,
        media_metadata: null,
        reply_to_id: replyToId,
        reactions: {},
        deleted_at: null,
        deleted_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_username: currentUser.username,
        sender_full_name: currentUser.full_name,
        sender_avatar_url: currentUser.avatar_url,
        isOptimistic: true,
      };

      setState((s) => ({ ...s, messages: [...s.messages, optimisticMsg], sending: true }));

      try {
        const res  = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            content: trimmed,
            messageType: 'text',
            replyToId,
          }),
        });
        const json = await res.json();

        if (!res.ok || !json.data) {
          setState((s) => ({
            ...s, sending: false,
            messages: s.messages.map((m) => m.id === optimisticId ? { ...m, hasFailed: true } : m),
          }));
          return false;
        }

        const confirmed: OptimisticMessage = {
          ...json.data,
          sender_username: currentUser.username,
          sender_full_name: currentUser.full_name,
          sender_avatar_url: currentUser.avatar_url,
          isOptimistic: false,
        };
        setState((s) => ({
          ...s, sending: false,
          messages: s.messages.map((m) => m.id === optimisticId ? confirmed : m),
        }));
        return true;
      } catch {
        setState((s) => ({
          ...s, sending: false,
          messages: s.messages.map((m) => m.id === optimisticId ? { ...m, hasFailed: true } : m),
        }));
        return false;
      }
    },
    [state.sending, currentUser]
  );

  // ── Optimistic reaction update (Step 11) ──────────────────────────────────
  // Called by useReactions immediately after the user clicks an emoji.
  // The API call happens in parallel; this keeps the UI instant.

  const updateReactions = useCallback(
    (messageId: string, reactions: ReactionMap) => {
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      }));
    },
    []
  );

  // ── Realtime / image upload message operations ────────────────────────────

  /** Append a message (from realtime or image upload). Deduplicates by ID. */
  const addMessage = useCallback((message: MessageWithSender) => {
    setState((s) => {
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { ...s, messages: [...s.messages, message] };
    });
  }, []);

  /** Inject any message shape (used by useImageUpload for optimistic images). */
  const injectMessage = useCallback((message: OptimisticMessage) => {
    setState((s) => {
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { ...s, messages: [...s.messages, message] };
    });
  }, []);

  /** Replace an optimistic stub (by ID) with the confirmed server row. */
  const replaceMessage = useCallback((optimisticId: string, confirmed: MessageWithSender) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === optimisticId
          ? { ...confirmed, isOptimistic: false, hasFailed: false }
          : m
      ),
    }));
  }, []);

  /** Mark an optimistic stub as failed. */
  const failMessage = useCallback((optimisticId: string) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === optimisticId ? { ...m, hasFailed: true, isOptimistic: false } : m
      ),
    }));
  }, []);

  return {
    messages: state.messages,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.error,
    sending: state.sending,
    sendMessage,
    retryMessage,
    loadMore,
    addMessage,      // Step 6: realtime
    injectMessage,   // Step 7: image upload optimistic
    replaceMessage,  // Step 7: swap optimistic → confirmed
    failMessage,     // Step 7: mark as failed
    sendReply,       // Step 11: reply with quoted preview
    updateReactions, // Step 11: optimistic reaction toggle
  };
}
