'use client';
// src/features/chat/components/VoiceRecordButton.tsx
// Mic button that shows recording timer when active.
// Sits inside MessageInput next to the send button.

import { cn } from '@/lib/utils';

type Props = {
  isRecording: boolean;
  isUploading: boolean;
  duration:    number;
  disabled:    boolean;
  onStart:     () => void;
  onStop:      () => void;
  onCancel:    () => void;
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function VoiceRecordButton({
  isRecording, isUploading, duration, disabled, onStart, onStop, onCancel,
}: Props) {
  if (isUploading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0 mb-0.5">
        <svg className="w-4 h-4 animate-spin text-pink-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span>Sending…</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 shrink-0 mb-0.5">
        {/* pulse dot */}
        <span className="flex items-center gap-1 text-xs font-medium text-red-500">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {fmt(duration)}
        </span>
        {/* Stop (send) */}
        <button onClick={onStop} title="Send voice message"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white hover:shadow-md transition-all hover:scale-105 active:scale-95">
          <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
        {/* Cancel */}
        <button onClick={onCancel} title="Cancel recording"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onStart}
      disabled={disabled}
      title="Record voice message"
      className={cn(
        'shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150',
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : 'text-gray-400 hover:text-pink-500 hover:bg-pink-50 active:scale-95'
      )}
    >
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"/>
      </svg>
    </button>
  );
}
