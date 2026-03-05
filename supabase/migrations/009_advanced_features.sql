-- ============================================================
-- supabase/migrations/009_advanced_features.sql
-- ============================================================

-- ─── 1. message_reactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  emoji       TEXT        NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message   ON public.message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_msg_emoji ON public.message_reactions (message_id, emoji);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp
        ON cp.conversation_id = m.conversation_id
       AND cp.user_id = auth.uid() AND cp.left_at IS NULL
      WHERE m.id = message_reactions.message_id AND m.deleted_at IS NULL
    )
  );

CREATE POLICY "reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── 2. Sync trigger: keep messages.reactions JSONB current ──────────────────
CREATE OR REPLACE FUNCTION sync_message_reactions_jsonb()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message_id UUID := COALESCE(NEW.message_id, OLD.message_id);
  v_reactions  JSONB;
BEGIN
  SELECT jsonb_object_agg(emoji, user_ids) INTO v_reactions
  FROM (
    SELECT emoji, jsonb_agg(user_id::text ORDER BY created_at) AS user_ids
    FROM public.message_reactions
    WHERE message_id = v_message_id
    GROUP BY emoji
  ) t;
  UPDATE public.messages
  SET reactions = COALESCE(v_reactions, '{}'::jsonb)
  WHERE id = v_message_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reactions ON public.message_reactions;
CREATE TRIGGER trg_sync_reactions
  AFTER INSERT OR DELETE ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_message_reactions_jsonb();

-- ─── 3. Pinned conversations partial index ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cp_pinned
  ON public.conversation_participants (user_id, conversation_id)
  WHERE is_pinned = TRUE AND left_at IS NULL;

-- ─── 4. voice-messages storage bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-messages', 'voice-messages', true, 5242880,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "voice: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "voice: public read"  ON storage.objects;
DROP POLICY IF EXISTS "voice: owner delete" ON storage.objects;

CREATE POLICY "voice: owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "voice: public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'voice-messages');

CREATE POLICY "voice: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 5. reply_to_id index (defensive) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
