'use client';

// ============================================================
// src/features/chat/hooks/useImageUpload.ts
// ============================================================
// Owns the complete image-send lifecycle for a conversation:
//
//   Stage 1 — SELECT
//     File chosen via UploadButton (click or paste)
//     → client-side validate (type + size)
//     → createObjectURL() for instant local preview
//     → state: 'previewing'
//
//   Stage 2 — CONFIRM
//     User presses "Send" in the ImagePreview modal
//     → insert optimistic image message (blob URL visible immediately)
//     → POST /api/messages/upload   (multipart)
//     → POST /api/messages/send     (JSON, messageType: 'image')
//     → replace optimistic stub with confirmed DB row
//     → state: 'idle'
//
//   Failure path:
//     Any network/API error → mark optimistic message as hasFailed
//     → user can dismiss and retry by selecting again
//
//   Cleanup:
//     revokeObjectURL() called after confirmed send OR on cancel
//     to prevent memory leaks from hanging blob URLs.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import type { DbUser, MessageWithSender } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | { stage: 'idle' }
  | { stage: 'previewing'; file: File; localUrl: string }
  | { stage: 'uploading';  file: File; localUrl: string; progress: number }
  | { stage: 'error';      message: string };

const MAX_BYTES  = 5 * 1024 * 1024; // 5 MB — mirrors API limit
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

// ─── Hook ─────────────────────────────────────────────────────────────────────

type Options = {
  conversationId: string;
  currentUser: DbUser;
  /** Called to inject optimistic + confirmed messages into the chat list */
  injectMessage: (msg: MessageWithSender & { isOptimistic?: boolean; hasFailed?: boolean }) => void;
  /** Called to swap optimistic stub → confirmed DB row */
  replaceMessage: (optimisticId: string, confirmed: MessageWithSender) => void;
  /** Called to mark the optimistic stub as failed */
  failMessage: (optimisticId: string) => void;
};

export function useImageUpload({
  conversationId,
  currentUser,
  injectMessage,
  replaceMessage,
  failMessage,
}: Options) {
  const [status, setStatus] = useState<UploadStatus>({ stage: 'idle' });
  const blobUrlRef = useRef<string | null>(null);

  // ── Validate client-side ──────────────────────────────────────────────────

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME.has(file.type.toLowerCase()))
      return 'Unsupported type. Allowed: JPEG, PNG, WebP, GIF';
    if (file.size > MAX_BYTES)
      return `Image too large. Max ${MAX_BYTES / 1024 / 1024}MB`;
    return null;
  }, []);

  // ── Stage 1: File selected ────────────────────────────────────────────────

  const selectFile = useCallback((file: File) => {
    // Revoke any previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const err = validate(file);
    if (err) { setStatus({ stage: 'error', message: err }); return; }

    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setStatus({ stage: 'previewing', file, localUrl });
  }, [validate]);

  // ── Cancel preview ────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setStatus({ stage: 'idle' });
  }, []);

  // ── Stage 2: Confirm + send ───────────────────────────────────────────────

  const confirmSend = useCallback(async () => {
    if (status.stage !== 'previewing') return;
    const { file, localUrl } = status;

    setStatus({ stage: 'uploading', file, localUrl, progress: 10 });

    // ── A. Inject optimistic message ──────────────────────────────────────
    // Uses the local blob URL so the image is visible immediately —
    // no network round trip required for the sender's own view.
    const optimisticId = `optimistic-img-${Date.now()}`;
    injectMessage({
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: currentUser.id,
      message_type: 'image',
      content: localUrl,          // blob URL — only visible to this browser tab
      media_url: localUrl,
      media_type: 'image',
      media_metadata: { size: file.size, mime_type: file.type },
      reply_to_id: null,
      reactions: {},
      deleted_at: null,
      deleted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender_username: currentUser.username,
      sender_full_name: currentUser.full_name,
      sender_avatar_url: currentUser.avatar_url,
      isOptimistic: true,
    });

    // ── B. Upload binary to storage ───────────────────────────────────────
    setStatus((s) => s.stage === 'uploading' ? { ...s, progress: 35 } : s);

    const form = new FormData();
    form.append('file', file);
    form.append('conversationId', conversationId);

    let cdnUrl: string;
    try {
      const res = await fetch('/api/messages/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      cdnUrl = json.url as string;
    } catch (err) {
      failMessage(optimisticId);
      setStatus({ stage: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
      URL.revokeObjectURL(localUrl);
      blobUrlRef.current = null;
      return;
    }

    setStatus((s) => s.stage === 'uploading' ? { ...s, progress: 70 } : s);

    // ── C. Record message in database ─────────────────────────────────────
    // The existing /api/messages/send route already supports imageType: 'image'
    // and mediaUrl — no changes needed there.
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messageType: 'image',
          content:  cdnUrl,   // content stores the CDN URL consistently
          mediaUrl: cdnUrl,
          mediaType: 'image',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save message');

      // Swap optimistic stub → confirmed DB row (with real UUID + CDN URL)
      const confirmed: MessageWithSender = {
        ...json.data,
        sender_username: currentUser.username,
        sender_full_name: currentUser.full_name,
        sender_avatar_url: currentUser.avatar_url,
      };
      replaceMessage(optimisticId, confirmed);

    } catch (err) {
      failMessage(optimisticId);
      setStatus({ stage: 'error', message: err instanceof Error ? err.message : 'Send failed' });
      URL.revokeObjectURL(localUrl);
      blobUrlRef.current = null;
      return;
    }

    // ── D. Cleanup ────────────────────────────────────────────────────────
    URL.revokeObjectURL(localUrl);
    blobUrlRef.current = null;
    setStatus({ stage: 'idle' });
  }, [status, conversationId, currentUser, injectMessage, replaceMessage, failMessage]);

  const dismissError = useCallback(() => setStatus({ stage: 'idle' }), []);

  return {
    uploadStatus: status,
    selectFile,
    cancel,
    confirmSend,
    dismissError,
    isUploading: status.stage === 'uploading',
    isPreviewing: status.stage === 'previewing',
  };
}
