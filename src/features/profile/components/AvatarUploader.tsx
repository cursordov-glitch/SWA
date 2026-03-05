'use client';

// ============================================================
// src/features/profile/components/AvatarUploader.tsx
// ============================================================
// Renders the avatar upload zone on the settings page.
// Supports: click to pick, drag-and-drop, clipboard paste.
// Shows a preview before confirming upload.
// ============================================================

import { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import type { AvatarUploadState } from '../types';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

type Props = {
  currentAvatarUrl: string | null;
  displayName: string;
  avatarState: AvatarUploadState;
  onFileSelected: (file: File) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDismissError: () => void;
};

export function AvatarUploader({
  currentAvatarUrl,
  displayName,
  avatarState,
  onFileSelected,
  onConfirm,
  onCancel,
  onDismissError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME.has(file.type.toLowerCase())) return 'Unsupported type. Use JPEG, PNG, or WebP.';
    if (file.size > MAX_BYTES) return `Image too large. Maximum ${MAX_MB}MB.`;
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    setClientError(null);
    const err = validate(file);
    if (err) { setClientError(err); return; }
    onFileSelected(file);
  }, [validate, onFileSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const isUploading   = avatarState.stage === 'uploading';
  const isPreviewing  = avatarState.stage === 'previewing';
  const serverError   = avatarState.stage === 'error' ? avatarState.message : null;
  const previewUrl    = (isPreviewing || isUploading)
    ? (avatarState as { localUrl: string }).localUrl
    : null;

  const displayUrl = previewUrl ?? currentAvatarUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar preview + drop zone */}
      <div
        className={cn(
          'relative group cursor-pointer select-none',
          'rounded-full ring-4 ring-offset-2 transition-all duration-200',
          dragging
            ? 'ring-pink-400 scale-105'
            : isPreviewing
            ? 'ring-purple-400'
            : 'ring-gray-200 hover:ring-pink-300'
        )}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Change profile picture"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <Avatar src={displayUrl} name={displayName} size="xl" />

        {/* Camera overlay */}
        {!isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/35 transition-all duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Upload spinner */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <svg className="w-7 h-7 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Upload hint */}
      {avatarState.stage === 'idle' && (
        <p className="text-xs text-gray-400 text-center">
          Click or drag to change photo<br />
          <span className="text-gray-300">JPEG, PNG, WebP · Max {MAX_MB}MB</span>
        </p>
      )}

      {/* Preview confirm / cancel */}
      {isPreviewing && (
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-md transition-all"
          >
            Save photo
          </button>
        </div>
      )}

      {isUploading && (
        <p className="text-xs text-gray-400">Uploading…</p>
      )}

      {/* Error messages */}
      {(clientError || serverError) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-red-600">{clientError ?? serverError}</p>
          <button
            onClick={() => { setClientError(null); if (serverError) onDismissError(); }}
            className="ml-auto text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
