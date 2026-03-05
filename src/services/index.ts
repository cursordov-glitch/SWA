// ============================================================
// src/services/index.ts
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

export { BaseService } from './base.service';
export { ConversationService } from './conversation.service';
export { MessageService } from './message.service';
export { UserService } from './user.service';

// ─── Factory Functions ────────────────────────────────────────────────────────

export function createUserService(client: SupabaseClient): UserService {
  return new UserService(client);
}

export function createConversationService(client: SupabaseClient): ConversationService {
  return new ConversationService(client);
}

export function createMessageService(client: SupabaseClient): MessageService {
  return new MessageService(client);
}

/**
 * Convenience: create all services at once.
 * Used in Server Components that need multiple services.
 */
export function createServices(client: SupabaseClient) {
  return {
    users: createUserService(client),
    conversations: createConversationService(client),
    messages: createMessageService(client),
  };
}
