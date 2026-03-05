// ============================================================
// src/services/conversation.service.ts
// ============================================================
// Handles all conversation-level operations:
//   - creating DMs and group chats
//   - listing conversations for the sidebar
//   - participant management (add, remove, mute, pin, archive)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ConversationForUser,
  ConversationWithParticipants,
  CreateConversationInput,
  CreateGroupConversationInput,
  DbConversation,
  PaginatedResponse,
  PaginationParams,
  ParticipantWithProfile,
  ServiceError,
  ServiceResponse,
} from '@/types';

import { BaseService } from './base.service';

export class ConversationService extends BaseService {
  constructor(client: SupabaseClient) {
    super(client);
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  /**
   * Get all conversations for the current user.
   * Uses the v_conversations_for_user view for unread counts.
   * Supports cursor-based pagination (cursor = last_message_at).
   */
  async getConversations(
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<ConversationForUser>> {
    const { limit = 30, cursor } = params;

    let query = this.client
      .from('v_conversations_for_user')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('last_message_at', cursor);
    }

    const { data, count, error } = await query;

    if (error || !data) {
      return { data: [], count: 0, hasMore: false, nextCursor: null };
    }

    const hasMore = data.length > limit;
    const results = (hasMore ? data.slice(0, limit) : data) as ConversationForUser[];
    const nextCursor = hasMore ? results[results.length - 1].last_message_at : null;

    return { data: results, count: count ?? 0, hasMore, nextCursor };
  }

  /**
   * Get a single conversation with all participant profiles.
   * Used for the chat header and group info panel.
   */
  async getConversationById(
    conversationId: string
  ): Promise<ServiceResponse<ConversationWithParticipants>> {
    const { data: conversation, error: convError } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .is('deleted_at', null)
      .single();

    if (convError || !conversation) {
      return { data: null, error: { message: convError?.message ?? 'Conversation not found' } };
    }

    // Fetch participants with their profiles in one query
    const { data: participantRows, error: partError } = await this.client
      .from('conversation_participants')
      .select(`
        *,
        profile:users (*)
      `)
      .eq('conversation_id', conversationId)
      .is('left_at', null);

    if (partError) {
      return { data: null, error: { message: partError.message } };
    }

    const participants = (participantRows ?? []) as ParticipantWithProfile[];

    // Fetch last message if present
    let last_message = null;
    if (conversation.last_message_id) {
      const { data: msgData } = await this.client
        .from('messages')
        .select('*')
        .eq('id', conversation.last_message_id)
        .single();
      last_message = msgData;
    }

    // Get current user to find "other" participant in DMs
    const {
      data: { user: currentUser },
    } = await this.client.auth.getUser();

    const other_user = !conversation.is_group && currentUser
      ? participants.find((p) => p.user_id !== currentUser.id)?.profile ?? undefined
      : undefined;

    return {
      data: {
        ...(conversation as DbConversation),
        participants,
        last_message,
        unread_count: 0, // loaded separately from the view
        other_user,
      },
      error: null,
    };
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  /**
   * Create or return an existing DM with another user.
   * Delegates to the get_or_create_dm DB function (prevents duplicates).
   */
  async createDirectMessage(
    input: CreateConversationInput
  ): Promise<ServiceResponse<string>> {
    const { data, error } = await this.client.rpc('get_or_create_dm', {
      other_user_id: input.otherUserId,
    });

    if (error) return { data: null, error: { message: error.message } };
    return { data: data as string, error: null };
  }

  /**
   * Create a new group conversation.
   */
  async createGroupConversation(
    input: CreateGroupConversationInput
  ): Promise<ServiceResponse<DbConversation>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const uniqueIds = Array.from(new Set([...input.participantIds, user.id]));
    if (uniqueIds.length < 2) {
      return { data: null, error: { message: 'A group needs at least 2 participants' } };
    }

    // Create the conversation
    const { data: conversation, error: convError } = await this.client
      .from('conversations')
      .insert({
        is_group: true,
        group_name: input.groupName,
        group_avatar_url: input.groupAvatarUrl ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (convError || !conversation) {
      return { data: null, error: { message: convError?.message ?? 'Failed to create group' } };
    }

    // Add all participants
    const participantRows = uniqueIds.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
      role: userId === user.id ? 'admin' : 'member',
    }));

    const { error: partError } = await this.client
      .from('conversation_participants')
      .insert(participantRows);

    if (partError) {
      // Rollback: delete the conversation
      await this.client.from('conversations').delete().eq('id', conversation.id);
      return { data: null, error: { message: partError.message } };
    }

    return { data: conversation as DbConversation, error: null };
  }

  // ─── Participant Management ──────────────────────────────────────────────────

  /**
   * Add a user to a group conversation (admin only in app layer).
   */
  async addParticipant(
    conversationId: string,
    userId: string
  ): Promise<ServiceError | null> {
    return this.executeVoid(() =>
      this.client.from('conversation_participants').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'member',
      })
    );
  }

  /**
   * Leave a group (soft delete: sets left_at).
   */
  async leaveConversation(conversationId: string): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    );
  }

  /**
   * Toggle muted state for a conversation.
   */
  async toggleMute(
    conversationId: string,
    muted: boolean
  ): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('conversation_participants')
        .update({ is_muted: muted })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    );
  }

  /**
   * Toggle pinned state for a conversation.
   */
  async togglePin(
    conversationId: string,
    pinned: boolean
  ): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('conversation_participants')
        .update({ is_pinned: pinned })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    );
  }

  /**
   * Archive / unarchive a conversation for the current user.
   */
  async toggleArchive(
    conversationId: string,
    archived: boolean
  ): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('conversation_participants')
        .update({ is_archived: archived })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    );
  }

  /**
   * Mark all messages in a conversation as seen.
   * Delegates to the mark_messages_seen DB function.
   */
  async markAsSeen(conversationId: string): Promise<ServiceError | null> {
    const { error } = await this.client.rpc('mark_messages_seen', {
      p_conversation_id: conversationId,
    });
    return error ? { message: error.message } : null;
  }

  /**
   * Get the total unread message count across all conversations.
   * Used for the notification badge in the nav.
   */
  async getTotalUnreadCount(): Promise<number> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return 0;

    const { count } = await this.client
      .from('message_status')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'seen');

    return count ?? 0;
  }

  // ─── Realtime ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to conversation list changes for the current user.
   * Returns the channel — caller must call .unsubscribe() on cleanup.
   */
  subscribeToConversationUpdates(
    userId: string,
    onUpdate: (conversationId: string) => void
  ) {
    return this.client
      .channel(`user-conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string };
          if (row?.id) onUpdate(row.id);
        }
      )
      .subscribe();
  }
}
