// ============================================================
// src/app/api/users/check/route.ts
// ============================================================
// GET /api/users/check?username=<string>
// Returns { available: boolean } for live username availability
// checking in the ProfileEditor and RegisterForm.
//
// Security:
//   - Session required (prevents anonymous enumeration of usernames)
//   - Username validated + sanitised before any DB query
//   - No user data is returned beyond the boolean
//
// Performance:
//   Uses the idx_users_username B-tree index → O(log n) lookup
//   for any number of users. Response is <10ms at scale.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const MIN_LEN = 3;
const MAX_LEN = 30;
const USERNAME_RE = /^[a-zA-Z0-9_.]+$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username')?.trim() ?? '';

    // Validate format before touching the DB
    if (!username || username.length < MIN_LEN || username.length > MAX_LEN) {
      return NextResponse.json({ available: false, error: 'Invalid username length' }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ available: false, error: 'Invalid username characters' }, { status: 400 });
    }

    // Auth required — prevent anonymous enumeration
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check uniqueness — exclude the requesting user's own username
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle();

    return NextResponse.json({ available: existing === null }, { status: 200 });

  } catch (err) {
    console.error('[GET /api/users/check]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
