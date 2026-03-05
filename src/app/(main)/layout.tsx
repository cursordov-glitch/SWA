// ============================================================
// src/app/(main)/layout.tsx
// ============================================================
// Authenticated app shell.
// Renders the ConversationList sidebar (Server Component wrapper
// that fetches the current user, then passes it to the Client Component).
// ============================================================

import { redirect } from 'next/navigation';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';
import { ConversationList } from '@/features/chat/components/ConversationList';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Server-side session + profile fetch
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const userService = createUserService(supabase);
  const { data: profile } = await userService.getCurrentUser();

  if (!profile) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-80 flex-col border-r border-gray-100 bg-white shrink-0">
        <ConversationList currentUser={profile} />
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
}
