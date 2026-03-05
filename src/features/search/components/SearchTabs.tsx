'use client';

// ============================================================
// src/features/search/components/SearchTabs.tsx
// ============================================================

import { cn } from '@/lib/utils';
import type { SearchTab, SearchResults } from '../types';
import { tabCount } from '../types';

type TabConfig = { id: SearchTab; label: string };

const TABS: TabConfig[] = [
  { id: 'all',           label: 'All'           },
  { id: 'people',        label: 'People'        },
  { id: 'conversations', label: 'Conversations' },
  { id: 'messages',      label: 'Messages'      },
];

type Props = {
  active: SearchTab;
  results: SearchResults;
  hasSearched: boolean;
  onChange: (tab: SearchTab) => void;
};

export function SearchTabs({ active, results, hasSearched, onChange }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist">
      {TABS.map((tab) => {
        const count   = hasSearched ? tabCount(tab.id, results) : null;
        const isActive = tab.id === active;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150',
              isActive
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            )}
          >
            {tab.label}
            {count !== null && count > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold',
                isActive
                  ? 'bg-white/25 text-white'
                  : 'bg-gray-200 text-gray-500'
              )}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
