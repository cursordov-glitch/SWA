'use client';

// ============================================================
// src/features/chat/components/NewConversationModal.tsx
// ============================================================
// Modal for starting a new DM.
// Uses useCreateConversation hook — no direct service calls here.
// ============================================================

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { useCreateConversation } from '../hooks/useCreateConversation';
import type { DbUser } from '@/types';

type NewConversationModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export function NewConversationModal({ open, onClose, onCreated }: NewConversationModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchQuery,
    searchResults,
    searching,
    creating,
    error,
    handleSearch,
    startConversation,
    reset,
  } = useCreateConversation(onCreated);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      reset();
    }
  }, [open, reset]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-x-4 top-1/4 z-50 mx-auto max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label="New message"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New message</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <Input
            ref={inputRef}
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            prefixIcon={
              searching ? (
                <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )
            }
          />
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {error && (
            <div className="px-4 py-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No users found for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}

          {searchQuery.length < 2 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">Type at least 2 characters to search</p>
            </div>
          )}

          {searchResults.map((user) => (
            <UserSearchResult
              key={user.id}
              user={user}
              creating={creating}
              onSelect={startConversation}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

type UserSearchResultProps = {
  user: DbUser;
  creating: boolean;
  onSelect: (user: DbUser) => void;
};

function UserSearchResult({ user, creating, onSelect }: UserSearchResultProps) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3',
        'hover:bg-gray-50 transition-colors text-left',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      onClick={() => onSelect(user)}
      disabled={creating}
    >
      <Avatar
        src={user.avatar_url}
        name={user.full_name ?? user.username}
        size="sm"
        isOnline={user.is_online}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.full_name ?? user.username}
        </p>
        <p className="text-xs text-gray-400 truncate">@{user.username}</p>
      </div>
      {creating && (
        <svg className="ml-auto w-4 h-4 animate-spin text-pink-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
    </button>
  );
}
