// ============================================================
// src/app/api/search/route.ts
// ============================================================
// GET /api/search?q=<query>&type=<all|users|messages|conversations>&limit=<n>
//
// Single endpoint for all three search surfaces.
// Dispatches to the appropriate DB function(s) based on type.
//
// Response shape:
//   { users: UserResult[], conversations: ConvResult[], messages: MsgResult[] }
//
// Why one endpoint vs. three?
//   - The global search UI shows all three categories together.
//   - One round-trip from the browser instead of three parallel ones.
//   - The server can run all three DB calls in parallel (Promise.all).
//   - Individual type filters are still supported for scoped searches.
//
// Security:
//   - Session required — all DB functions check auth.uid() internally
//   - Query sanitised: trimmed, max 200 chars
//   - Min length 2 enforced to avoid expensive full-table ILIKE scans
//
// Performance:
//   - All three DB functions run in parallel (Promise.all)
//   - Results are capped server-side before sending
//   - DB functions use existing GIN indexes (no sequential scans)
//
// Vercel: stateless, no uploads, typical <150ms for all three in parallel
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const MIN_QUERY = 2;
const MAX_QUERY = 200;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type SearchType = 'all' | 'users' | 'conversations' | 'messages';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery  = searchParams.get('q') ?? '';
    const typeParam = (searchParams.get('type') ?? 'all') as SearchType;
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);

    // Validate query
    const query = rawQuery.trim().slice(0, MAX_QUERY);
    if (query.length < MIN_QUERY) {
      return NextResponse.json(
        { error: `Query must be at least ${MIN_QUERY} characters` },
        { status: 400 }
      );
    }

    const limit = isNaN(limitParam)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(1, limitParam), MAX_LIMIT);

    // Validate type
    const validTypes: SearchType[] = ['all', 'users', 'conversations', 'messages'];
    const type: SearchType = validTypes.includes(typeParam) ? typeParam : 'all';

    // Auth
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Run searches in parallel ───────────────────────────────────────────
    // Only run the functions relevant to the requested type.

    const shouldSearchUsers  = type === 'all' || type === 'users';
    const shouldSearchConvs  = type === 'all' || type === 'conversations';
    const shouldSearchMsgs   = type === 'all' || type === 'messages';

    const [usersResult, convsResult, msgsResult] = await Promise.all([
      // User search
      shouldSearchUsers
        ? supabase.rpc('search_users', { p_query: query, p_limit: limit, p_offset: 0 })
        : Promise.resolve({ data: [], error: null }),

      // Conversation search
      shouldSearchConvs
        ? supabase.rpc('search_conversations', { p_query: query, p_limit: limit })
        : Promise.resolve({ data: [], error: null }),

      // Message search
      shouldSearchMsgs
        ? supabase.rpc('search_messages', { p_query: query, p_limit: limit, p_offset: 0 })
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Surface errors (non-fatal — return empty array for that category)
    if (usersResult.error) console.warn('[search] users error:', usersResult.error.message);
    if (convsResult.error) console.warn('[search] convs error:', convsResult.error.message);
    if (msgsResult.error)  console.warn('[search] msgs error:',  msgsResult.error.message);

    return NextResponse.json({
      users:         usersResult.data  ?? [],
      conversations: convsResult.data  ?? [],
      messages:      msgsResult.data   ?? [],
      query,
      type,
    }, { status: 200 });

  } catch (err) {
    console.error('[GET /api/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
