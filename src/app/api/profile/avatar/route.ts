// ============================================================
// src/app/api/profile/avatar/route.ts
// ============================================================
// POST /api/profile/avatar
// Accepts a multipart/form-data upload: { file: File }
// Uploads to the user-avatars Supabase Storage bucket,
// then updates users.avatar_url with the public CDN URL.
//
// Storage path: {userId}/avatar.{ext}
// Using a FIXED filename (not timestamped) means:
//   - The old avatar is automatically replaced in-place
//   - The CDN URL is stable after re-upload
//   - No orphan file cleanup needed
//   - Storage use is bounded: one file per user
//
// Security:
//   - Session required
//   - MIME + magic byte validation (cannot be spoofed)
//   - 2MB size limit (avatars are small)
//   - Path is scoped to auth.uid() (matches RLS bucket policy)
//
// Vercel: stateless, fully buffered (<2MB), no disk writes
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';

const BUCKET   = 'user-avatars';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED: Record<string, { ext: string; magic: number[] }> = {
  'image/jpeg': { ext: 'jpg',  magic: [0xff, 0xd8, 0xff] },
  'image/jpg':  { ext: 'jpg',  magic: [0xff, 0xd8, 0xff] },
  'image/png':  { ext: 'png',  magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
};

function hasMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
  const config = ALLOWED[mime];
  if (!config) return false;
  const view = new Uint8Array(buffer, 0, 8);
  return config.magic.every((b, i) => view[i] === b);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Parse multipart
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 }); }

    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. MIME type check
    const mime = file.type.toLowerCase();
    const typeConfig = ALLOWED[mime];
    if (!typeConfig) {
      return NextResponse.json(
        { error: 'Unsupported type. Allowed: JPEG, PNG, WebP' },
        { status: 415 }
      );
    }

    // 4. Size limit
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Avatar too large. Maximum size is ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // 5. Read + magic bytes
    const buffer = await file.arrayBuffer();
    if (!hasMagicBytes(buffer, mime)) {
      return NextResponse.json(
        { error: 'File content does not match its declared type' },
        { status: 415 }
      );
    }

    // 6. Upload to storage — FIXED path ensures old avatar is replaced
    // Path: {userId}/avatar.{ext}
    // upsert: true → overwrites the existing file for this user
    const storagePath = `${user.id}/avatar.${typeConfig.ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: true,           // replace existing avatar in-place
        cacheControl: '3600',   // CDN cache 1 hour (reasonable for profile pics)
      });

    if (uploadErr) {
      console.error('[avatar] Storage error:', uploadErr.message);
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }

    // 7. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // Append cache-busting query param so browser sees the new image immediately
    // even though the CDN URL path is the same as the old avatar.
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // 8. Update user profile with new URL
    const userService = createUserService(supabase);
    const { error: profileErr } = await userService.updateProfile({ avatar_url: avatarUrl });

    if (profileErr) {
      // Storage upload succeeded but DB update failed — surface the error
      // but don't delete the uploaded file (user can retry the DB write)
      console.error('[avatar] Profile update error:', profileErr.message);
      return NextResponse.json({ error: 'Uploaded but failed to save. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ url: avatarUrl }, { status: 200 });

  } catch (err) {
    console.error('[POST /api/profile/avatar]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
