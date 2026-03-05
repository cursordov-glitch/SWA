'use client';

// ============================================================
// src/features/search/components/SearchResultsList.tsx
// ============================================================
// Renders the correct result section(s) based on the active tab.
// Handles empty state, loading skeleton, and section headers.
// ============================================================

import { UserResultCard }         from './UserResultCard';
import { ConversationResultCard } from './ConversationResultCard';
import { MessageResultCard }      from './MessageResultCard';
import type { SearchTab, SearchResults } from '../types';

type Props = {
  results:    SearchResults;
  tab:        SearchTab;
  query:      string;
  loading:    boolean;
  hasSearched: boolean;
};

export function SearchResultsList({ results, tab, query, loading, hasSearched }: Props) {
  const showUsers  = tab === 'all' || tab === 'people';
  const showConvs  = tab === 'all' || tab === 'conversations';
  const showMsgs   = tab === 'all' || tab === 'messages';

  const hasResults =
    (showUsers  && results.users.length > 0) ||
    (showConvs  && results.conversations.length > 0) ||
    (showMsgs   && results.messages.length > 0);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) return <SearchSkeleton />;

  // ── Pre-search empty state ────────────────────────────────────────────────
  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">Search everything</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Find people to message, search your conversations, or look up past messages
        </p>
      </div>
    );
  }

  // ── No results state ──────────────────────────────────────────────────────
  if (!hasResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">No results for &ldquo;{query}&rdquo;</p>
        <p className="text-xs text-gray-400 mt-1">Try a different spelling or search term</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-8">

      {/* ── People ──────────────────────────────────────────────────── */}
      {showUsers && results.users.length > 0 && (
        <section>
          <SectionHeader title="People" count={results.users.length} />
          <div className="flex flex-col">
            {results.users.map((user) => (
              <UserResultCard key={user.id} user={user} query={query} />
            ))}
          </div>
        </section>
      )}

      {/* ── Conversations ───────────────────────────────────────────── */}
      {showConvs && results.conversations.length > 0 && (
        <section>
          <SectionHeader title="Conversations" count={results.conversations.length} />
          <div className="flex flex-col">
            {results.conversations.map((conv) => (
              <ConversationResultCard key={conv.id} conv={conv} query={query} />
            ))}
          </div>
        </section>
      )}

      {/* ── Messages ────────────────────────────────────────────────── */}
      {showMsgs && results.messages.length > 0 && (
        <section>
          <SectionHeader title="Messages" count={results.messages.length} />
          <div className="flex flex-col">
            {results.messages.map((msg) => (
              <MessageResultCard key={msg.message_id} msg={msg} query={query} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
      <span className="text-xs text-gray-300 font-medium">{count}</span>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3 bg-gray-200 rounded-full w-32 mb-2" />
            <div className="h-2.5 bg-gray-100 rounded-full w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
