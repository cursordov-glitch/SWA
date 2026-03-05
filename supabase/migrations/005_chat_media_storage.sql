-- ============================================================
-- supabase/migrations/005_chat_media_storage.sql
-- ============================================================
-- Creates the chat-media storage bucket and RLS policies.
-- Idempotent — safe to run even if bucket already exists.
--
-- Storage path convention: {userId}/{conversationId}/{filename}
-- Security model:
--   UPLOAD  — only into your own userId prefix
--   SELECT  — public (CDN URLs are long random strings)
--   DELETE  — only the original uploader
-- ============================================================

-- 1. Create bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  5242880,        -- 5 MB hard limit at storage layer
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies cleanly before re-applying
DROP POLICY IF EXISTS "chat-media: authenticated upload own prefix" ON storage.objects;
DROP POLICY IF EXISTS "chat-media: public read"                     ON storage.objects;
DROP POLICY IF EXISTS "chat-media: owner delete"                    ON storage.objects;

-- 3. Upload: user can only write to their own userId prefix
CREATE POLICY "chat-media: authenticated upload own prefix"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Read: public (CDN delivery for chat images)
CREATE POLICY "chat-media: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-media');

-- 5. Delete: only the uploader
CREATE POLICY "chat-media: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
