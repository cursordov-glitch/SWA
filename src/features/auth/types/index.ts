// ============================================================
// src/features/auth/types/index.ts
// ============================================================

export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
  username: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthError = {
  message: string;
  field?: 'email' | 'password' | 'username' | 'full_name' | 'general';
};

export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AuthError };
