'use client';

import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
import { Dashboard } from '@/components/dashboard';

export default function Home() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Dashboard /> : <LoginForm />;
}
