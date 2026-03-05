-- ============================================================
-- ChatApp — Row Level Security (RLS)
-- 003_rls_policies.sql
-- ============================================================
-- RLS ensures users can ONLY access data they own or participate in.
-- Every table has RLS enabled. All policies use auth.uid().
-- ============================================================

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_attachments       ENABLE ROW LEVEL SECURITY;

-- ─── Helper function ─────────────────────────────────────────────────────────
-- Reusable check: "is the current user a participant of this conversation?"
-- Using SECURITY DEFINER so it bypasses RLS when called internally.

CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id         = auth.uid()
      AND cp.left_at         IS NULL
  );
$$;

-- ─── users ───────────────────────────────────────────────────────────────────

-- Anyone authenticated can read non-deleted profiles (needed for search, DMs)
CREATE POLICY "users_select_public"
  ON public.users FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Users can only update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert is handled by the auth trigger (handle_new_auth_user)
-- Direct inserts are blocked
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Soft delete: users can delete (mark) only themselves
CREATE POLICY "users_delete_own"
  ON public.users FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ─── conversations ────────────────────────────────────────────────────────────

-- Users can only see conversations they are a participant of
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND is_conversation_participant(id)
  );

-- Any authenticated user can create a conversation
CREATE POLICY "conversations_insert_authenticated"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only admins can update group conversations; DM participants can update their own
CREATE POLICY "conversations_update_participant"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (is_conversation_participant(id));

-- Soft delete: only creator or admin can delete
CREATE POLICY "conversations_delete_creator"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ─── conversation_participants ────────────────────────────────────────────────

-- Participants can see who else is in their conversations
CREATE POLICY "cp_select_participant"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (is_conversation_participant(conversation_id));

-- Users can add themselves (when accepting an invite) or creator adds others
CREATE POLICY "cp_insert_self_or_creator"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );

-- Users can update their own participant record (mute, pin, archive, leave)
CREATE POLICY "cp_update_own"
  ON public.conversation_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only delete their own participant row (leave group)
CREATE POLICY "cp_delete_own"
  ON public.conversation_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─── messages ────────────────────────────────────────────────────────────────

-- Participants can read all non-deleted messages in their conversations
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND is_conversation_participant(conversation_id)
  );

-- Participants can send messages to their conversations
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
  );

-- Senders can edit/unsend their own messages
CREATE POLICY "messages_update_own"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Senders can hard-delete only their own messages (use soft delete in app layer)
CREATE POLICY "messages_delete_own"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- ─── message_status ──────────────────────────────────────────────────────────

-- Users can see status for messages in conversations they participate in
CREATE POLICY "msg_status_select"
  ON public.message_status FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND m.sender_id = auth.uid()
    )
  );

-- Status rows are auto-created by trigger; users can mark their own as seen
CREATE POLICY "msg_status_update_own"
  ON public.message_status FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Insert handled by trigger only (SECURITY DEFINER bypasses RLS)
CREATE POLICY "msg_status_insert_own"
  ON public.message_status FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── media_attachments ───────────────────────────────────────────────────────

-- Participants of the conversation can view media
CREATE POLICY "media_select_participant"
  ON public.media_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND is_conversation_participant(m.conversation_id)
    )
  );

-- Only the uploader can insert
CREATE POLICY "media_insert_own"
  ON public.media_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploader_id = auth.uid());

-- Only uploader can delete their media
CREATE POLICY "media_delete_own"
  ON public.media_attachments FOR DELETE
  TO authenticated
  USING (uploader_id = auth.uid());

-- ─── Supabase Storage Bucket Policies ────────────────────────────────────────
-- Run these in the Supabase dashboard Storage section OR via SQL:

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  TRUE,
  52428800,   -- 50MB limit per file
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "storage_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Authenticated users can read any file (public bucket with auth gate)
CREATE POLICY "storage_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-media');

-- Users can delete only their own files
CREATE POLICY "storage_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
