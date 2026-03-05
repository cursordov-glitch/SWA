// ============================================================
// src/app/auth/callback/route.ts
// ============================================================
// Handles the OAuth redirect from Google (and any other provider).
//
// Flow:
// 1. Google redirects to /auth/callback?code=XYZ
// 2. This route exchanges the code for a Supabase session
// 3. Supabase sets the session cookie
// 4. User is redirected to /chat
//
// The DB trigger (handle_new_auth_user) fires automatically
// on the first OAuth sign-in, creating the public.users row.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/chat';

  if (code) {
    const supabase = await createServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // OAuth success — redirect to the app
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Something went wrong — redirect to login with an error flag
  return NextResponse.redirect(
    new URL(`/login?error=oauth_failed`, requestUrl.origin)
  );
}
