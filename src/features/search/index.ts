// ============================================================
// src/features/search/index.ts
// ============================================================

export { SearchClient }          from './components/SearchClient';
export { SearchBar }             from './components/SearchBar';
export { SearchTabs }            from './components/SearchTabs';
export { SearchResultsList }     from './components/SearchResultsList';
export { UserResultCard }        from './components/UserResultCard';
export { ConversationResultCard } from './components/ConversationResultCard';
export { MessageResultCard }     from './components/MessageResultCard';

export { useSearch } from './hooks/useSearch';

export type {
  SearchTab,
  SearchResults,
  SearchState,
  UserResult,
  ConversationResult,
  MessageResult,
} from './types';
