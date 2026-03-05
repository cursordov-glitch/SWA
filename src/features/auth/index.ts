// ============================================================
// src/features/auth/index.ts
// ============================================================
// Public API of the auth feature module.
// Import from here, not from internal paths.
// ============================================================

export { AuthService } from './services/auth.service';
export { useAuth } from './hooks/useAuth';
export { useUsernameCheck } from './hooks/useUsernameCheck';
export { LoginForm } from './components/LoginForm';
export { RegisterForm } from './components/RegisterForm';
export type { AuthError, AuthResult, LoginInput, RegisterInput } from './types';
