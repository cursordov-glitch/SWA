-- ============================================================
-- ChatApp — Realtime Config & Convenience Views
-- 004_realtime_and_views.sql
-- ============================================================

-- ─── Enable Realtime on key tables ───────────────────────────────────────────
-- Supabase Realtime listens to Postgres WAL changes.
-- Only subscribe the tables that the client needs live updates from.

BEGIN;

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;            -- online presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

COMMIT;

-- ─── View: conversation_with_last_message ────────────────────────────────────
-- Used in the sidebar. Returns each conversation with its last message
-- and the other participant's profile (for DMs).

CREATE OR REPLACE VIEW public.v_conversations_for_user
WITH (security_invoker = TRUE)
AS
SELECT
  c.id,
  c.is_group,
  c.group_name,
  c.group_avatar_url,
  c.last_message_at,
  c.last_message_preview,
  c.created_at,
  -- Unread count for the current user
  (
    SELECT COUNT(*)
    FROM public.message_status ms
    JOIN public.messages m ON m.id = ms.message_id
    WHERE m.conversation_id = c.id
      AND ms.user_id        = auth.uid()
      AND ms.status        != 'seen'
  ) AS unread_count,
  -- Current user's participant state
  cp.is_muted,
  cp.is_pinned,
  cp.is_archived,
  cp.last_read_at
FROM public.conversations c
JOIN public.conversation_participants cp
  ON cp.conversation_id = c.id
 AND cp.user_id         = auth.uid()
 AND cp.left_at         IS NULL
WHERE c.deleted_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;

COMMENT ON VIEW public.v_conversations_for_user IS
  'Returns all conversations for the authenticated user with unread counts.
   security_invoker=TRUE means RLS of underlying tables is respected.';

-- ─── View: v_messages_with_sender ────────────────────────────────────────────
-- Joins messages with sender profile for the message list.

CREATE OR REPLACE VIEW public.v_messages_with_sender
WITH (security_invoker = TRUE)
AS
SELECT
  m.id,
  m.conversation_id,
  m.sender_id,
  m.message_type,
  m.content,
  m.media_url,
  m.media_type,
  m.media_metadata,
  m.reply_to_id,
  m.reactions,
  m.created_at,
  m.updated_at,
  m.deleted_at,
  -- Sender profile
  u.username          AS sender_username,
  u.full_name         AS sender_full_name,
  u.avatar_url        AS sender_avatar_url
FROM public.messages m
LEFT JOIN public.users u ON u.id = m.sender_id
WHERE m.deleted_at IS NULL;

-- ─── Function: get_or_create_dm ──────────────────────────────────────────────
-- Finds an existing DM between two users or creates a new one.
-- Prevents duplicate DM conversations.

CREATE OR REPLACE FUNCTION get_or_create_dm(other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conversation_id UUID;
  current_user_id   UUID := auth.uid();
BEGIN
  -- Guard: cannot DM yourself
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create a DM with yourself';
  END IF;

  -- Look for existing DM between the two users
  SELECT c.id INTO v_conversation_id
  FROM public.conversations c
  JOIN public.conversation_participants cp1
    ON cp1.conversation_id = c.id AND cp1.user_id = current_user_id AND cp1.left_at IS NULL
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = c.id AND cp2.user_id = other_user_id   AND cp2.left_at IS NULL
  WHERE c.is_group = FALSE
    AND c.deleted_at IS NULL
  LIMIT 1;

  -- Return existing DM if found
  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create new conversation
  INSERT INTO public.conversations (is_group, created_by)
  VALUES (FALSE, current_user_id)
  RETURNING id INTO v_conversation_id;

  -- Add both participants
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES
    (v_conversation_id, current_user_id, 'admin'),
    (v_conversation_id, other_user_id,   'member');

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION get_or_create_dm IS
  'Idempotent: finds or creates a 1-to-1 DM conversation. Call from the app layer.';

-- ─── Function: mark_messages_seen ────────────────────────────────────────────
-- Bulk-marks all unread messages in a conversation as seen for the current user.

CREATE OR REPLACE FUNCTION mark_messages_seen(p_conversation_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.message_status ms
  SET
    status   = 'seen',
    seen_at  = NOW()
  FROM public.messages m
  WHERE m.id              = ms.message_id
    AND m.conversation_id = p_conversation_id
    AND ms.user_id        = auth.uid()
    AND ms.status        != 'seen';

  -- Update participant's last_read_at
  UPDATE public.conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id         = auth.uid();
END;
$$;
