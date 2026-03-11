// ============================================================
// src/app/(main)/layout.tsx
// IMPROVEMENT: Full mobile-responsive layout.
//   - Desktop: sidebar + main split
//   - Mobile: bottom nav bar (Messages / Search / Profile)
// ============================================================

import { redirect } from 'next/navigation';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { MobileBottomNav } from '@/components/ui/MobileBottomNav';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const userService = createUserService(supabase);
  const { data: profile } = await userService.getCurrentUser();

  if (!profile) redirect('/login');

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-80 flex-col border-r border-gray-100 bg-white shrink-0">
        <ConversationList currentUser={profile} />
      </aside>

      {/* Main content - padded bottom on mobile for nav bar */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-[56px] md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav username={profile.username} />
    </div>
  );
}
