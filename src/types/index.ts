// ============================================================
// ChatApp — Shared TypeScript Types
// src/types/index.ts
// ============================================================
// These types mirror the Supabase PostgreSQL schema exactly.
// For auto-generated types run: npx supabase gen types typescript
// ============================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';

export type MessageStatusType = 'sending' | 'sent' | 'delivered' | 'seen';

export type ParticipantRole = 'member' | 'admin';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

// ─── Database Row Types (mirror DB columns exactly) ──────────────────────────

export type DbUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbConversation = {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  created_by: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ParticipantRole;
  last_read_at: string | null;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  left_at: string | null;
  joined_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  message_type: MessageType;
  content: string | null;
  media_url: string | null;
  media_type: MediaType | null;
  media_metadata: MediaMetadata | null;
  reply_to_id: string | null;
  reactions: ReactionMap;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DbMessageStatus = {
  id: string;
  message_id: string;
  user_id: string;
  status: MessageStatusType;
  delivered_at: string | null;
  seen_at: string | null;
};

export type DbMediaAttachment = {
  id: string;
  message_id: string;
  uploader_id: string | null;
  storage_path: string;
  public_url: string;
  media_type: MediaType;
  mime_type: string;
  file_name: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  blur_hash: string | null;
  created_at: string;
};

// ─── JSONB Shapes ─────────────────────────────────────────────────────────────

export type MediaMetadata = {
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  mime_type?: string;
  blur_hash?: string;
};

/** { "❤️": ["user_id_1", "user_id_2"] } */
export type ReactionMap = Record<string, string[]>;

// ─── View Types (match DB views) ─────────────────────────────────────────────

/** Matches v_conversations_for_user */
export type ConversationForUser = DbConversation & {
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  last_read_at: string | null;
};

/** Matches v_messages_with_sender */
export type MessageWithSender = DbMessage & {
  sender_username: string | null;
  sender_full_name: string | null;
  sender_avatar_url: string | null;
};

// ─── Enriched Application Types ───────────────────────────────────────────────
// These are built by the service layer joining multiple tables together.

export type ConversationWithParticipants = DbConversation & {
  participants: ParticipantWithProfile[];
  last_message: DbMessage | null;
  unread_count: number;
  /** For DMs: the other user's profile */
  other_user?: DbUser;
};

export type ParticipantWithProfile = DbConversationParticipant & {
  profile: DbUser;
};

export type MessageWithDetails = DbMessage & {
  sender: DbUser | null;
  status: DbMessageStatus[];
  attachments: DbMediaAttachment[];
  reply_to: DbMessage | null;
};

// ─── Service Input / DTO Types ────────────────────────────────────────────────

export type CreateConversationInput = {
  otherUserId: string;
};

export type CreateGroupConversationInput = {
  groupName: string;
  participantIds: string[];
  groupAvatarUrl?: string;
};

export type SendMessageInput = {
  conversationId: string;
  content?: string;
  messageType?: MessageType;
  mediaUrl?: string;
  mediaType?: MediaType;
  mediaMetadata?: MediaMetadata;
  replyToId?: string;
};

export type UpdateProfileInput = {
  username?: string;
  full_name?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
};

export type UpdatePresenceInput = {
  is_online: boolean;
  last_seen_at?: string;
};

// ─── API / Service Response Wrappers ─────────────────────────────────────────

export type ServiceResponse<T> = {
  data: T | null;
  error: ServiceError | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  count: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type ServiceError = {
  message: string;
  code?: string;
  status?: number;
};

// ─── Realtime Payload Types ───────────────────────────────────────────────────

export type RealtimeMessagePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: DbMessage | null;
  old: DbMessage | null;
};

export type RealtimePresencePayload = {
  userId: string;
  is_online: boolean;
  last_seen_at: string;
};

export type RealtimeStatusPayload = {
  eventType: 'UPDATE';
  new: DbMessageStatus;
  old: DbMessageStatus;
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationParams = {
  limit?: number;
  cursor?: string;    // created_at ISO string for cursor-based pagination
};
