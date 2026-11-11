'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';

interface Run {
  id: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  matched: number;
  breaks: number;
  pending: number;
  totalLedger: number;
  totalExternal: number;
}

interface RunItem {
  id: string;
  state: string;
  breakType: string | null;
  txHash: string | null;
  asset: string | null;
  ledgerAmount: string | null;
  externalAmount: string | null;
  difference: string | null;
  probableCause: string | null;
  resolutionStatus: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export function RunsView() {
  const { token, role } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const canRun = role === 'ADMIN' || role === 'OPERATOR';

  const loadRuns = useCallback(async () => {
    try {
      const data = await api<Run[]>('/reconciliation/runs', { token: token! });
      setRuns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando corridas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  async function startRun() {
    setStarting(true);
    setError('');
    const now = new Date();
    const from = new Date(now.getTime() - 31 * 86400_000);
    const to = new Date(now.getTime() + 86400_000);
    try {
      await api('/reconciliation/runs', {
        method: 'POST',
        token: token!,
        body: { periodFrom: from.toISOString(), periodTo: to.toISOString() },
      });
      await loadRuns();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Ya hay una corrida en ejecución');
      } else {
        setError(e instanceof Error ? e.message : 'Error iniciando corrida');
      }
    } finally {
      setStarting(false);
    }
  }

  async function loadItems(runId: string) {
    setSelectedRun(runId);
    try {
      const data = await api<{ data: RunItem[] }>(`/reconciliation/runs/${runId}/items?limit=200`, { token: token! });
      setItems(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando items');
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Cargando corridas...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Corridas de reconciliación</h2>
        {canRun && (
          <button
            onClick={startRun}
            disabled={starting}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {starting ? 'Iniciando...' : 'Nueva corrida'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {runs.length === 0 ? (
        <p className="text-[var(--muted)]">No hay corridas registradas. Inicia una nueva corrida.</p>
      ) : (
        <div className="bg-white border border-[var(--card-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-[var(--card-border)]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Inicio</th>
                <th className="text-right px-4 py-3 font-medium">Ledger</th>
                <th className="text-right px-4 py-3 font-medium">Externas</th>
                <th className="text-right px-4 py-3 font-medium">Matched</th>
                <th className="text-right px-4 py-3 font-medium">Breaks</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b border-[var(--card-border)] last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{run.id.slice(0, 8)}</td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3 text-[var(--muted)]">{new Date(run.startedAt).toLocaleString('es')}</td>
                  <td className="px-4 py-3 text-right">{run.totalLedger}</td>
                  <td className="px-4 py-3 text-right">{run.totalExternal}</td>
                  <td className="px-4 py-3 text-right text-[var(--success)]">{run.matched}</td>
                  <td className="px-4 py-3 text-right text-[var(--warning)]">{run.breaks}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => loadItems(run.id)}
                      className="text-[var(--primary)] hover:underline text-xs"
                    >
                      Ver items
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRun && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Items de la corrida {selectedRun.slice(0, 8)}</h3>
            <button onClick={() => { setSelectedRun(null); setItems([]); }} className="text-sm text-[var(--muted)] hover:underline">
              Cerrar
            </button>
          </div>
          <div className="bg-white border border-[var(--card-border)] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-[var(--card-border)]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">txHash</th>
                  <th className="text-left px-4 py-3 font-medium">Asset</th>
                  <th className="text-right px-4 py-3 font-medium">Ledger</th>
                  <th className="text-right px-4 py-3 font-medium">Externa</th>
                  <th className="text-right px-4 py-3 font-medium">Diferencia</th>
                  <th className="text-left px-4 py-3 font-medium">Causa</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-[var(--card-border)] last:border-0">
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.state === 'MATCHED' ? 'bg-green-100 text-green-800' :
                        item.state === 'BREAK' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{item.state}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{item.breakType || '-'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{item.txHash ? item.txHash.slice(0, 12) + '...' : '-'}</td>
                    <td className="px-4 py-2">{item.asset || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.ledgerAmount || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.externalAmount || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.difference || '-'}</td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">{item.probableCause || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
