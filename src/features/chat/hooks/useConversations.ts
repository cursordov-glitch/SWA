'use client';

// ============================================================
// src/features/chat/hooks/useConversations.ts
// ============================================================
// Loads all conversations for the authenticated user.
// Enriches each conversation with other-user profiles.
// Provides pagination and manual refresh.
//
// Architecture note:
// This hook owns the data-fetching concern for the sidebar.
// It calls ConversationService (service layer) and transforms
// raw DB rows into ConversationListItem (UI view model).
// The sidebar component stays pure — it only renders what
// this hook provides.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

import { createClient } from '@/lib/supabase/client';
import { ConversationService } from '@/services/conversation.service';
import { UserService } from '@/services/user.service';
import type { DbUser, PaginationParams } from '@/types';
import type { ConversationListItem, SidebarState } from '../types';
import { buildConversationListItem } from '../utils';

const PAGE_SIZE = 30;

export function useConversations(currentUserId: string | undefined) {
  const [state, setState] = useState<SidebarState>({
    conversations: [],
    loading: true,
    error: null,
    hasMore: false,
    nextCursor: null,
  });

  // Stable client refs — don't recreate on every render
  const supabaseRef = useRef(createClient());
  const convServiceRef = useRef(new ConversationService(supabaseRef.current));
  const userServiceRef = useRef(new UserService(supabaseRef.current));

  /**
   * Core fetch function.
   * 1. Fetches paginated conversations from the view
   * 2. Collects all unique participant user IDs
   * 3. Batch-fetches all participant profiles in ONE query (no N+1)
   * 4. Builds enriched ConversationListItem[] for the sidebar
   */
  const fetchConversations = useCallback(
    async (params: PaginationParams = {}, append = false) => {
      if (!currentUserId) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      const result = await convServiceRef.current.getConversations({
        limit: PAGE_SIZE,
        cursor: params.cursor,
      });

      if (result.data.length === 0 && !append) {
        setState({
          conversations: [],
          loading: false,
          error: null,
          hasMore: false,
          nextCursor: null,
        });
        return;
      }

      // ── Batch user fetch (avoids N+1) ────────────────────────────────────
      // For DMs: we need the other participant's profile.
      // We don't have participant data in the view — that would be expensive.
      // Instead, for DMs we query participants for all fetched conversations
      // in a SINGLE query, then group by conversation.

      const conversationIds = result.data.map((c) => c.id);

      // One query to get all participants across all loaded conversations
      const { data: participantRows } = await supabaseRef.current
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .is('left_at', null);

      // Collect unique user IDs (excluding current user)
      const otherUserIds = Array.from(
        new Set(
          (participantRows ?? [])
            .map((p) => p.user_id)
            .filter((id) => id !== currentUserId)
        )
      );

      // Batch-fetch all user profiles in one query
      let profileMap: Record<string, DbUser> = {};
      if (otherUserIds.length > 0) {
        const { data: profiles } = await userServiceRef.current.getUsersByIds(otherUserIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((u) => [u.id, u]));
        }
      }

      // Build per-conversation participant maps
      const convParticipantMap: Record<string, Record<string, DbUser>> = {};
      for (const row of participantRows ?? []) {
        if (!convParticipantMap[row.conversation_id]) {
          convParticipantMap[row.conversation_id] = {};
        }
        if (profileMap[row.user_id]) {
          convParticipantMap[row.conversation_id][row.user_id] = profileMap[row.user_id];
        }
      }

      // Build final view models
      const items: ConversationListItem[] = result.data.map((conv) =>
        buildConversationListItem(
          conv,
          currentUserId,
          convParticipantMap[conv.id] ?? {}
        )
      );

      setState((s) => ({
        conversations: append ? [...s.conversations, ...items] : items,
        loading: false,
        error: null,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      }));
    },
    [currentUserId]
  );

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load next page
  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loading && state.nextCursor) {
      fetchConversations({ cursor: state.nextCursor }, true);
    }
  }, [state.hasMore, state.loading, state.nextCursor, fetchConversations]);

  // Hard refresh — called after creating a new conversation
  const refresh = useCallback(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations: state.conversations,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    loadMore,
    refresh,
  };
}
