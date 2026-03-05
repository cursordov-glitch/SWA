// ============================================================
// src/services/user.service.ts
// ============================================================
// Handles all user profile and presence operations.
// Used by: auth feature, profile feature, chat sidebar.
//
// Step 9 additions:
//   - uploadAvatar() now uses the dedicated 'user-avatars' bucket
//     with a fixed path per user (upsert replaces old avatar)
//   - updateLastSeen() convenience method
//   - getUserProfile() alias for getCurrentUser() (named per spec)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DbUser,
  PaginatedResponse,
  PaginationParams,
  ServiceError,
  ServiceResponse,
  UpdatePresenceInput,
  UpdateProfileInput,
} from '@/types';

import { BaseService } from './base.service';

const AVATAR_BUCKET = 'user-avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export class UserService extends BaseService {
  constructor(client: SupabaseClient) {
    super(client);
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  /**
   * Get the currently authenticated user's profile.
   * Alias: getUserProfile() (matches Step 9 spec naming).
   */
  async getCurrentUser(): Promise<ServiceResponse<DbUser>> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    return this.execute<DbUser>(() =>
      this.client.from('users').select('*').eq('id', user.id).single()
    );
  }

  /** Alias for getCurrentUser — named per Step 9 spec */
  async getUserProfile(): Promise<ServiceResponse<DbUser>> {
    return this.getCurrentUser();
  }

  /**
   * Get a user profile by ID.
   */
  async getUserById(id: string): Promise<ServiceResponse<DbUser>> {
    return this.execute<DbUser>(() =>
      this.client
        .from('users')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
    );
  }

  /**
   * Get a user profile by username.
   */
  async getUserByUsername(username: string): Promise<ServiceResponse<DbUser>> {
    return this.execute<DbUser>(() =>
      this.client
        .from('users')
        .select('*')
        .eq('username', username)
        .is('deleted_at', null)
        .single()
    );
  }

  /**
   * Get multiple user profiles by IDs (e.g. for conversation participant avatars).
   */
  async getUsersByIds(ids: string[]): Promise<ServiceResponse<DbUser[]>> {
    if (ids.length === 0) return { data: [], error: null };

    return this.execute<DbUser[]>(() =>
      this.client
        .from('users')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null)
    );
  }

  /**
   * Search users by username or full_name.
   * Uses PostgreSQL trigram index for fast fuzzy matching.
   * Excludes the current user from results.
   */
  async searchUsers(
    query: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<DbUser>> {
    const { limit = 20, cursor } = params;
    const trimmed = query.trim();

    if (!trimmed) return { data: [], count: 0, hasMore: false, nextCursor: null };

    const { data: { user: currentUser } } = await this.client.auth.getUser();

    let queryBuilder = this.client
      .from('users')
      .select('*', { count: 'exact' })
      .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
      .is('deleted_at', null)
      .order('username', { ascending: true })
      .limit(limit + 1);

    if (currentUser) queryBuilder = queryBuilder.neq('id', currentUser.id);
    if (cursor) queryBuilder = queryBuilder.gt('username', cursor);

    const { data, count, error } = await queryBuilder;

    if (error || !data) return { data: [], count: 0, hasMore: false, nextCursor: null };

    const hasMore = data.length > limit;
    const results = hasMore ? data.slice(0, limit) : data;

    return {
      data: results,
      count: count ?? 0,
      hasMore,
      nextCursor: hasMore ? results[results.length - 1].username : null,
    };
  }

  // ─── Write ──────────────────────────────────────────────────────────────────

  /**
   * Update the current user's profile.
   * Alias: updateUserProfile() (matches Step 9 spec naming).
   * Checks username uniqueness before writing if username is changing.
   */
  async updateProfile(input: UpdateProfileInput): Promise<ServiceResponse<DbUser>> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    if (input.username) {
      const { data: existing } = await this.client
        .from('users')
        .select('id')
        .eq('username', input.username)
        .neq('id', user.id)
        .single();

      if (existing) {
        return {
          data: null,
          error: { message: 'Username is already taken', code: 'USERNAME_TAKEN' },
        };
      }
    }

    return this.execute<DbUser>(() =>
      this.client
        .from('users')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()
    );
  }

  /** Alias for updateProfile — named per Step 9 spec */
  async updateUserProfile(input: UpdateProfileInput): Promise<ServiceResponse<DbUser>> {
    return this.updateProfile(input);
  }

  /**
   * Update online presence for the current user.
   * Called on tab focus/blur and auth state changes.
   */
  async updatePresence(input: UpdatePresenceInput): Promise<ServiceError | null> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('users')
        .update({
          is_online: input.is_online,
          last_seen_at: input.last_seen_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    );
  }

  /**
   * Update last_seen_at timestamp for the current user.
   * Call this periodically (e.g. every 60s) while the user is active,
   * and on page visibility change.
   * Named per Step 9 spec.
   */
  async updateLastSeen(): Promise<ServiceError | null> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { message: 'Not authenticated' };

    return this.executeVoid(() =>
      this.client
        .from('users')
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    );
  }

  /**
   * Soft-delete the current user's account.
   */
  async deleteAccount(): Promise<ServiceError | null> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { message: 'Not authenticated' };

    const error = await this.executeVoid(() =>
      this.client
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', user.id)
    );

    if (!error) await this.client.auth.signOut();
    return error;
  }

  // ─── Avatar Upload ───────────────────────────────────────────────────────────

  /**
   * Upload a new avatar to the 'user-avatars' Supabase Storage bucket,
   * then update users.avatar_url with the CDN public URL.
   *
   * Step 9 spec: uploadAvatar(userId, file)
   *
   * Storage path: {userId}/avatar.{ext}
   * Fixed filename means the file is REPLACED (upsert: true),
   * so storage stays bounded at 1 file per user with no orphan cleanup.
   *
   * For API-route uploads use /api/profile/avatar (server-side, with
   * magic-byte validation). This method is for client-side direct upload
   * when magic-byte check is not required (e.g. trusted service calls).
   *
   * @param userId - The user's UUID (must match auth.uid() for RLS)
   * @param file   - The File object to upload
   */
  async uploadAvatar(userId: string, file: File): Promise<ServiceResponse<string>> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };
    if (user.id !== userId) return { data: null, error: { message: 'Unauthorized' } };

    // Client-side validation (matches API route constraints)
    if (!AVATAR_ALLOWED_MIME.has(file.type.toLowerCase())) {
      return { data: null, error: { message: 'Unsupported file type. Use JPEG, PNG, or WebP.' } };
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return { data: null, error: { message: 'Image too large. Maximum 2MB.' } };
    }

    const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
    const storagePath = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.client.storage
      .from(AVATAR_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,       // replace the existing avatar
        cacheControl: '3600',
      });

    if (uploadError) {
      return { data: null, error: { message: uploadError.message } };
    }

    const { data: { publicUrl } } = this.client.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(storagePath);

    // Cache-bust so the browser sees the new image immediately
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    await this.updateProfile({ avatar_url: avatarUrl });

    return { data: avatarUrl, error: null };
  }
}
