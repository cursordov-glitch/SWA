'use client';

// ============================================================
// src/features/chat/components/ConversationList.tsx
// ============================================================
// Step 9 additions:
//   - Avatar in sidebar header now links to /profile/{username}
//   - Settings gear icon added to header (links to /settings)
//   - No data-fetching changes — profile data already present
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { Avatar }               from '@/components/ui/Avatar';
import { ConversationItem }     from './ConversationItem';
import { NewConversationModal } from './NewConversationModal';
import { UnreadBadge }          from './UnreadBadge';

import { useConversations }   from '../hooks/useConversations';
import { useRealtimeSidebar } from '../hooks/useRealtimeSidebar';
import { useUnreadCount }     from '../hooks/useUnreadCount';

import { createClient } from '@/lib/supabase/client';
import type { DbUser } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type ConversationListProps = {
  currentUser: DbUser;
};

export function ConversationList({ currentUser }: ConversationListProps) {
  const params = useParams();
  const activeConversationId = params?.conversationId as string | undefined;

  const [modalOpen, setModalOpen] = useState(false);

  const { conversations, loading, error, hasMore, loadMore, refresh } =
    useConversations(currentUser.id);

  useRealtimeSidebar({ currentUserId: currentUser.id, onRefresh: refresh });

  const { totalUnread, notifPermission, requestNotificationPermission, showNotification } =
    useUnreadCount({ currentUserId: currentUser.id, activeConversationId });

  const supabaseRef      = useRef(createClient());
  const channelRef       = useRef<RealtimeChannel | null>(null);
  const activeIdRef      = useRef(activeConversationId);
  const conversationsRef = useRef(conversations);

  useEffect(() => { activeIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`notif:${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_status', filter: `user_id=eq.${currentUser.id}` },
        async (payload) => {
          const row = payload.new as { message_id: string; status: string };
          const { data: msg } = await supabase
            .from('messages')
            .select('conversation_id, sender_id, content, message_type')
            .eq('id', row.message_id)
            .single();
          if (!msg || msg.conversation_id === activeIdRef.current) return;
          const conv = conversationsRef.current.find((c) => c.id === msg.conversation_id);
          const conversationName = conv?.display_name ?? 'New message';
          const { data: sender } = await supabase
            .from('users').select('full_name, username').eq('id', msg.sender_id ?? '').single();
          const senderName = sender?.full_name ?? sender?.username ?? 'Someone';
          const body = msg.message_type === 'image'
            ? '📷 Sent an image'
            : (msg.content ?? 'New message').slice(0, 100);
          showNotification(`${senderName} · ${conversationName}`, body, msg.conversation_id);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [currentUser.id, showNotification]);

  const handleRequestNotif = useCallback(async () => {
    await requestNotificationPermission();
  }, [requestNotificationPermission]);

  const handleModalClose = useCallback(() => setModalOpen(false), []);
  const handleConversationCreated = useCallback(() => {
    setModalOpen(false);
    refresh();
  }, [refresh]);

  const displayName = currentUser.full_name ?? currentUser.username;

  return (
    <div className="flex flex-col h-full">
      {/* ── Sidebar Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        {/* Left: avatar (links to own profile) + name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Step 9: avatar now links to own profile page */}
          <Link
            href={`/profile/${currentUser.username}`}
            className="shrink-0 hover:opacity-80 transition-opacity"
            title="View your profile"
          >
            <Avatar
              src={currentUser.avatar_url}
              name={displayName}
              size="sm"
            />
          </Link>
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Step 9: name also links to own profile */}
            <Link
              href={`/profile/${currentUser.username}`}
              className="font-semibold text-gray-900 text-sm hover:text-pink-500 transition-colors truncate"
            >
              {displayName}
            </Link>
            {totalUnread > 0 && <UnreadBadge count={totalUnread} variant="sidebar" />}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Notification permission bell */}
          {'Notification' in (typeof window !== 'undefined' ? window : {}) &&
            notifPermission === 'default' && (
            <button
              onClick={handleRequestNotif}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-pink-500 transition-colors"
              aria-label="Enable notifications"
              title="Enable notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          )}

          {/* Step 10: Search icon */}
          <Link
            href="/search"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Search"
            title="Search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          {/* Step 9: Settings gear icon */}
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* New message button */}
          <button
            onClick={() => setModalOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="New message"
            title="New message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Section Title ───────────────────────────────────────────── */}
      <div className="px-4 pb-2 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Messages
        </h2>
      </div>

      {/* ── List ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {loading && conversations.length === 0 && (
          <div className="flex flex-col gap-1 px-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-400">{error}</p>
            <button onClick={refresh} className="mt-2 text-xs text-pink-500 hover:text-pink-600 font-medium">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">Start a new message to connect</p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold hover:shadow-md transition-all"
            >
              Send a message
            </button>
          </div>
        )}

        {conversations.map((item) => (
          <ConversationItem
            key={item.id}
            item={item}
            isActive={item.id === activeConversationId}
            currentUserId={currentUser.id}
          />
        ))}

        {hasMore && (
          <div className="px-4 py-2 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-pink-500 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <NewConversationModal
        open={modalOpen}
        onClose={handleModalClose}
        onCreated={handleConversationCreated}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse">
      <div className="w-11 h-11 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-2">
          <div className="h-3 bg-gray-200 rounded-full w-28" />
          <div className="h-3 bg-gray-200 rounded-full w-10" />
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full w-40" />
      </div>
    </div>
  );
}
