// ============================================================
// src/app/api/messages/seen/route.ts
// ============================================================
// Marks all unseen messages in a conversation as seen.
// Called when the user opens a conversation window.
// Delegates to the mark_messages_seen DB RPC (migration 004).
//
// Why a dedicated route vs. inline client call?
// - Keeps DB RPC calls server-side (session-validated)
// - Can be extended later for push notification dismissal
// - Easy to rate-limit at the edge if needed
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createConversationService } from '@/services';

const SeenSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = SeenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convService = createConversationService(supabase);
    const error = await convService.markAsSeen(parsed.data.conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/messages/seen]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
