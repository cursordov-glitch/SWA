'use client';
// src/features/chat/hooks/useVoiceRecorder.ts
// State machine: idle → recording → uploading → idle (or error)
// Max 60 seconds; auto-stops at limit.

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MessageWithSender } from '@/types';

const MAX_S = 60;

export type VoiceState =
  | { status: 'idle' }
  | { status: 'recording'; duration: number }
  | { status: 'uploading' }
  | { status: 'error'; message: string };

export function useVoiceRecorder(conversationId: string, onSent?: (m: MessageWithSender) => void) {
  const [state, setState]  = useState<VoiceState>({ status: 'idle' });
  const mediaRef           = useRef<MediaRecorder | null>(null);
  const chunksRef          = useRef<Blob[]>([]);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const durRef             = useRef(0);
  const streamRef          = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const upload = useCallback(async (blob: Blob, duration: number) => {
    setState({ status: 'uploading' });
    const form = new FormData();
    form.append('file', blob, `voice-${Date.now()}.webm`);
    form.append('conversationId', conversationId);
    form.append('duration', String(Math.round(duration)));
    try {
      const res  = await fetch('/api/voice/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) { setState({ status: 'error', message: json.error ?? 'Upload failed' }); return; }
      onSent?.(json.data);
      setState({ status: 'idle' });
    } catch {
      setState({ status: 'error', message: 'Network error. Try again.' });
    }
  }, [conversationId, onSent]);

  const start = useCallback(async () => {
    if (state.status !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime     = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current  = recorder;
      chunksRef.current = [];
      durRef.current    = 0;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stopTimer();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) { setState({ status: 'error', message: 'Empty recording' }); return; }
        await upload(blob, durRef.current);
      };
      recorder.start(100);

      setState({ status: 'recording', duration: 0 });
      timerRef.current = setInterval(() => {
        durRef.current += 1;
        setState({ status: 'recording', duration: durRef.current });
        if (durRef.current >= MAX_S) mediaRef.current?.stop();
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone permission denied' : 'Could not access microphone';
      setState({ status: 'error', message: msg });
    }
  }, [state.status, upload]);

  const stop = useCallback(() => {
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    stopTimer();
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    duration: state.status === 'recording' ? state.duration : 0,
    isRecording:  state.status === 'recording',
    isUploading:  state.status === 'uploading',
    start, stop, cancel,
    dismissError: useCallback(() => setState({ status: 'idle' }), []),
  };
}
