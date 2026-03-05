-- ============================================================
-- supabase/migrations/007_user_avatars_storage.sql
-- ============================================================
-- Creates the user-avatars storage bucket.
-- Separate from chat-media (step 5) because the access patterns
-- and lifecycle differ:
--
--   chat-media   -> per-conversation, many files per user, CDN only
--   user-avatars -> one file per user, overwritten in-place, profile UI
--
-- Fixed path pattern: {userId}/avatar.{ext}
-- Fixed filename means:
--   1. Old avatar is atomically replaced — no orphan file cleanup
--   2. The CDN URL path is stable (cache-busting via ?t= query param)
--   3. Storage is bounded: exactly 1 file per user at all times
-- ============================================================

-- 1. Create bucket (idempotent via ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies cleanly (idempotent)
DROP POLICY IF EXISTS "avatars: owner upload"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: public read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner delete"  ON storage.objects;

-- 3. Only upload into your own folder
CREATE POLICY "avatars: owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Public read — avatars shown to all chat participants
CREATE POLICY "avatars: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-avatars');

-- 5. Owner can overwrite (upsert)
CREATE POLICY "avatars: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Owner can delete
CREATE POLICY "avatars: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Ensure indexes exist (defensive — already created in migration 002)
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_id       ON public.users (id);
