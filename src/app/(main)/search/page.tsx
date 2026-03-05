// ============================================================
// src/app/(main)/search/page.tsx
// ============================================================
// Search page — Server Component.
//
// Reads ?q= from the URL so:
//   1. Search results survive page refresh
//   2. Search queries are shareable / bookmarkable
//   3. The browser Back button restores the previous query
//
// The Server Component's only job is:
//   - Auth check (fast, no DB round-trip if session cookie valid)
//   - Extract ?q= from searchParams
//   - Pass initialQuery to SearchClient
//
// SearchClient (Client Component) does the actual fetching via
// the /api/search route after mounting. This means the page
// SSR shell arrives instantly with no waterfall.
// ============================================================

import { redirect }  from 'next/navigation';
import type { Metadata } from 'next';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { SearchClient } from '@/features/search';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search people, conversations, and messages',
};

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: PageProps) {
  // Auth guard
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Extract initial query from URL
  const { q } = await searchParams;
  const initialQuery = (q ?? '').trim().slice(0, 200);

  return (
    // Fills the (main) layout's <main> flex column
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <SearchClient initialQuery={initialQuery} />
    </div>
  );
}
