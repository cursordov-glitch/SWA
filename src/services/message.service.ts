// ============================================================
// src/services/message.service.ts
// ============================================================
// Handles all message-level operations:
//   - sending text and media messages
//   - cursor-based paginated message loading
//   - realtime subscriptions
//   - reactions, edits, soft deletes
//   - message status (delivered/seen)
//   - media uploads to Supabase Storage
// ============================================================

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

import type {
  DbMessage,
  DbMessageStatus,
  MessageWithDetails,
  MessageWithSender,
  PaginatedResponse,
  PaginationParams,
  RealtimeMessagePayload,
  SendMessageInput,
  ServiceError,
  ServiceResponse,
} from '@/types';

import { BaseService } from './base.service';

export class MessageService extends BaseService {
  constructor(client: SupabaseClient) {
    super(client);
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  /**
   * Load messages for a conversation using cursor-based pagination.
   * Newest messages first (DESC), UI reverses the array for display.
   * Cursor = created_at of the oldest message currently loaded.
   */
  async getMessages(
    conversationId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<MessageWithSender>> {
    const { limit = 40, cursor } = params;

    let query = this.client
      .from('v_messages_with_sender')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Cursor pagination: load messages older than the cursor
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, count, error } = await query;

    if (error || !data) {
      return { data: [], count: 0, hasMore: false, nextCursor: null };
    }

    const hasMore = data.length > limit;
    const results = (hasMore ? data.slice(0, limit) : data) as MessageWithSender[];
    const nextCursor = hasMore ? results[results.length - 1].created_at : null;

    return { data: results, count: count ?? 0, hasMore, nextCursor };
  }

  /**
   * Get a single message with sender, status, attachments, and reply.
   */
  async getMessageById(messageId: string): Promise<ServiceResponse<MessageWithDetails>> {
    const { data: message, error } = await this.client
      .from('messages')
      .select(`
        *,
        sender:users (*),
        status:message_status (*),
        attachments:media_attachments (*),
        reply_to:messages!reply_to_id (*)
      `)
      .eq('id', messageId)
      .is('deleted_at', null)
      .single();

    if (error || !message) {
      return { data: null, error: { message: error?.message ?? 'Message not found' } };
    }

    return { data: message as MessageWithDetails, error: null };
  }

  // ─── Send ────────────────────────────────────────────────────────────────────

  /**
   * Send a text or media message to a conversation.
   * The DB trigger auto-creates message_status rows for all recipients.
   * The DB trigger auto-updates conversations.last_message_*.
   */
  async sendMessage(input: SendMessageInput): Promise<ServiceResponse<DbMessage>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const payload = {
      conversation_id: input.conversationId,
      sender_id: user.id,
      message_type: input.messageType ?? 'text',
      content: input.content ?? null,
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
      media_metadata: input.mediaMetadata ?? null,
      reply_to_id: input.replyToId ?? null,
    };

    return this.execute<DbMessage>(() =>
      this.client.from('messages').insert(payload).select().single()
    );
  }

  /**
   * Upload media to Supabase Storage then send a message with the URL.
   * File path pattern: {userId}/messages/{conversationId}/{timestamp}.{ext}
   */
  async sendMediaMessage(
    conversationId: string,
    file: File,
    replyToId?: string
  ): Promise<ServiceResponse<DbMessage>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    // 1. Upload to Storage
    const ext = file.name.split('.').pop() ?? 'bin';
    const timestamp = Date.now();
    const path = `${user.id}/messages/${conversationId}/${timestamp}.${ext}`;

    const { error: uploadError } = await this.client.storage
      .from('chat-media')
      .upload(path, file);

    if (uploadError) {
      return { data: null, error: { message: uploadError.message } };
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from('chat-media').getPublicUrl(path);

    // 2. Determine media type from MIME
    const mediaType = this.getMediaTypeFromMime(file.type);
    const messageType = mediaType === 'document' ? 'file' : mediaType;

    // 3. Send the message
    const { data: message, error: msgError } = await this.sendMessage({
      conversationId,
      messageType: messageType as 'image' | 'video' | 'audio' | 'file',
      mediaUrl: publicUrl,
      mediaType,
      mediaMetadata: {
        size: file.size,
        mime_type: file.type,
      },
      replyToId,
    });

    if (msgError || !message) {
      // Clean up orphan storage file
      await this.client.storage.from('chat-media').remove([path]);
      return { data: null, error: msgError ?? { message: 'Failed to send message' } };
    }

    // 4. Create media_attachment record for rich metadata
    await this.client.from('media_attachments').insert({
      message_id: message.id,
      uploader_id: user.id,
      storage_path: path,
      public_url: publicUrl,
      media_type: mediaType,
      mime_type: file.type,
      file_name: file.name,
      file_size_bytes: file.size,
    });

    return { data: message, error: null };
  }

  // ─── Edit & Delete ───────────────────────────────────────────────────────────

  /**
   * Edit the text content of an existing message (sender only).
   */
  async editMessage(
    messageId: string,
    newContent: string
  ): Promise<ServiceResponse<DbMessage>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    return this.execute<DbMessage>(() =>
      this.client
        .from('messages')
        .update({
          content: newContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id)
        .is('deleted_at', null)
        .select()
        .single()
    );
  }

  /**
   * Soft-delete (unsend) a message. Sets deleted_at and deleted_by.
   * The RLS policy on v_messages_with_sender filters deleted_at IS NULL,
   * so recipients will no longer see this message.
   */
  async deleteMessage(messageId: string): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', messageId)
        .eq('sender_id', user.id)
    );
  }

  // ─── Reactions ───────────────────────────────────────────────────────────────

  /**
   * Toggle a reaction emoji on a message.
   * If the user already reacted with this emoji, it's removed (toggle).
   * Uses optimistic JSON manipulation to avoid a full row lock.
   */
  async toggleReaction(
    messageId: string,
    emoji: string
  ): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    // Fetch current reactions
    const { data: message } = await this.client
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (!message) return { message: 'Message not found' };

    const reactions: Record<string, string[]> = message.reactions ?? {};
    const currentUsers = reactions[emoji] ?? [];
    const hasReacted = currentUsers.includes(user.id);

    const updatedUsers = hasReacted
      ? currentUsers.filter((id) => id !== user.id)
      : [...currentUsers, user.id];

    const updatedReactions = { ...reactions };
    if (updatedUsers.length === 0) {
      delete updatedReactions[emoji];
    } else {
      updatedReactions[emoji] = updatedUsers;
    }

    return this.executeVoid(() =>
      this.client
        .from('messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId)
    );
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  /**
   * Get delivery/read status for all recipients of a message.
   * Used to show "seen by" indicators.
   */
  async getMessageStatuses(
    messageId: string
  ): Promise<ServiceResponse<DbMessageStatus[]>> {
    return this.execute<DbMessageStatus[]>(() =>
      this.client
        .from('message_status')
        .select('*')
        .eq('message_id', messageId)
    );
  }

  /**
   * Mark a specific message as delivered for the current user.
   */
  async markDelivered(messageId: string): Promise<ServiceError | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('message_status')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('status', 'sent') // only update if not already further ahead
    );
  }

  // ─── Realtime ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to new/updated messages in a conversation.
   * Returns the RealtimeChannel — caller must call channel.unsubscribe() on unmount.
   */
  subscribeToMessages(
    conversationId: string,
    onMessage: (payload: RealtimeMessagePayload) => void
  ): RealtimeChannel {
    return this.client
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessage({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: (payload.new as DbMessage) ?? null,
            old: (payload.old as DbMessage) ?? null,
          });
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to message status changes for messages sent by the current user.
   * Used to update "seen" ticks in the UI.
   */
  subscribeToMessageStatus(
    conversationId: string,
    onStatus: (status: DbMessageStatus) => void
  ): RealtimeChannel {
    return this.client
      .channel(`message-status:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_status',
        },
        (payload) => {
          onStatus(payload.new as DbMessageStatus);
        }
      )
      .subscribe();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getMediaTypeFromMime(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
