-- ============================================================
-- ChatApp — Indexes, Triggers & Automation
-- 002_indexes_and_triggers.sql
-- ============================================================

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- users
CREATE INDEX idx_users_username         ON public.users (username);
CREATE INDEX idx_users_is_online        ON public.users (is_online) WHERE is_online = TRUE;
CREATE INDEX idx_users_deleted_at       ON public.users (deleted_at) WHERE deleted_at IS NULL;
-- Full-text search on username + full_name
CREATE INDEX idx_users_search           ON public.users
  USING GIN (to_tsvector('english', coalesce(username,'') || ' ' || coalesce(full_name,'')));
-- Trigram index for ILIKE / fuzzy search
CREATE INDEX idx_users_username_trgm    ON public.users USING GIN (username gin_trgm_ops);

-- conversations
CREATE INDEX idx_conversations_last_msg ON public.conversations (last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_deleted  ON public.conversations (deleted_at) WHERE deleted_at IS NULL;

-- conversation_participants
-- Primary access pattern: "all conversations for user X, sorted by latest message"
CREATE INDEX idx_cp_user_id             ON public.conversation_participants (user_id, joined_at DESC);
CREATE INDEX idx_cp_conversation_id     ON public.conversation_participants (conversation_id);
CREATE INDEX idx_cp_active              ON public.conversation_participants (user_id)
  WHERE left_at IS NULL;

-- messages
-- Primary access pattern: "all messages in conversation X, newest first"
CREATE INDEX idx_messages_conv_created  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender        ON public.messages (sender_id);
CREATE INDEX idx_messages_reply_to      ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_messages_deleted       ON public.messages (deleted_at) WHERE deleted_at IS NULL;
-- Full-text search in message content
CREATE INDEX idx_messages_content_fts   ON public.messages
  USING GIN (to_tsvector('english', coalesce(content, '')))
  WHERE content IS NOT NULL;

-- message_status
CREATE INDEX idx_msg_status_message     ON public.message_status (message_id);
CREATE INDEX idx_msg_status_user        ON public.message_status (user_id);
-- "All unseen messages for user X" — used for notification badge
CREATE INDEX idx_msg_status_unseen      ON public.message_status (user_id, status)
  WHERE status != 'seen';

-- media_attachments
CREATE INDEX idx_media_message_id       ON public.media_attachments (message_id);

-- ─── updated_at Triggers ─────────────────────────────────────────────────────
-- Uses moddatetime extension to auto-set updated_at on any UPDATE.

CREATE OR REPLACE TRIGGER handle_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE OR REPLACE TRIGGER handle_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE OR REPLACE TRIGGER handle_cp_updated_at
  BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE OR REPLACE TRIGGER handle_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Auto-sync conversations.last_message_* ──────────────────────────────────
-- When a new message is inserted, denormalise the preview onto the conversation.
-- This keeps sidebar queries O(1) instead of requiring a subquery.

CREATE OR REPLACE FUNCTION sync_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_id      = NEW.id,
    last_message_at      = NEW.created_at,
    last_message_preview = CASE
      WHEN NEW.message_type = 'text'  THEN LEFT(NEW.content, 100)
      WHEN NEW.message_type = 'image' THEN '📷 Photo'
      WHEN NEW.message_type = 'video' THEN '🎥 Video'
      WHEN NEW.message_type = 'audio' THEN '🎤 Voice message'
      WHEN NEW.message_type = 'file'  THEN '📎 File'
      WHEN NEW.message_type = 'system' THEN NEW.content
      ELSE '...'
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_sync_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION sync_conversation_last_message();

-- ─── Auto-create message_status rows for all participants ────────────────────
-- When a message is inserted, fan out one message_status row per recipient.
-- Sender is excluded. Keeps status tracking automatic.

CREATE OR REPLACE FUNCTION create_message_status_for_participants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.message_status (message_id, user_id, status)
  SELECT
    NEW.id,
    cp.user_id,
    'sent'
  FROM public.conversation_participants cp
  WHERE
    cp.conversation_id = NEW.conversation_id
    AND cp.user_id     != NEW.sender_id
    AND cp.left_at     IS NULL
  ON CONFLICT (message_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_create_message_status
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.message_type != 'system')
  EXECUTE FUNCTION create_message_status_for_participants();

-- ─── New user profile auto-creation ─────────────────────────────────────────
-- When a user signs up via Supabase Auth, create their public profile row.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    -- Default username from email prefix; user can change it later
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::TEXT, 1, 6),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
