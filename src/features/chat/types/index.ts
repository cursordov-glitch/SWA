// ============================================================
// src/features/chat/types/index.ts
// ============================================================
// Chat-feature-specific types.
// Global DB types live in /src/types/index.ts — import from there.
// These types are for UI state and composed view models only.
// ============================================================

import type { DbUser, ConversationForUser } from '@/types';

// ─── Sidebar View Model ───────────────────────────────────────────────────────

export type ConversationListItem = ConversationForUser & {
  other_user: DbUser | null;
  display_name: string;
  display_avatar: string | null;
  has_unread: boolean;
  formatted_time: string | null;
};

// ─── Sidebar UI State ─────────────────────────────────────────────────────────

export type SidebarState = {
  conversations: ConversationListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor: string | null;
};

// ─── New Conversation Modal ───────────────────────────────────────────────────

export type NewConversationState = {
  open: boolean;
  searchQuery: string;
  searchResults: DbUser[];
  searching: boolean;
  creating: boolean;
  error: string | null;
};

// ─── Typing Indicator ────────────────────────────────────────────────────────
// Tracks who is currently typing in a conversation.

export type TypingUser = {
  userId: string;
  username: string;
  fullName: string | null;
  /** Timestamp of last keypress — used to auto-expire stale indicators */
  lastTypedAt: number;
};

// ─── Online Presence ─────────────────────────────────────────────────────────
// Lightweight presence record broadcast over Supabase Presence channels.

export type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** ISO string — updated on each heartbeat */
  onlineAt: string;
};

// ─── Realtime Channel State ───────────────────────────────────────────────────

export type TypingState = {
  /** Map of userId → TypingUser for everyone currently typing */
  typingUsers: Map<string, TypingUser>;
};

export type PresenceState = {
  /** Map of userId → PresenceUser for online users */
  onlineUsers: Map<string, PresenceUser>;
};
