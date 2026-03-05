// ============================================================
// src/app/api/messages/list/route.ts
// ============================================================
// Serverless Route Handler — Vercel compatible.
//
// Fetches a paginated page of messages for a conversation.
// Uses cursor-based pagination (cursor = created_at of oldest
// message currently loaded in the client).
//
// Query params:
//   conversationId  required  UUID
//   cursor          optional  ISO timestamp (load older messages)
//   limit           optional  1-100, default 40
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createMessageService, createConversationService } from '@/services';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Parse query params
    const { searchParams } = request.nextUrl;
    const parsed = ListQuerySchema.safeParse({
      conversationId: searchParams.get('conversationId'),
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? 40,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      );
    }

    const { conversationId, cursor, limit } = parsed.data;

    // 2. Authenticate
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verify participant access (RLS enforces this too, but gives a
    //    clear 403 instead of an empty array for better DX)
    const convService = createConversationService(supabase);
    const { data: conversation } = await convService.getConversationById(conversationId);

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

    // 4. Fetch messages (service handles cursor pagination)
    const msgService = createMessageService(supabase);
    const result = await msgService.getMessages(conversationId, { limit, cursor });

    // 5. Return — no cache headers (messages are user-specific + real-time)
    return NextResponse.json(
      {
        data: result.data,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        count: result.count,
      },
      {
        status: 200,
        headers: {
          // Prevent CDN caching of private message data
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error('[GET /api/messages/list]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
