'use client';

// ============================================================
// src/features/search/hooks/useSearch.ts
// ============================================================
// Owns all search state for the search page.
//
// Behaviour:
//   - Input fires a debounced search 350ms after the user stops typing
//   - Tab switching re-uses cached results (no refetch needed)
//   - Tab switching with a new query triggers a fresh fetch
//   - Empty or <2-char query clears results immediately
//   - URL ?q= is synced so results survive page refresh
//   - AbortController cancels in-flight requests when a new
//     query arrives (no stale results from slow responses)
//
// Architecture:
//   SearchPage (Server Component)
//     └── SearchClient (Client Component)
//           └── useSearch (this hook)
//                 └── GET /api/search?q=...&type=all
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  SearchState,
  SearchTab,
  SearchResults,
} from '../types';

const DEBOUNCE_MS = 350;
const MIN_QUERY   = 2;

const EMPTY_RESULTS: SearchResults = {
  users: [],
  conversations: [],
  messages: [],
};

const INITIAL_STATE: SearchState = {
  query:      '',
  tab:        'all',
  results:    EMPTY_RESULTS,
  loading:    false,
  error:      null,
  hasSearched: false,
};

export function useSearch(initialQuery = '') {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<SearchState>({
    ...INITIAL_STATE,
    query: initialQuery,
  });

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);

  // ── Core fetch ────────────────────────────────────────────────────────────

  const fetchResults = useCallback(async (query: string, tab: SearchTab) => {
    if (query.trim().length < MIN_QUERY) {
      setState((s) => ({ ...s, results: EMPTY_RESULTS, loading: false, hasSearched: false }));
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Map UI tab names to API type param
      const typeMap: Record<SearchTab, string> = {
        all:           'all',
        people:        'users',
        conversations: 'conversations',
        messages:      'messages',
      };

      const params = new URLSearchParams({
        q:    query.trim(),
        type: typeMap[tab],
      });

      const res = await fetch(`/api/search?${params}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Search failed (${res.status})`);
      }

      const json = await res.json();

      setState((s) => ({
        ...s,
        results:    json,
        loading:    false,
        hasSearched: true,
        error:      null,
      }));

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // cancelled
      setState((s) => ({
        ...s,
        loading:    false,
        error:      err instanceof Error ? err.message : 'Search failed',
        hasSearched: true,
      }));
    }
  }, []);

  // ── Input change handler (debounced) ─────────────────────────────────────

  const setQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, query }));

    // Clear immediately for short queries
    if (query.trim().length < MIN_QUERY) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setState((s) => ({
        ...s,
        query,
        results: EMPTY_RESULTS,
        loading: false,
        hasSearched: false,
        error: null,
      }));
      // Sync URL — clear q param
      const next = new URLSearchParams(searchParams.toString());
      next.delete('q');
      router.replace(`/search?${next.toString()}`, { scroll: false });
      return;
    }

    // Debounce the actual fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Sync URL
      const next = new URLSearchParams(searchParams.toString());
      next.set('q', query.trim());
      router.replace(`/search?${next.toString()}`, { scroll: false });

      fetchResults(query, state.tab);
    }, DEBOUNCE_MS);
  }, [fetchResults, state.tab, router, searchParams]);

  // ── Tab change handler ────────────────────────────────────────────────────

  const setTab = useCallback((tab: SearchTab) => {
    setState((s) => ({ ...s, tab }));

    // If there's a current query, re-fetch for the new tab's type filter
    if (state.query.trim().length >= MIN_QUERY) {
      fetchResults(state.query, tab);
    }
  }, [fetchResults, state.query]);

  // ── Run initial search from URL param ─────────────────────────────────────

  useEffect(() => {
    if (initialQuery.trim().length >= MIN_QUERY) {
      fetchResults(initialQuery, 'all');
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setState(INITIAL_STATE);
    router.replace('/search', { scroll: false });
  }, [router]);

  return {
    query:      state.query,
    tab:        state.tab,
    results:    state.results,
    loading:    state.loading,
    error:      state.error,
    hasSearched: state.hasSearched,
    setQuery,
    setTab,
    clear,
  };
}
