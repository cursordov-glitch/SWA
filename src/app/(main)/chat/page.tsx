// ============================================================
// src/app/(main)/chat/page.tsx
// ============================================================
// Shown when no conversation is selected (desktop: right panel).
// On mobile this IS the conversations page — sidebar is full width.
// ============================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages',
};

export default function ChatPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 select-none">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-5">
        <svg
          className="w-10 h-10 text-pink-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-gray-800">Your messages</h2>
      <p className="text-sm text-gray-400 mt-2 max-w-xs leading-relaxed">
        Select a conversation from the sidebar, or start a new message with the pencil icon.
      </p>
    </div>
  );
}
