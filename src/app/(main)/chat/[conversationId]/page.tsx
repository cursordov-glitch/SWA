// ============================================================
// src/app/(main)/chat/[conversationId]/page.tsx
// ============================================================
// Server Component. Runs on Vercel serverless.
//
// Responsibilities:
// 1. Validate the user's session (already checked by middleware,
//    but we also need the user object for rendering)
// 2. Fetch the conversation + participants from the DB
// 3. Guard: redirect if user is not a participant
// 4. Pass data to ChatWindow (Client Component)
//
// Why fetch here instead of in the client?
// - Zero loading flash — conversation metadata arrives with HTML
// - No round-trip for the initial render
// - SEO-safe (conversation title in <head>)
// ============================================================

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService, createConversationService } from '@/services';
import { ChatWindow } from '@/features/chat/components/ChatWindow';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

// ─── Dynamic metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const supabase = await createServerClient();
  const convService = createConversationService(supabase);
  const { data } = await convService.getConversationById(conversationId);

  if (!data) return { title: 'Conversation' };

  const title = data.is_group
    ? (data.group_name ?? 'Group Chat')
    : (data.other_user?.full_name ?? data.other_user?.username ?? 'Chat');

  return { title };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;

  const supabase = await createServerClient();

  // 1. Auth — middleware already guards this, but we need the user object
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect('/login');

  // 2. Fetch profile
  const userService = createUserService(supabase);
  const { data: currentUser } = await userService.getCurrentUser();
  if (!currentUser) redirect('/login');

  // 3. Fetch conversation with participants
  const convService = createConversationService(supabase);
  const { data: conversation } = await convService.getConversationById(conversationId);

  if (!conversation) notFound();

  // 4. Verify participant access
  const isParticipant = conversation.participants.some(
    (p) => p.user_id === currentUser.id && !p.left_at
  );

  if (!isParticipant) {
    // User somehow reached a conversation they're not part of
    redirect('/chat');
  }

  return (
    <ChatWindow
      conversation={conversation}
      participants={conversation.participants}
      currentUser={currentUser}
    />
  );
}
