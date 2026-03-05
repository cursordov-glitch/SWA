// ============================================================
// src/middleware.ts
// ============================================================
// Runs on every request (matched below).
// Responsibilities:
//   1. Refresh the Supabase session (required for SSR)
//   2. Redirect unauthenticated users to /login
//   3. Redirect authenticated users away from auth pages
//   4. Allow public + API routes through without auth
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';

import { createMiddlewareClient } from '@/lib/supabase/middleware';

// Routes accessible WITHOUT authentication
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/auth'];

// Routes that authenticated users should NOT see
const AUTH_ONLY_ROUTES = ['/login', '/register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  // CRITICAL: always call getUser() in middleware to refresh the session.
  // Never use getSession() here — it doesn't validate the JWT with the server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow OAuth callback to always pass through
  if (pathname.startsWith('/auth/callback')) {
    return response;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route));

  // Not authenticated → redirect to login (preserve intended destination)
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated + on login/register → redirect into the app
  if (user && isAuthRoute) {
    const next = request.nextUrl.searchParams.get('next') ?? '/chat';
    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico
     * - Image files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
