'use client';

// ============================================================
// src/features/chat/components/ImageMessageBubble.tsx
// ============================================================
// Renders a single image message in the chat list.
//
// Three render states:
//   isOptimistic — blob URL visible only to this tab, spinner overlay
//   loaded       — CDN image at full quality, click opens lightbox
//   error        — broken-image placeholder (CDN unreachable / deleted)
//
// Inline lightbox — no external library, just a fixed overlay.
// ============================================================

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { formatMessageTime } from '../utils';

type Props = {
  id: string;
  imageUrl: string | null;
  createdAt: string;
  isMine: boolean;
  isOptimistic?: boolean;
  hasFailed?: boolean;
  showTimestamp?: boolean;
  onRetry?: (id: string) => void;
};

export function ImageMessageBubble({
  id,
  imageUrl,
  createdAt,
  isMine,
  isOptimistic = false,
  hasFailed = false,
  showTimestamp = false,
  onRetry,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const openLightbox = useCallback(() => {
    if (!isOptimistic && !hasFailed && loaded) setLightbox(true);
  }, [isOptimistic, hasFailed, loaded]);

  return (
    <>
      <div className={cn('flex flex-col gap-1', isMine ? 'items-end' : 'items-start')}>
        {/* Image container */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl bg-gray-100 max-w-[240px] min-w-[100px]',
            isMine ? 'rounded-br-sm' : 'rounded-bl-sm',
            isOptimistic && 'opacity-75',
            !isOptimistic && !hasFailed && loaded && 'cursor-pointer'
          )}
          onClick={openLightbox}
          role={!isOptimistic && !hasFailed && loaded ? 'button' : undefined}
          tabIndex={!isOptimistic && !hasFailed && loaded ? 0 : undefined}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openLightbox()}
          aria-label={loaded ? 'View full image' : undefined}
        >
          {/* Shimmer skeleton while loading */}
          {!loaded && !errored && (
            <div className="w-[200px] h-[180px] bg-gray-200 animate-pulse" />
          )}

          {/* Broken-image fallback */}
          {errored && (
            <div className="flex flex-col items-center justify-center w-[200px] h-[150px] text-gray-400 gap-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Image unavailable</span>
            </div>
          )}

          {/* Actual image */}
          {imageUrl && !errored && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Shared image"
              className={cn(
                'w-full h-auto max-h-[320px] object-cover transition-opacity duration-200',
                loaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setLoaded(true)}
              onError={() => { setErrored(true); setLoaded(false); }}
              draggable={false}
            />
          )}

          {/* Upload spinner overlay */}
          {isOptimistic && !hasFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-8 h-8 rounded-full bg-white/85 flex items-center justify-center shadow">
                <svg className="w-4 h-4 animate-spin text-pink-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Failed */}
        {hasFailed && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-red-400">Failed to send</span>
            {onRetry && (
              <button onClick={() => onRetry(id)} className="text-xs text-pink-500 font-medium hover:text-pink-600">
                Retry
              </button>
            )}
          </div>
        )}

        {/* Timestamps */}
        {isOptimistic && !hasFailed && (
          <span className="text-[10px] text-gray-400 px-1">Sending…</span>
        )}
        {!isOptimistic && !hasFailed && (
          <span className={cn('text-[10px] text-gray-400 px-1 transition-opacity', showTimestamp ? 'opacity-100' : 'opacity-0')}>
            {formatMessageTime(createdAt)}
          </span>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && imageUrl && <Lightbox src={imageUrl} onClose={() => setLightbox(false)} />}
    </>
  );
}

// ─── Inline lightbox ──────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full size"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      <a
        href={src}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download
      </a>
    </div>
  );
}
