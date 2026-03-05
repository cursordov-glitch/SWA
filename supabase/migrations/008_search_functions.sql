-- ============================================================
-- supabase/migrations/008_search_functions.sql
-- ============================================================
-- DB functions that power the Step 10 search system.
-- All functions run SECURITY DEFINER so they can perform the
-- participant check internally, then filter results by RLS.
--
-- Three search surfaces:
--   1. search_users()          — people search (trigram + FTS)
--   2. search_messages()       — message content FTS (own convos)
--   3. search_conversations()  — conversation name / last-message
--
-- Indexes already exist from migration 002:
--   idx_users_username_trgm     GIN trigram on users.username
--   idx_users_search            GIN FTS on username || full_name
--   idx_messages_content_fts    GIN FTS on messages.content
--   idx_conversations_last_msg  BTREE on last_message_at DESC
-- ============================================================

-- ─── 1. User search ───────────────────────────────────────────────────────────
-- Returns users whose username or full_name matches the query.
-- Uses trigram similarity for fuzzy matching ("jhn" finds "john").
-- Excludes the calling user from results.
-- Ordered by similarity score DESC so closest matches come first.

CREATE OR REPLACE FUNCTION search_users(
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  full_name     TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  is_online     BOOLEAN,
  last_seen_at  TIMESTAMPTZ,
  similarity    REAL
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.bio,
    u.is_online,
    u.last_seen_at,
    -- Trigram similarity score: 0.0 (no match) → 1.0 (exact)
    GREATEST(
      similarity(u.username,   p_query),
      similarity(COALESCE(u.full_name, ''), p_query)
    ) AS similarity
  FROM public.users u
  WHERE
    u.deleted_at IS NULL
    AND u.id != auth.uid()
    AND (
      -- Trigram similarity (handles typos, partial matches)
      u.username   % p_query
      OR u.username    ILIKE '%' || p_query || '%'
      OR COALESCE(u.full_name, '') ILIKE '%' || p_query || '%'
      -- Full-text search (handles multi-word queries)
      OR to_tsvector('english', COALESCE(u.username,'') || ' ' || COALESCE(u.full_name,''))
         @@ plainto_tsquery('english', p_query)
    )
  ORDER BY similarity DESC, u.username ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION search_users IS
  'Fuzzy user search using trigram + ILIKE + FTS. Excludes calling user.
   Ordered by similarity score. Uses idx_users_username_trgm and idx_users_search.';

-- ─── 2. Message search ────────────────────────────────────────────────────────
-- Full-text search across message content in conversations
-- the current user participates in.
-- Returns matched messages with sender profile and conversation info.
-- Ordered by relevance rank DESC, then recency.

CREATE OR REPLACE FUNCTION search_messages(
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  message_id          UUID,
  conversation_id     UUID,
  conversation_name   TEXT,
  is_group            BOOLEAN,
  sender_id           UUID,
  sender_username     TEXT,
  sender_full_name    TEXT,
  sender_avatar_url   TEXT,
  content             TEXT,
  message_type        TEXT,
  created_at          TIMESTAMPTZ,
  rank                REAL
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH my_conversations AS (
    -- Only search conversations the user participates in
    SELECT cp.conversation_id
    FROM public.conversation_participants cp
    WHERE cp.user_id  = auth.uid()
      AND cp.left_at  IS NULL
  ),
  ranked AS (
    SELECT
      m.id              AS message_id,
      m.conversation_id,
      -- Conversation display name: group_name or the other user's name
      CASE
        WHEN c.is_group THEN COALESCE(c.group_name, 'Group Chat')
        ELSE COALESCE(
          (SELECT u2.full_name FROM public.users u2
           JOIN public.conversation_participants cp2
             ON cp2.user_id = u2.id AND cp2.conversation_id = c.id
           WHERE cp2.user_id != auth.uid() AND cp2.left_at IS NULL
           LIMIT 1),
          (SELECT u2.username FROM public.users u2
           JOIN public.conversation_participants cp2
             ON cp2.user_id = u2.id AND cp2.conversation_id = c.id
           WHERE cp2.user_id != auth.uid() AND cp2.left_at IS NULL
           LIMIT 1),
          'Unknown'
        )
      END                           AS conversation_name,
      c.is_group,
      m.sender_id,
      u.username                    AS sender_username,
      u.full_name                   AS sender_full_name,
      u.avatar_url                  AS sender_avatar_url,
      m.content,
      m.message_type::TEXT,
      m.created_at,
      -- FTS rank: how relevant is this message?
      ts_rank(
        to_tsvector('english', COALESCE(m.content, '')),
        plainto_tsquery('english', p_query)
      )::REAL AS rank
    FROM public.messages m
    JOIN my_conversations mc   ON mc.conversation_id = m.conversation_id
    JOIN public.conversations c ON c.id = m.conversation_id
    LEFT JOIN public.users u   ON u.id = m.sender_id
    WHERE
      m.deleted_at IS NULL
      AND m.message_type = 'text'
      AND m.content IS NOT NULL
      AND (
        -- Full-text search (primary, indexed)
        to_tsvector('english', COALESCE(m.content, ''))
          @@ plainto_tsquery('english', p_query)
        -- ILIKE fallback for very short queries
        OR m.content ILIKE '%' || p_query || '%'
      )
  )
  SELECT *
  FROM ranked
  ORDER BY rank DESC, created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION search_messages IS
  'Full-text search across message content in user''s conversations.
   Uses idx_messages_content_fts GIN index for ranking.
   Falls back to ILIKE for short single-word queries.';

-- ─── 3. Conversation search ───────────────────────────────────────────────────
-- Search through the user's own conversation list.
-- For DMs: matches on the other user's name/username.
-- For groups: matches on the group name.
-- Returns enriched rows compatible with ConversationForUser.

CREATE OR REPLACE FUNCTION search_conversations(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id                    UUID,
  is_group              BOOLEAN,
  group_name            TEXT,
  group_avatar_url      TEXT,
  last_message_at       TIMESTAMPTZ,
  last_message_preview  TEXT,
  created_at            TIMESTAMPTZ,
  unread_count          BIGINT,
  is_muted              BOOLEAN,
  is_pinned             BOOLEAN,
  is_archived           BOOLEAN,
  last_read_at          TIMESTAMPTZ,
  -- DM: other user's profile fields
  other_user_id         UUID,
  other_username        TEXT,
  other_full_name       TEXT,
  other_avatar_url      TEXT,
  other_is_online       BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    c.id,
    c.is_group,
    c.group_name,
    c.group_avatar_url,
    c.last_message_at,
    c.last_message_preview,
    c.created_at,
    -- Unread count (same logic as v_conversations_for_user)
    (
      SELECT COUNT(*)
      FROM public.message_status ms2
      JOIN public.messages m2 ON m2.id = ms2.message_id
      WHERE m2.conversation_id = c.id
        AND ms2.user_id        = auth.uid()
        AND ms2.status        != 'seen'
    ) AS unread_count,
    cp.is_muted,
    cp.is_pinned,
    cp.is_archived,
    cp.last_read_at,
    -- Other user (for DMs)
    other_u.id          AS other_user_id,
    other_u.username    AS other_username,
    other_u.full_name   AS other_full_name,
    other_u.avatar_url  AS other_avatar_url,
    other_u.is_online   AS other_is_online
  FROM public.conversations c
  JOIN public.conversation_participants cp
    ON cp.conversation_id = c.id
   AND cp.user_id         = auth.uid()
   AND cp.left_at         IS NULL
  -- For DMs: join the other participant's profile
  LEFT JOIN public.conversation_participants other_cp
    ON other_cp.conversation_id = c.id
   AND other_cp.user_id        != auth.uid()
   AND other_cp.left_at         IS NULL
   AND c.is_group = FALSE
  LEFT JOIN public.users other_u
    ON other_u.id = other_cp.user_id
  WHERE
    c.deleted_at IS NULL
    AND (
      -- Group chat: search group name
      (c.is_group  AND c.group_name ILIKE '%' || p_query || '%')
      -- DM: search other user's name/username
      OR (NOT c.is_group AND (
        other_u.username ILIKE '%' || p_query || '%'
        OR COALESCE(other_u.full_name, '') ILIKE '%' || p_query || '%'
      ))
      -- Any: search last message preview
      OR c.last_message_preview ILIKE '%' || p_query || '%'
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION search_conversations IS
  'Search through user''s own conversation list by participant name or last message.
   Returns rows compatible with ConversationForUser + other_user fields.';
