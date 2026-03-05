'use client';

// ============================================================
// src/features/chat/hooks/useCreateConversation.ts
// ============================================================
// Manages the "New Message" flow:
//   1. Search for users by username/name
//   2. Select a user
//   3. Call ConversationService.createDirectMessage()
//   4. Navigate to the new conversation
//
// If a DM already exists with that user, the DB function
// returns the existing conversation ID — no duplicate created.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { ConversationService } from '@/services/conversation.service';
import { UserService } from '@/services/user.service';
import type { DbUser } from '@/types';

export function useCreateConversation(onSuccess?: () => void) {
  const router = useRouter();

  const supabaseRef = useRef(createClient());
  const convServiceRef = useRef(new ConversationService(supabaseRef.current));
  const userServiceRef = useRef(new UserService(supabaseRef.current));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DbUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Debounced search — fires 400ms after the user stops typing.
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      const result = await userServiceRef.current.searchUsers(query.trim());
      setSearchResults(result.data);
      setSearching(false);
    }, 400);
  }, []);

  /**
   * Start a DM with the selected user.
   * Idempotent — returns existing conversation if one exists.
   */
  const startConversation = useCallback(
    async (otherUser: DbUser) => {
      setCreating(true);
      setError(null);

      const { data: conversationId, error: createError } =
        await convServiceRef.current.createDirectMessage({
          otherUserId: otherUser.id,
        });

      setCreating(false);

      if (createError || !conversationId) {
        setError(createError?.message ?? 'Could not start conversation.');
        return;
      }

      // Reset state
      setSearchQuery('');
      setSearchResults([]);

      onSuccess?.();

      // Navigate to the new/existing conversation
      router.push(`/chat/${conversationId}`);
    },
    [router, onSuccess]
  );

  const reset = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setSearching(false);
    setCreating(false);
  }, []);

  return {
    searchQuery,
    searchResults,
    searching,
    creating,
    error,
    handleSearch,
    startConversation,
    reset,
  };
}
