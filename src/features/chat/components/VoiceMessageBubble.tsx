'use client';
// src/features/chat/components/VoiceMessageBubble.tsx
// HTML5 audio player styled to match the chat bubble design.
// Extracts duration from the message content string "Voice message (Xs)".

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = { mediaUrl: string; content: string | null; isMine: boolean };

export function VoiceMessageBubble({ mediaUrl, content, isMine }: Props) {
  const audioRef           = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Parse stored duration from content like "Voice message (12s)"
  const storedDuration = content ? parseInt(content.match(/\((\d+)s\)/)?.[1] ?? '0', 10) : 0;
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else         { audioRef.current.play().catch(() => {}); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const displayDuration = storedDuration > 0 ? storedDuration : undefined;

  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[180px] max-w-[260px]',
      isMine
        ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-br-sm'
        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
    )}>
      <audio
        ref={audioRef}
        src={mediaUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const { currentTime: ct, duration: d } = audioRef.current;
          setCurrentTime(ct);
          setProgress(d ? (ct / d) * 100 : 0);
        }}
        preload="metadata"
      />

      {/* Play/pause */}
      <button
        onClick={toggle}
        className={cn(
          'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-200 hover:bg-gray-300',
          'transition-colors'
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Waveform / progress bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div className={cn('h-1.5 rounded-full overflow-hidden', isMine ? 'bg-white/30' : 'bg-gray-300')}>
          <div
            className={cn('h-full rounded-full transition-all', isMine ? 'bg-white' : 'bg-pink-500')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={cn('text-[10px]', isMine ? 'text-white/70' : 'text-gray-400')}>
          {playing
            ? fmt(currentTime)
            : displayDuration ? fmt(displayDuration) : '0:00'
          }
        </span>
      </div>

      {/* Mic icon */}
      <svg className={cn('w-4 h-4 shrink-0', isMine ? 'text-white/60' : 'text-gray-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"/>
      </svg>
    </div>
  );
}
