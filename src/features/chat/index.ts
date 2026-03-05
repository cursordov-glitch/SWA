// ============================================================
// src/features/chat/index.ts
// ============================================================

// Components
export { ConversationList }     from './components/ConversationList';
export { ConversationItem }     from './components/ConversationItem';
export { NewConversationModal } from './components/NewConversationModal';
export { ChatWindow }           from './components/ChatWindow';
export { ChatHeader }           from './components/ChatHeader';
export { MessageList }          from './components/MessageList';
export { MessageBubble }        from './components/MessageBubble';
export { MessageInput }         from './components/MessageInput';
export { TypingIndicator }      from './components/TypingIndicator';
export { UploadButton }         from './components/UploadButton';         // Step 7
export { ImagePreview }         from './components/ImagePreview';         // Step 7
export { ImageMessageBubble }   from './components/ImageMessageBubble';   // Step 7
export { SeenIndicator }        from './components/SeenIndicator';        // Step 8
export { UnreadBadge }          from './components/UnreadBadge';          // Step 8

// Hooks
export { useConversations }      from './hooks/useConversations';
export { useCreateConversation } from './hooks/useCreateConversation';
export { useMessages }           from './hooks/useMessages';
export { useRealtimeMessages }   from './hooks/useRealtimeMessages';
export { useTypingIndicator }    from './hooks/useTypingIndicator';
export { usePresence }           from './hooks/usePresence';
export { useRealtimeSidebar }    from './hooks/useRealtimeSidebar';
export { useImageUpload }        from './hooks/useImageUpload';            // Step 7
export { useMessageStatus }      from './hooks/useMessageStatus';          // Step 8
export { useUnreadCount }        from './hooks/useUnreadCount';            // Step 8

// Utils
export * from './utils';

// Types
export type {
  ConversationListItem,
  SidebarState,
  NewConversationState,
  TypingUser,
  PresenceUser,
  TypingState,
  PresenceState,
} from './types';

export type { UploadStatus }          from './hooks/useImageUpload';   // Step 7
export type { OptimisticMessage }     from './hooks/useMessages';      // Step 7
export type { MessageDeliveryStatus, StatusMap } from './hooks/useMessageStatus'; // Step 8
