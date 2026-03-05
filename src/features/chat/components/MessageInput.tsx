'use client';

// ============================================================
// src/features/chat/components/MessageInput.tsx
// ============================================================
// Step 7: UploadButton (image attach)
// Step 11: reply-to banner + VoiceRecordButton
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { UploadButton } from './UploadButton';
import { VoiceRecordButton } from './VoiceRecordButton';

const MAX_CHARS      = 4000;
const WARN_THRESHOLD = 3800;

type MessageInputProps = {
  onSend: (content: string) => Promise<boolean>;
  onImageSelected?: (file: File) => void;
  onTyping?: () => void;
  onStoppedTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Step 11: reply-to banner */
  replyTo?: { id: string; content: string | null; senderName: string | null } | null;
  onCancelReply?: () => void;
  /** Step 11: voice recording */
  voiceState?: { isRecording: boolean; isUploading: boolean; duration: number };
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  onVoiceCancel?: () => void;
};

export function MessageInput({
  onSend,
  onImageSelected,
  onTyping,
  onStoppedTyping,
  disabled = false,
  placeholder = 'Message…',
  replyTo = null,
  onCancelReply,
  voiceState,
  onVoiceStart,
  onVoiceStop,
  onVoiceCancel,
}: MessageInputProps) {
  const [value, setValue]     = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  const trimmed     = value.trim();
  const charCount   = value.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isNearLimit = charCount >= WARN_THRESHOLD;
  const canSend     = trimmed.length > 0 && !isOverLimit && !sending && !disabled;

  const showVoiceButton = !!(onVoiceStart && !value.trim());

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 124)}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setValue(v);
      if (v.trim().length > 0) { onTyping?.(); } else { onStoppedTyping?.(); }
    },
    [onTyping, onStoppedTyping]
  );

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const content = trimmed;
    setValue('');
    setSending(true);
    onStoppedTyping?.();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const ok = await onSend(content);
    setSending(false);
    textareaRef.current?.focus();
    if (!ok) setValue(content);
  }, [canSend, trimmed, onSend, onStoppedTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [handleSend]
  );

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white">

      {/* Step 11: Reply-to banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200 min-w-0">
            <div className="w-0.5 h-8 rounded-full bg-pink-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-pink-600 truncate">
                {replyTo.senderName ?? 'Message'}
              </p>
              <p className="text-xs text-gray-500 truncate">{replyTo.content ?? '…'}</p>
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
            aria-label="Cancel reply"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="px-4 py-3">
        <div
          className={cn(
            'flex items-end gap-2 rounded-2xl border bg-gray-50 px-3 py-2 transition-all duration-150',
            'focus-within:border-pink-300 focus-within:bg-white focus-within:shadow-sm',
            isOverLimit ? 'border-red-300' : 'border-gray-200'
          )}
        >
          {/* Image upload */}
          <UploadButton
            onFileSelected={onImageSelected ?? (() => {})}
            disabled={disabled || sending}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={sending ? 'Sending…' : placeholder}
            disabled={disabled || sending}
            rows={1}
            maxLength={MAX_CHARS + 100}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm text-gray-900',
              'placeholder:text-gray-400 focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'max-h-[124px] leading-5 py-1.5'
            )}
            aria-label="Message input"
          />

          {/* Character counter */}
          {isNearLimit && (
            <span className={cn('shrink-0 text-[11px] font-medium mb-1', isOverLimit ? 'text-red-500' : 'text-yellow-500')}>
              {MAX_CHARS - charCount}
            </span>
          )}

          {/* Voice button (when input empty) or Send button */}
          {showVoiceButton && voiceState ? (
            <VoiceRecordButton
              isRecording={voiceState.isRecording}
              isUploading={voiceState.isUploading}
              duration={voiceState.duration}
              disabled={disabled}
              onStart={onVoiceStart!}
              onStop={onVoiceStop!}
              onCancel={onVoiceCancel!}
            />
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150',
                canSend
                  ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-300 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>

    </div>
  );
}
