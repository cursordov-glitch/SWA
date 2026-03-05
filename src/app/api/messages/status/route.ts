// ============================================================
// src/app/api/messages/status/route.ts
// ============================================================
// GET /api/messages/status?conversationId=<uuid>&limit=<n>
//
// Returns the aggregate delivery/read status for the last N
// messages sent by the authenticated user in a conversation.
//
// Response shape:
//   { data: MessageStatusResult[] }
//
// Where MessageStatusResult is:
//   { messageId, aggregateStatus, seenByAll }
//
// Why a dedicated route?
// - The RPC call runs server-side with the user's session
// - RLS ensures the user can only see status for their own messages
// - Separating this from the message list route keeps each route
//   focused and independently cacheable
//
// Vercel: fully stateless, <50ms typical response time
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limitParam     = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);

    if (!conversationId || !UUID_RE.test(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });
    }

    const limit = isNaN(limitParam) ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);

    // Auth
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Call the DB function defined in migration 006
    const { data, error } = await supabase.rpc('get_my_message_statuses', {
      p_conversation_id: conversationId,
      p_limit: limit,
    });

    if (error) {
      console.error('[GET /api/messages/status]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalise snake_case → camelCase for the client
    const results = (data ?? []).map((row: {
      message_id: string;
      aggregate_status: string;
      seen_by_all: boolean;
    }) => ({
      messageId:       row.message_id,
      aggregateStatus: row.aggregate_status as 'sent' | 'delivered' | 'seen',
      seenByAll:       row.seen_by_all,
    }));

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/messages/status]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
