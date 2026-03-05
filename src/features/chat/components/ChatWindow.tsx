'use client';

// ============================================================
// src/features/chat/components/ChatWindow.tsx
// ============================================================
// Step 8: useMessageStatus → statusMap → SeenIndicator
// Step 11: reactions (useReactions), reply state, voice recording (useVoiceRecorder)
// ============================================================

import { useCallback, useMemo, useState } from 'react';

import { ChatHeader }      from './ChatHeader';
import { MessageList }     from './MessageList';
import { MessageInput }    from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { ImagePreview }    from './ImagePreview';

import { useMessages }         from '../hooks/useMessages';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useTypingIndicator }  from '../hooks/useTypingIndicator';
import { usePresence }         from '../hooks/usePresence';
import { useImageUpload }      from '../hooks/useImageUpload';
import { useMessageStatus }    from '../hooks/useMessageStatus';
import { useReactions }        from '../hooks/useReactions';
import { useVoiceRecorder }    from '../hooks/useVoiceRecorder';
import type { OptimisticMessage } from '../hooks/useMessages';

import type { DbConversation, DbUser, ParticipantWithProfile } from '@/types';

type ChatWindowProps = {
  conversation: DbConversation;
  participants: ParticipantWithProfile[];
  currentUser: DbUser;
};

export function ChatWindow({ conversation, participants, currentUser }: ChatWindowProps) {
  // ── Step 5: HTTP fetch + optimistic text send ─────────────────────────────
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    sendMessage,
    retryMessage,
    loadMore,
    addMessage,
    injectMessage,
    replaceMessage,
    failMessage,
    sendReply,
    updateReactions,
  } = useMessages(conversation.id, currentUser);

  // ── Step 6: Realtime messages ─────────────────────────────────────────────
  useRealtimeMessages({
    conversationId: conversation.id,
    currentUser,
    onNewMessage: addMessage,
  });

  const { typingText, notifyTyping, notifyStoppedTyping } = useTypingIndicator({
    conversationId: conversation.id,
    currentUser,
  });

  const { isUserOnline } = usePresence({
    conversationId: conversation.id,
    currentUser,
  });

  // ── Step 7: Image upload ──────────────────────────────────────────────────
  const {
    uploadStatus,
    selectFile,
    cancel: cancelUpload,
    confirmSend: confirmImageSend,
    isUploading,
  } = useImageUpload({
    conversationId: conversation.id,
    currentUser,
    injectMessage,
    replaceMessage,
    failMessage,
  });

  // ── Step 8: Message status (seen indicators) ──────────────────────────────
  // Derive the Set of message IDs sent by the current user.
  // useMemo so the Set reference is stable when the list hasn't changed.
  const myMessageIds = useMemo(
    () =>
      new Set(
        messages
          .filter((m) => m.sender_id === currentUser.id && !m.isOptimistic)
          .map((m) => m.id)
      ),
    // Re-derive when the list changes. Using messages.length as the
    // dependency is intentional — we only need to rebuild when messages
    // are added/removed, not when individual fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length, currentUser.id]
  );

  const { statusMap, setLocalStatus } = useMessageStatus({
    conversationId: conversation.id,
    currentUserId: currentUser.id,
    myMessageIds,
  });

  // ── Step 11: reply state ──────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<OptimisticMessage | null>(null);
  const handleSetReply = useCallback((msg: OptimisticMessage) => setReplyTo(msg), []);
  const handleCancelReply = useCallback(() => setReplyTo(null), []);

  // ── Step 11: reactions ────────────────────────────────────────────────────
  const { toggle: toggleReaction } = useReactions(currentUser.id, updateReactions);

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg) toggleReaction(messageId, emoji, msg.reactions ?? {});
    },
    [messages, toggleReaction]
  );

  // ── Step 11: voice recording ──────────────────────────────────────────────
  const { duration: voiceDuration, isRecording, isUploading: isVoiceUploading,
          start: startVoice, stop: stopVoice, cancel: cancelVoice } =
    useVoiceRecorder(conversation.id, addMessage);

  // ── Derived values ────────────────────────────────────────────────────────

  const otherParticipant = !conversation.is_group
    ? participants.find((p) => p.user_id !== currentUser.id)
    : undefined;

  const otherUser = otherParticipant?.profile ?? null;

  const enrichedOtherUser = otherUser
    ? { ...otherUser, is_online: isUserOnline(otherUser.id) || (otherUser.is_online ?? false) }
    : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (content: string): Promise<boolean> => {
      notifyStoppedTyping();
      const ok = replyTo
        ? await sendReply(content, replyTo.id)
        : await sendMessage(content);
      if (ok) setReplyTo(null);

      // After a successful send, find the last message from us and set 'sent'
      // status immediately so the indicator doesn't flash blank.
      // The optimistic message's ID is temporary; status will update when
      // the realtime subscription fires with the confirmed row.
      if (ok) {
        const lastMine = [...messages].reverse().find(
          (m) => m.sender_id === currentUser.id && m.isOptimistic
        );
        if (lastMine) setLocalStatus(lastMine.id, 'sent');
      }
      return ok;
    },
    [sendMessage, sendReply, replyTo, notifyStoppedTyping, messages, currentUser.id, setLocalStatus]
  );

  const handleImageSelected = useCallback(
    (file: File) => { selectFile(file); },
    [selectFile]
  );

  const inputDisabled = sending || isUploading || isRecording || isVoiceUploading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHeader
        conversation={conversation}
        otherUser={enrichedOtherUser}
        isGroup={conversation.is_group}
        participantCount={participants.length}
      />

      <MessageList
        messages={messages}
        currentUser={currentUser}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRetry={retryMessage}
        statusMap={statusMap}
        onReact={handleReact}
        onReply={handleSetReply}
      />

      <TypingIndicator text={typingText} />

      <MessageInput
        onSend={handleSend}
        onImageSelected={handleImageSelected}
        onTyping={notifyTyping}
        onStoppedTyping={notifyStoppedTyping}
        disabled={inputDisabled}
        replyTo={replyTo ? { id: replyTo.id, content: replyTo.content, senderName: replyTo.sender_full_name ?? replyTo.sender_username ?? null } : null}
        onCancelReply={handleCancelReply}
        voiceState={{ isRecording, isUploading: isVoiceUploading, duration: voiceDuration }}
        onVoiceStart={startVoice}
        onVoiceStop={stopVoice}
        onVoiceCancel={cancelVoice}
        placeholder={`Message ${
          !conversation.is_group && enrichedOtherUser
            ? (enrichedOtherUser.full_name ?? `@${enrichedOtherUser.username}`)
            : (conversation.group_name ?? 'Group')
        }…`}
      />

      <ImagePreview
        uploadStatus={uploadStatus}
        onConfirm={confirmImageSend}
        onCancel={cancelUpload}
      />
    </div>
  );
}
