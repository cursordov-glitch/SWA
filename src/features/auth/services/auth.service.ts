// ============================================================
// src/features/auth/services/auth.service.ts
// ============================================================
// Handles all Supabase Auth operations.
// Profile row creation is handled by the DB trigger
// (handle_new_auth_user) from migration 002.
// This service sits ABOVE user.service — it owns the auth
// lifecycle; user.service owns profile data.
// ============================================================

import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { AuthResult, LoginInput, RegisterInput } from '../types';

export class AuthService {
  constructor(private client: SupabaseClient) {}

  // ─── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a new user with email + password.
   *
   * Flow:
   * 1. Validate username uniqueness (before hitting auth)
   * 2. Create auth.users record via Supabase Auth
   * 3. DB trigger (handle_new_auth_user) auto-creates the public.users row
   * 4. We immediately update it with the chosen username + full_name
   *    because the trigger only uses the email prefix as default.
   */
  async register(input: RegisterInput): Promise<AuthResult<User>> {
    const { email, password, username, full_name } = input;

    // 1. Check username availability before creating the auth user
    const { data: existingUser } = await this.client
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: { message: 'This username is already taken.', field: 'username' },
      };
    }

    // 2. Create the Supabase Auth user
    // Pass metadata so the trigger can use it immediately
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          username: username.toLowerCase(),
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: { message: this.map(error.message), field: 'general' },
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: { message: 'Registration failed. Please try again.', field: 'general' },
      };
    }

    // 3. Update the auto-created profile row with the user's chosen details
    // The trigger creates a row with a generated username; we correct it here.
    await this.client
      .from('users')
      .update({
        username: username.toLowerCase(),
        full_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.user.id);

    return { success: true, data: data.user };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  /**
   * Sign in with email + password.
   * Supabase sets an httpOnly cookie via @supabase/ssr automatically.
   */
  async login(input: LoginInput): Promise<AuthResult<User>> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      return {
        success: false,
        error: { message: this.map(error.message), field: 'general' },
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: { message: 'Login failed. Please try again.', field: 'general' },
      };
    }

    return { success: true, data: data.user };
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────────

  /**
   * Initiate Google OAuth flow.
   * Supabase redirects to Google, then back to /auth/callback.
   * The callback route exchanges the code for a session.
   */
  async loginWithGoogle(): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: { message: error.message, field: 'general' },
      };
    }

    return { success: true, data: undefined };
  }

  // ─── Sign Out ────────────────────────────────────────────────────────────────

  /**
   * Sign out and clear the session cookie.
   * Also marks the user as offline in the DB.
   */
  async signOut(): Promise<void> {
    // Mark offline before ending session
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (user) {
      await this.client
        .from('users')
        .update({
          is_online: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    await this.client.auth.signOut();
  }

  // ─── Session ─────────────────────────────────────────────────────────────────

  /**
   * Get the current authenticated user from the active session.
   * Uses getUser() (not getSession()) — getUser() validates the JWT
   * with the Supabase server, making it safe for auth checks.
   */
  async getAuthUser(): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    if (error || !user) return null;
    return user;
  }

  /**
   * Check if a username is available.
   * Called in real-time as the user types on the register form.
   */
  async checkUsernameAvailable(username: string): Promise<boolean> {
    if (username.length < 3) return false;

    const { data } = await this.client
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    return !data;
  }

  // ─── Password Reset ───────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      return { success: false, error: { message: error.message, field: 'general' } };
    }

    return { success: true, data: undefined };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private map(message: string): string {
    const map: Record<string, string> = {
      'Invalid login credentials': 'Incorrect email or password.',
      'Email not confirmed': 'Please verify your email before logging in.',
      'User already registered': 'An account with this email already exists.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters.',
      'signup_disabled': 'New registrations are currently disabled.',
    };

    for (const [key, value] of Object.entries(map)) {
      if (message.includes(key)) return value;
    }

    return message;
  }
}
