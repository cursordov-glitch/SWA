// ============================================================
// src/services/base.service.ts
// ============================================================
// All services extend this class.
// Provides a consistent error-handling wrapper so service
// methods never throw — they always return ServiceResponse<T>.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ServiceError, ServiceResponse } from '@/types';

export abstract class BaseService {
  protected client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Wraps any async operation in a try/catch and normalises
   * the result into ServiceResponse<T>.
   *
   * Usage:
   *   return this.execute(() => supabase.from('users').select('*'))
   */
  protected async execute<T>(
    fn: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>
  ): Promise<ServiceResponse<T>> {
    try {
      const { data, error } = await fn();

      if (error) {
        return {
          data: null,
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      return {
        data: null,
        error: { message },
      };
    }
  }

  /**
   * Same as execute() but for operations that don't return data
   * (e.g. UPDATE, DELETE with no .select()).
   */
  protected async executeVoid(
    fn: () => Promise<{ error: { message: string; code?: string } | null }>
  ): Promise<ServiceError | null> {
    try {
      const { error } = await fn();
      if (error) return { message: error.message, code: error.code };
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { message };
    }
  }
}
