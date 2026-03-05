'use client';

// ============================================================
// src/features/chat/components/UploadButton.tsx
// ============================================================
// Activates image file selection via:
//   1. Click  — opens native OS file picker
//   2. Paste  — Ctrl/Cmd+V with an image in the clipboard
//
// Does NOT upload. Calls onFileSelected(file) and ChatWindow
// passes it to useImageUpload which owns the upload lifecycle.
// ============================================================

import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif';

type Props = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

export function UploadButton({ onFileSelected, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = ''; // reset so same file can be re-selected
    },
    [onFileSelected]
  );

  // Clipboard paste: Ctrl/Cmd+V with an image
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (disabled) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/')
      );
      if (item) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); onFileSelected(file); }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [disabled, onFileSelected]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={cn(
          'shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-full',
          'transition-all duration-150',
          !disabled
            ? 'text-gray-400 hover:text-pink-500 hover:bg-pink-50'
            : 'text-gray-300 cursor-not-allowed opacity-40'
        )}
        aria-label="Attach image"
        title="Attach image (or paste from clipboard)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
    </>
  );
}
