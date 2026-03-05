// ============================================================
// src/features/chat/utils/index.ts
// ============================================================
// Pure helper functions for the chat feature.
// No Supabase calls. No React. Testable in isolation.
// ============================================================

import type { ConversationForUser, DbUser } from '@/types';
import type { ConversationListItem } from '../types';

// ─── Time Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a timestamp into a human-readable relative string.
 * Mirrors Instagram DM sidebar behaviour:
 *   - Today:      "2:34 PM"
 *   - Yesterday:  "Yesterday"
 *   - This week:  "Mon"
 *   - Older:      "12/4/24"
 */
export function formatConversationTime(isoString: string | null): string | null {
  if (!isoString) return null;

  const date = new Date(isoString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}

/**
 * Formats a full timestamp for message bubbles ("Today at 2:34 PM").
 */
export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

/**
 * Formats last_seen_at into "Active 5m ago", "Active today", etc.
 */
export function formatLastSeen(isoString: string | null): string {
  if (!isoString) return 'Offline';

  const date = new Date(isoString);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (diffMins < 1) return 'Active now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  if (diffMins < 1440) return 'Active today';
  if (diffMins < 2880) return 'Active yesterday';
  return `Active ${Math.floor(diffMins / 1440)}d ago`;
}

// ─── Display Resolution ───────────────────────────────────────────────────────

/**
 * Gets the display name for a conversation.
 * Groups → group_name
 * DMs → other user's full_name or @username
 */
export function getConversationDisplayName(
  conversation: ConversationForUser,
  otherUser: DbUser | null
): string {
  if (conversation.is_group) {
    return conversation.group_name ?? 'Group Chat';
  }
  return otherUser?.full_name ?? otherUser?.username ?? 'Unknown User';
}

/**
 * Gets the avatar URL for a conversation.
 * Groups → group_avatar_url
 * DMs → other user's avatar_url
 */
export function getConversationAvatar(
  conversation: ConversationForUser,
  otherUser: DbUser | null
): string | null {
  if (conversation.is_group) {
    return conversation.group_avatar_url ?? null;
  }
  return otherUser?.avatar_url ?? null;
}

/**
 * Gets initials from a display name for avatar fallbacks.
 * "Jane Doe" → "JD", "janedoe" → "J"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Conversation List Builder ────────────────────────────────────────────────

/**
 * Enriches a raw ConversationForUser with display fields.
 * This is the only place that computes ConversationListItem —
 * keeps the transformation logic in one testable function.
 */
export function buildConversationListItem(
  conversation: ConversationForUser,
  currentUserId: string,
  participantMap: Record<string, DbUser>
): ConversationListItem {
  // For DMs, find the other participant from the map
  const otherUser = !conversation.is_group
    ? (Object.values(participantMap).find((u) => u.id !== currentUserId) ?? null)
    : null;

  return {
    ...conversation,
    other_user: otherUser,
    display_name: getConversationDisplayName(conversation, otherUser),
    display_avatar: getConversationAvatar(conversation, otherUser),
    has_unread: conversation.unread_count > 0,
    formatted_time: formatConversationTime(conversation.last_message_at),
  };
}

// ─── Preview Text ─────────────────────────────────────────────────────────────

/**
 * Formats the last message preview for the sidebar.
 * Handles media types with emoji prefixes (already done by DB trigger,
 * but this is the client-side fallback).
 */
export function formatLastMessagePreview(
  preview: string | null,
  isCurrentUser: boolean
): string {
  if (!preview) return 'Start a conversation';
  return isCurrentUser ? `You: ${preview}` : preview;
}
