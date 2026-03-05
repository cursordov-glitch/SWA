// ============================================================
// src/app/(auth)/login/page.tsx
// ============================================================
// Server Component. Session check happens in middleware —
// authenticated users are already redirected before reaching here.
// ============================================================

import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your ChatApp account',
};

export default function LoginPage() {
  return <LoginForm />;
}
