-- ============================================================
-- supabase/migrations/006_message_status_improvements.sql
-- ============================================================
-- Adds updated_at to message_status for two reasons:
--   1. Supabase Realtime postgres_changes needs a way to identify
--      which rows changed for the UPDATE event. updated_at gives
--      us a reliable change signal without relying on WAL REPLICA
--      IDENTITY FULL (which is expensive and returns full old+new rows).
--   2. The client hook filters on updated_at > last_known to avoid
--      reprocessing stale events after a reconnect.
--
-- Also adds a composite partial index on (message_id, status)
-- for the "get latest status for sender's messages" query.
-- ============================================================

-- Add updated_at if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'message_status'
      AND column_name  = 'updated_at'
  ) THEN
    ALTER TABLE public.message_status
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END;
$$;

-- Auto-update updated_at on any row update
CREATE OR REPLACE TRIGGER handle_message_status_updated_at
  BEFORE UPDATE ON public.message_status
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Composite index for the status subscription query:
-- "Get the worst (most advanced) status for messages sent by me
--  in this conversation" — used to render the SeenIndicator.
-- The partial filter WHERE status != 'seen' speeds up the
-- "how many unseen?" count used in sidebar badge calculations.
CREATE INDEX IF NOT EXISTS idx_msg_status_message_status
  ON public.message_status (message_id, status);

-- Index to enable fast per-conversation status lookups
-- (used when subscribing to status changes for a conversation)
CREATE INDEX IF NOT EXISTS idx_msg_status_user_message
  ON public.message_status (user_id, message_id);

-- ─── Function: get_message_statuses_for_conversation ─────────────────────────
-- Returns the aggregated status for the LAST N messages of a conversation
-- that were sent by a specific user.
-- This powers the SeenIndicator: "was my last message seen by everyone?"
--
-- Returns one row per message_id with the MINIMUM status across all recipients.
-- min status order: sent < delivered < seen
-- So if even ONE recipient hasn't seen it, we show 'delivered' (or 'sent').
--
-- Called client-side after initial message load.

CREATE OR REPLACE FUNCTION get_my_message_statuses(
  p_conversation_id UUID,
  p_limit           INT DEFAULT 20
)
RETURNS TABLE (
  message_id UUID,
  aggregate_status TEXT,
  seen_by_all BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH my_messages AS (
    SELECT id
    FROM public.messages
    WHERE conversation_id = p_conversation_id
      AND sender_id       = auth.uid()
      AND deleted_at      IS NULL
    ORDER BY created_at DESC
    LIMIT p_limit
  ),
  status_agg AS (
    SELECT
      ms.message_id,
      -- Aggregate: worst status across all recipients
      -- CASE-ordered so: sent(1) < delivered(2) < seen(3)
      MIN(CASE ms.status
        WHEN 'sent'      THEN 1
        WHEN 'delivered' THEN 2
        WHEN 'seen'      THEN 3
        ELSE 0
      END) AS min_status_rank,
      COUNT(*) FILTER (WHERE ms.status = 'seen') AS seen_count,
      COUNT(*) AS total_recipients
    FROM public.message_status ms
    JOIN my_messages mm ON mm.id = ms.message_id
    GROUP BY ms.message_id
  )
  SELECT
    sa.message_id,
    CASE sa.min_status_rank
      WHEN 1 THEN 'sent'
      WHEN 2 THEN 'delivered'
      WHEN 3 THEN 'seen'
      ELSE 'sent'
    END AS aggregate_status,
    sa.seen_count = sa.total_recipients AS seen_by_all
  FROM status_agg sa;
$$;

COMMENT ON FUNCTION get_my_message_statuses IS
  'Returns aggregate delivery/seen status for the current user''s recent messages
   in a conversation. Used by the SeenIndicator component.';
