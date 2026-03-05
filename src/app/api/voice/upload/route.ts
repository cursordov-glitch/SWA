// src/app/api/voice/upload/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createMessageService } from '@/services';

const BUCKET    = 'voice-messages';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED   = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']);
const EXT: Record<string, string> = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',  'audio/mp4': 'm4a', 'audio/wav': 'wav',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

    const file           = form.get('file') as Blob | null;
    const conversationId = form.get('conversationId') as string | null;
    const duration       = parseInt(form.get('duration') as string ?? '0', 10);

    if (!file || file.size === 0) return NextResponse.json({ error: 'No audio file' }, { status: 400 });
    if (!conversationId) return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Unsupported audio type' }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });

    // Participant check
    const { data: cp } = await supabase.from('conversation_participants')
      .select('user_id').eq('conversation_id', conversationId)
      .eq('user_id', user.id).is('left_at', null).single();
    if (!cp) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

    const ext  = EXT[file.type] ?? 'webm';
    const path = `${user.id}/${conversationId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: '31536000' });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const msgService = createMessageService(supabase);
    const { data: message, error: msgErr } = await msgService.sendMessage({
      conversationId,
      messageType: 'audio',
      mediaUrl: publicUrl,
      mediaType: 'audio',
      content: `Voice message (${Math.round(duration)}s)`,
    });

    if (msgErr || !message) return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    return NextResponse.json({ data: message, url: publicUrl }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/voice/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
