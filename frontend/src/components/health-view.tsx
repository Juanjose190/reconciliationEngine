'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

interface HealthStatus {
  status: string;
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
}

export function HealthView() {
  const { token } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const res = await fetch(`${apiBase}/health`);
      const data = await res.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar al backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  const allChecks = health ? { ...health.info, ...health.details, ...health.error } : {};

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h2 className="font-garamond italic text-[34px] text-fg leading-tight">
            Salud del Sistema
          </h2>
          {lastCheck && (
            <p className="text-[12px] text-rule-dark tracking-[0.06em] uppercase font-medium mt-1">
              Verificado {lastCheck.toLocaleTimeString('es')}
            </p>
          )}
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="px-5 py-2 bg-botanical-green text-rail-fg text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </button>
      </div>

      {error && (
        <div className="bg-botanical-scarlet-light border border-botanical-scarlet/20 text-botanical-scarlet px-4 py-3 text-[13px] mb-6">
          {error}
        </div>
      )}

      {health && (
        <>
          <div className="mb-10 flex items-center gap-4 pb-6 border-b border-rule">
            <span className={`w-[14px] h-[14px] ${
              health.status === 'ok' ? 'bg-botanical-green' : 'bg-botanical-scarlet'
            }`} />
            <span className="text-[20px] font-semibold">
              {health.status === 'ok' ? 'Sistema operativo' : 'Sistema con errores'}
            </span>
          </div>

          {Object.keys(allChecks).length > 0 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-fg">
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">
                    Componente
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">
                    Estado
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allChecks).map(([name, check]) => (
                  <tr key={name} className="border-b border-rule">
                    <td className="py-3.5 pr-3 text-[14px] font-medium">{name}</td>
                    <td className="py-3.5 pr-3">
                      <span className={`inline-flex items-center gap-2 px-2.5 py-[2px] text-[12px] font-medium ${
                        check?.status === 'up'
                          ? 'bg-botanical-green-light text-botanical-green'
                          : 'bg-botanical-scarlet-light text-botanical-scarlet'
                      }`}>
                        <span className={`w-[6px] h-[6px] ${
                          check?.status === 'up' ? 'bg-botanical-green' : 'bg-botanical-scarlet'
                        }`} />
                        {check?.status === 'up' ? 'Activo' : 'Error'}
                      </span>
                    </td>
                    <td className="py-3.5 text-[13px] text-rule-dark">
                      {check?.message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {Object.keys(allChecks).length === 0 && (
            <p className="text-rule-dark text-[14px]">
              El endpoint reporta estado general sin componentes individuales.
            </p>
          )}
        </>
      )}
    </div>
  );
}
