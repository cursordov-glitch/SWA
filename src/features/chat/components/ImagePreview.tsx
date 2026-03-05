'use client';

// ============================================================
// src/features/chat/components/ImagePreview.tsx
// ============================================================
// Shown after a file is selected — lets user confirm or cancel
// before uploading. Displays a live progress bar during upload.
// ============================================================

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UploadStatus } from '../hooks/useImageUpload';

type Props = {
  uploadStatus: UploadStatus;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ImagePreview({ uploadStatus, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  const visible =
    uploadStatus.stage === 'previewing' || uploadStatus.stage === 'uploading';

  const localUrl =
    visible ? (uploadStatus as { localUrl: string }).localUrl : '';
  const isUploading = uploadStatus.stage === 'uploading';
  const progress    = isUploading ? (uploadStatus as { progress: number }).progress : 0;
  const file        = visible ? (uploadStatus as { file: File }).file : null;

  // Auto-focus confirm on open
  useEffect(() => {
    if (visible) setTimeout(() => confirmRef.current?.focus(), 30);
  }, [visible]);

  // Escape key cancels (only when not uploading)
  useEffect(() => {
    if (!visible) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) onCancel();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, isUploading, onCancel]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={isUploading ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send image"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Send image</h2>
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Cancel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview */}
        <div className="relative bg-gray-50 flex items-center justify-center min-h-[180px] max-h-[340px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localUrl}
            alt="Preview"
            className={cn(
              'max-w-full max-h-[340px] object-contain',
              isUploading && 'opacity-50'
            )}
          />
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center">
                <svg className="w-4 h-4 animate-spin text-pink-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-white drop-shadow-sm">Uploading…</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-[width] duration-500 ease-out"
            style={{ width: `${isUploading ? progress : 0}%` }}
          />
        </div>

        {/* File info */}
        {file && (
          <div className="px-4 py-2 bg-gray-50">
            <p className="text-xs text-gray-500 truncate">{file.name}</p>
            <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={isUploading}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all',
              'bg-gradient-to-r from-pink-500 to-purple-600',
              'hover:shadow-md active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
            )}
          >
            {isUploading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}
