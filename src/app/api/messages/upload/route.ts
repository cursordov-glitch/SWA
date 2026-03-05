// ============================================================
// src/app/api/messages/upload/route.ts
// ============================================================
// Accepts multipart/form-data: { file: File, conversationId: string }
// Returns: { url, storagePath, mimeType, size, filename }
//
// Security layers applied in order:
//   1. Session auth        — cookie-based, stateless per invocation
//   2. Participant check   — user must belong to the conversation
//   3. MIME validation     — server-side, not trusting client header
//   4. Magic byte check    — first bytes confirm actual file format
//   5. Size enforcement    — before any buffer read/storage write
//   6. Path sanitisation   — alphanumeric filename, no traversal
//
// Vercel serverless compatible:
//   - NextRequest.formData() — native, no external parser needed
//   - No disk writes, fully buffered in memory (safe ≤5 MB)
//   - Stateless — each invocation is independent
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const BUCKET = 'chat-media';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Accepted types: MIME → { extension, magic bytes }
const ALLOWED: Record<string, { ext: string; magic: number[] }> = {
  'image/jpeg': { ext: 'jpg',  magic: [0xff, 0xd8, 0xff] },
  'image/jpg':  { ext: 'jpg',  magic: [0xff, 0xd8, 0xff] },
  'image/png':  { ext: 'png',  magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
  'image/gif':  { ext: 'gif',  magic: [0x47, 0x49, 0x46, 0x38] },
};

function hasMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
  const config = ALLOWED[mime];
  if (!config) return false;
  const view = new Uint8Array(buffer, 0, 8);
  return config.magic.every((b, i) => view[i] === b);
}

function safeName(original: string, ext: string): string {
  const stem = original
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'image';
  return `${stem}_${Date.now()}.${ext}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 2. Parse form ────────────────────────────────────────────────────
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 }); }

    const file = form.get('file');
    const conversationId = form.get('conversationId') as string | null;

    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!conversationId || !UUID_RE.test(conversationId))
      return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

    // ── 3. MIME check ────────────────────────────────────────────────────
    const mime = file.type.toLowerCase();
    const typeConfig = ALLOWED[mime];
    if (!typeConfig)
      return NextResponse.json(
        { error: 'Unsupported type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 415 }
      );

    // ── 4. Size check ────────────────────────────────────────────────────
    if (file.size > MAX_BYTES)
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );

    // ── 5. Buffer + magic bytes ──────────────────────────────────────────
    const buffer = await file.arrayBuffer();
    if (!hasMagicBytes(buffer, mime))
      return NextResponse.json(
        { error: 'File content does not match its declared type' },
        { status: 415 }
      );

    // ── 6. Participant check ─────────────────────────────────────────────
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (!participant)
      return NextResponse.json(
        { error: 'You are not a participant in this conversation' },
        { status: 403 }
      );

    // ── 7. Upload ────────────────────────────────────────────────────────
    // Path: {userId}/{conversationId}/{safeName}
    // userId prefix is validated by the storage RLS policy on INSERT.
    const filename = safeName(file.name, typeConfig.ext);
    const storagePath = `${user.id}/${conversationId}/${filename}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mime, upsert: false });

    if (uploadErr) {
      console.error('[upload] Storage error:', uploadErr.message);
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }

    // ── 8. Public URL ────────────────────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json(
      { url: publicUrl, storagePath, mimeType: mime, size: file.size, filename },
      { status: 201 }
    );

  } catch (err) {
    console.error('[POST /api/messages/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
