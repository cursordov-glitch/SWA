// ============================================================
// src/features/search/types/index.ts
// ============================================================

// ─── Search type filter ───────────────────────────────────────────────────────

export type SearchTab = 'all' | 'people' | 'conversations' | 'messages';

// ─── API result row types (mirror DB function return shapes) ──────────────────

export type UserResult = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  similarity: number;
};

export type ConversationResult = {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  last_read_at: string | null;
  // DM other-user fields (null for groups)
  other_user_id: string | null;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  other_is_online: boolean | null;
};

export type MessageResult = {
  message_id: string;
  conversation_id: string;
  conversation_name: string;
  is_group: boolean;
  sender_id: string;
  sender_username: string | null;
  sender_full_name: string | null;
  sender_avatar_url: string | null;
  content: string;
  message_type: string;
  created_at: string;
  rank: number;
};

// ─── Unified search state ────────────────────────────────────────────────────

export type SearchResults = {
  users: UserResult[];
  conversations: ConversationResult[];
  messages: MessageResult[];
};

export type SearchState = {
  query: string;
  tab: SearchTab;
  results: SearchResults;
  loading: boolean;
  error: string | null;
  /** true after at least one search has completed */
  hasSearched: boolean;
};

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Total result count across all tabs */
export function totalResults(results: SearchResults): number {
  return results.users.length + results.conversations.length + results.messages.length;
}

/** Count for a specific tab */
export function tabCount(tab: SearchTab, results: SearchResults): number {
  if (tab === 'all') return totalResults(results);
  if (tab === 'people') return results.users.length;
  if (tab === 'conversations') return results.conversations.length;
  if (tab === 'messages') return results.messages.length;
  return 0;
}
