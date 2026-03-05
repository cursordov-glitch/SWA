// src/app/api/messages/react/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';

const Schema = z.object({
  messageId: z.string().uuid(),
  emoji:     z.string().min(1).max(8),
});

export async function PATCH(request: NextRequest) {
  try {
    const body   = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });

    const { messageId, emoji } = parsed.data;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Participant check
    const { data: msg } = await supabase
      .from('messages').select('conversation_id').eq('id', messageId).is('deleted_at', null).single();
    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const { data: cp } = await supabase
      .from('conversation_participants')
      .select('user_id').eq('conversation_id', msg.conversation_id)
      .eq('user_id', user.id).is('left_at', null).single();
    if (!cp) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

    // Toggle: check if exists
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id').eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji).single();

    if (existing) {
      await supabase.from('message_reactions')
        .delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      return NextResponse.json({ reacted: false, emoji }, { status: 200 });
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
      return NextResponse.json({ reacted: true, emoji }, { status: 200 });
    }
  } catch (err) {
    console.error('[PATCH /api/messages/react]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
