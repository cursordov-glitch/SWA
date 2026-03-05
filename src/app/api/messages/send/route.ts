// ============================================================
// src/app/api/messages/send/route.ts
// ============================================================
// Serverless Route Handler — Vercel compatible.
//
// Why a Route Handler instead of direct client calls?
// 1. Server-side auth validation before any DB write
// 2. Input sanitisation in one trusted place
// 3. Participant permission check (RLS alone is not enough for
//    good error messages)
// 4. Stateless — each invocation is independent, no process state
//
// Vercel constraints respected:
// - No long-running connections
// - No WebSockets
// - Uses createServerClient() (cookie-based session, no secrets in body)
// - Returns fast — DB write + trigger completes in <100ms typically
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createMessageService, createConversationService } from '@/services';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const SendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long').optional(),
  messageType: z
    .enum(['text', 'image', 'video', 'audio', 'file', 'system'])
    .default('text'),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  replyToId: z.string().uuid().optional(),
}).refine(
  (data) => data.content || data.mediaUrl,
  { message: 'Message must have content or media' }
);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Parse + validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // 2. Authenticate — createServerClient reads the session cookie
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verify sender is a participant (defence-in-depth on top of RLS)
    const convService = createConversationService(supabase);
    const { data: conversation } = await convService.getConversationById(
      input.conversationId
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user_id === user.id && !p.left_at
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this conversation' },
        { status: 403 }
      );
    }

    // 4. Send — DB triggers handle status fan-out and last_message update
    const msgService = createMessageService(supabase);
    const { data: message, error } = await msgService.sendMessage({
      conversationId: input.conversationId,
      content: input.content,
      messageType: input.messageType,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      replyToId: input.replyToId,
    });

    if (error || !message) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to send message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/messages/send]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
