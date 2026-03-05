'use client';

// ============================================================
// src/features/search/components/SearchClient.tsx
// ============================================================
// The Client Component that owns the interactive search UI.
// Receives initialQuery from the Server Component (URL ?q= param).
//
// Composition:
//   SearchClient
//     ├── SearchBar          (input + spinner + clear)
//     ├── SearchTabs         (All / People / Conversations / Messages)
//     └── SearchResultsList  (renders the right results for the active tab)
// ============================================================

import { SearchBar }          from './SearchBar';
import { SearchTabs }         from './SearchTabs';
import { SearchResultsList }  from './SearchResultsList';
import { useSearch }          from '../hooks/useSearch';

type Props = {
  initialQuery?: string;
};

export function SearchClient({ initialQuery = '' }: Props) {
  const {
    query,
    tab,
    results,
    loading,
    error,
    hasSearched,
    setQuery,
    setTab,
    clear,
  } = useSearch(initialQuery);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-5 pb-3 border-b border-gray-100 bg-white">
        <h1 className="text-lg font-bold text-gray-900 mb-3 tracking-tight">Search</h1>

        <SearchBar
          value={query}
          onChange={setQuery}
          onClear={clear}
          loading={loading}
        />

        {/* Tabs — only shown once user starts typing */}
        {hasSearched && (
          <div className="mt-3">
            <SearchTabs
              active={tab}
              results={results}
              hasSearched={hasSearched}
              onChange={setTab}
            />
          </div>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <SearchResultsList
          results={results}
          tab={tab}
          query={query}
          loading={loading}
          hasSearched={hasSearched}
        />
      </div>
    </div>
  );
}
