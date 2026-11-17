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

function PhaseStrip({ matched, breaks, pending }: { matched: number; breaks: number; pending: number }) {
  const total = matched + breaks + pending;
  if (total === 0) return <div className="w-[120px] h-[6px] bg-rule/30" />;
  return (
    <div className="flex gap-[2px] h-[6px] w-[120px]">
      {matched > 0 && <span className="bg-botanical-green rounded-[1px]" style={{ flex: matched }} />}
      {breaks > 0 && <span className="bg-botanical-scarlet rounded-[1px]" style={{ flex: breaks }} />}
      {pending > 0 && <span className="bg-botanical-amber rounded-[1px]" style={{ flex: pending }} />}
    </div>
  );
}

function BreakClassification({ items }: { items: RunItem[] }) {
  const breakItems = items.filter(i => i.state === 'BREAK' && i.breakType);
  if (breakItems.length === 0) return <span className="text-rule-dark text-[12px]">—</span>;

  const counts: Record<string, number> = {};
  for (const item of breakItems) {
    if (item.breakType) counts[item.breakType] = (counts[item.breakType] || 0) + 1;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(counts).slice(0, 2).map(([type, count]) => (
        <span
          key={type}
          className="font-garamond italic text-[12px] text-botanical-scarlet bg-botanical-scarlet-light px-2 py-[1px]"
        >
          {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ×{count}
        </span>
      ))}
    </div>
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
      const res = await api<{ data: Run[] }>('/reconciliation/runs?limit=200', { token: token! });
      setRuns(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando ejecuciones');
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
        setError('Ya hay una ejecución en curso');
      } else {
        setError(e instanceof Error ? e.message : 'Error iniciando ejecución');
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

  if (loading) return <p className="text-rule-dark">Cargando ejecuciones...</p>;

  const totalMatched = runs.reduce((s, r) => s + r.matched, 0);
  const totalBreaks = runs.reduce((s, r) => s + r.breaks, 0);
  const totalItems = runs.reduce((s, r) => s + r.totalLedger, 0);
  const matchRate = totalItems > 0 ? ((totalMatched / totalItems) * 100).toFixed(1) : '0';
  const runningCount = runs.filter(r => r.status === 'RUNNING').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mb-8">
        <div>
          <h2 className="font-garamond italic text-[28px] sm:text-[34px] text-fg leading-tight">
            Ejecuciones de Reconciliación
          </h2>
          <p className="text-[12px] text-rule-dark tracking-[0.06em] uppercase font-medium mt-1">
            Últimos 30 Días
          </p>
        </div>
        {canRun && (
          <button
            onClick={startRun}
            disabled={starting}
            className="px-6 py-2.5 bg-botanical-green text-rail-fg text-[14px] font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {starting ? 'Iniciando...' : 'Nueva Ejecución'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-botanical-scarlet-light border border-botanical-scarlet/20 text-botanical-scarlet px-4 py-3 text-[13px] mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex gap-6 sm:gap-12 pb-6 mb-8 border-b border-rule">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-1">Total Ejecuciones</div>
          <div className="text-[28px] font-semibold tabular-nums">{runs.length}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-1">Tasa de Match</div>
          <div className="text-[28px] font-semibold tabular-nums text-botanical-green">{matchRate}%</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-1">Breaks Abiertos</div>
          <div className="text-[28px] font-semibold tabular-nums text-botanical-scarlet">{totalBreaks}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-1">En Ejecución</div>
          <div className="text-[28px] font-semibold tabular-nums text-botanical-amber">{runningCount}</div>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="text-rule-dark">No hay ejecuciones registradas. Inicia una nueva ejecución.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-fg">
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Ejecución</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Fecha</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Items</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Fase</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Matched</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Breaks</th>
              <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Estado</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} className="border-b border-rule hover:bg-[var(--hover)] transition-colors">
                <td className="py-3.5 pr-3 text-[14px] font-semibold tabular-nums">
                  {run.id.slice(0, 8)}
                </td>
                <td className="py-3.5 pr-3 text-[14px] tabular-nums text-fg">
                  {new Date(run.startedAt).toLocaleDateString('es', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="py-3.5 pr-3 text-[14px] tabular-nums">{run.totalLedger}</td>
                <td className="py-3.5 pr-3">
                  <PhaseStrip matched={run.matched} breaks={run.breaks} pending={run.pending} />
                </td>
                <td className="py-3.5 pr-3 text-[14px] tabular-nums text-botanical-green font-medium">
                  {run.matched}
                </td>
                <td className="py-3.5 pr-3 text-[14px] tabular-nums text-botanical-scarlet font-semibold">
                  {run.breaks}
                </td>
                <td className="py-3.5 pr-3">
                  <span className={`inline-block px-2.5 py-[2px] text-[12px] font-medium ${
                    run.status === 'COMPLETED'
                      ? 'bg-botanical-green-light text-botanical-green'
                      : run.status === 'RUNNING'
                        ? 'bg-botanical-amber-light text-botanical-amber'
                        : 'bg-botanical-scarlet-light text-botanical-scarlet'
                  }`}>
                    {run.status === 'COMPLETED' ? 'Completa' : run.status === 'RUNNING' ? 'Ejecutando' : run.status}
                  </span>
                </td>
                <td className="py-3.5 text-right">
                  <button
                    onClick={() => loadItems(run.id)}
                    className="text-[13px] text-botanical-green hover:underline font-medium"
                  >
                    Ver items
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedRun && items.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-garamond italic text-[22px]">
              Items — {selectedRun.slice(0, 8)}
            </h3>
            <button
              onClick={() => { setSelectedRun(null); setItems([]); }}
              className="text-[13px] text-rule-dark hover:text-fg transition-colors"
            >
              Cerrar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-fg">
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Estado</th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Clasificación</th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">txHash</th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Asset</th>
                  <th className="text-right text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Ledger</th>
                  <th className="text-right text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Externa</th>
                  <th className="text-right text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3 pr-3">Diferencia</th>
                  <th className="text-left text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark pb-3">Causa</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-rule">
                    <td className="py-3 pr-3">
                      <span className={`inline-block px-2 py-[1px] text-[12px] font-medium ${
                        item.state === 'MATCHED'
                          ? 'bg-botanical-green-light text-botanical-green'
                          : item.state === 'BREAK'
                            ? 'bg-botanical-scarlet-light text-botanical-scarlet'
                            : 'bg-botanical-amber-light text-botanical-amber'
                      }`}>{item.state}</span>
                    </td>
                    <td className="py-3 pr-3">
                      {item.breakType ? (
                        <span className="font-garamond italic text-[13px] text-botanical-scarlet">
                          {item.breakType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ) : (
                        <span className="text-rule-dark text-[12px]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[12px] text-rule-dark">
                      {item.txHash ? item.txHash.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className="py-3 pr-3 text-[13px]">{item.asset || '—'}</td>
                    <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums">{item.ledgerAmount || '—'}</td>
                    <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums">{item.externalAmount || '—'}</td>
                    <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums text-botanical-scarlet">
                      {item.difference || '—'}
                    </td>
                    <td className="py-3 text-[12px] text-rule-dark">{item.probableCause || '—'}</td>
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
