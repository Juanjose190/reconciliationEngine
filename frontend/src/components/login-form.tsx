'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth';

export function LoginForm() {
  const { login } = useAuth();
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(tenant, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-garamond italic text-[36px] text-fg leading-tight">
            Reconciliation Engine
          </h1>
          <p className="text-rule-dark text-[13px] mt-2 tracking-wide">
            Motor de reconciliación financiera
          </p>
        </div>

        {error && (
          <div className="bg-botanical-scarlet-light border border-botanical-scarlet/20 text-botanical-scarlet px-4 py-3 text-[13px] mb-6">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-rule-dark mb-2">
              Tenant
            </label>
            <input
              type="text"
              value={tenant}
              onChange={e => setTenant(e.target.value)}
              placeholder="slug del tenant"
              required
              className="w-full px-4 py-2.5 border border-rule bg-bg text-fg text-[14px] placeholder:text-rule transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-rule-dark mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@empresa.com"
              required
              className="w-full px-4 py-2.5 border border-rule bg-bg text-fg text-[14px] placeholder:text-rule transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-rule-dark mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-rule bg-bg text-fg text-[14px] placeholder:text-rule transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-8 py-3 bg-botanical-green text-rail-fg text-[14px] font-medium disabled:opacity-50 transition-colors hover:opacity-90"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
