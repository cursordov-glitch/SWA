'use client';

// ============================================================
// src/features/search/components/SearchBar.tsx
// ============================================================

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  loading: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  onClear,
  loading,
  autoFocus = true,
  placeholder = 'Search people, messages, conversations…',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="relative flex items-center">
      {/* Search icon */}
      <span className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center">
        {loading ? (
          <svg className="w-4 h-4 animate-spin text-pink-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </span>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-11 rounded-2xl border bg-gray-50 pl-10 pr-10 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent focus:bg-white',
          'transition-all duration-150',
          'border-gray-200 hover:border-gray-300',
        )}
        autoComplete="off"
        spellCheck={false}
        aria-label="Search"
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
