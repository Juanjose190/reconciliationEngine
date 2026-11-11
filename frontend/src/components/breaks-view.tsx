'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface BreakItem {
  id: string;
  state: string;
  breakType: string;
  txHash: string | null;
  asset: string | null;
  ledgerAmount: string | null;
  externalAmount: string | null;
  difference: string | null;
  probableCause: string | null;
  resolutionStatus: string;
  resolutionAction: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
}

type ResolutionAction = 'ACCEPT_LEDGER' | 'ACCEPT_EXTERNAL' | 'ADJUST' | 'IGNORE';

const ACTIONS: { value: ResolutionAction; label: string }[] = [
  { value: 'ACCEPT_LEDGER', label: 'Aceptar Ledger' },
  { value: 'ACCEPT_EXTERNAL', label: 'Aceptar Externa' },
  { value: 'ADJUST', label: 'Ajustar' },
  { value: 'IGNORE', label: 'Ignorar' },
];

export function BreaksView() {
  const { token, role } = useAuth();
  const [breaks, setBreaks] = useState<BreakItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [action, setAction] = useState<ResolutionAction>('ACCEPT_LEDGER');
  const [note, setNote] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const canResolve = role === 'ADMIN' || role === 'OPERATOR';

  const loadBreaks = useCallback(async () => {
    try {
      const openData = await api<{ data: BreakItem[] }>('/reconciliation/breaks?limit=200', { token: token! });

      // Also load resolved breaks from the latest run
      const runs = await api<Array<{ id: string }>>('/reconciliation/runs', { token: token! });
      let resolvedItems: BreakItem[] = [];
      if (runs.length > 0) {
        const allItems = await api<{ data: BreakItem[] }>(
          `/reconciliation/runs/${runs[0].id}/items?state=BREAK&limit=200`,
          { token: token! },
        );
        resolvedItems = allItems.data.filter(b => b.resolutionStatus === 'RESOLVED');
      }

      setBreaks([...openData.data, ...resolvedItems]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando breaks');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBreaks(); }, [loadBreaks]);

  async function resolveBreak(id: string) {
    setError('');
    try {
      await api(`/reconciliation/items/${id}/resolve`, {
        method: 'PATCH',
        token: token!,
        body: { action, note },
      });
      setResolving(null);
      setNote('');
      await loadBreaks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error resolviendo break');
    }
  }

  async function reopenBreak(id: string) {
    setError('');
    try {
      await api(`/reconciliation/items/${id}/reopen`, {
        method: 'PATCH',
        token: token!,
      });
      await loadBreaks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error reabriendo break');
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Cargando breaks...</p>;

  const openBreaks = breaks.filter(b => b.resolutionStatus === 'OPEN');
  const resolvedBreaks = breaks.filter(b => b.resolutionStatus === 'RESOLVED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Breaks <span className="text-base font-normal text-[var(--muted)]">({openBreaks.length} abiertos)</span>
        </h2>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-sm text-[var(--primary)] hover:underline"
        >
          {showResolved ? 'Ocultar resueltos' : `Ver resueltos (${resolvedBreaks.length})`}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {openBreaks.length === 0 && !showResolved ? (
        <p className="text-[var(--muted)]">No hay breaks abiertos.</p>
      ) : (
        <div className="space-y-3">
          {openBreaks.map(item => (
            <div key={item.id} className="bg-white border border-[var(--card-border)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                      {item.breakType}
                    </span>
                    <span className="text-xs text-[var(--muted)] font-mono">{item.id.slice(0, 8)}</span>
                  </div>
                  {item.txHash && (
                    <p className="text-xs font-mono text-[var(--muted)] mb-1">tx: {item.txHash.slice(0, 20)}...</p>
                  )}
                  <div className="flex gap-6 text-sm">
                    {item.asset && <span>Asset: <strong>{item.asset}</strong></span>}
                    {item.ledgerAmount && <span>Ledger: <strong className="font-mono">{item.ledgerAmount}</strong></span>}
                    {item.externalAmount && <span>Externa: <strong className="font-mono">{item.externalAmount}</strong></span>}
                    {item.difference && <span>Dif: <strong className="font-mono text-[var(--danger)]">{item.difference}</strong></span>}
                  </div>
                  {item.probableCause && (
                    <p className="text-xs text-[var(--muted)] mt-1">{item.probableCause}</p>
                  )}
                </div>

                {canResolve && resolving !== item.id && (
                  <button
                    onClick={() => setResolving(item.id)}
                    className="px-3 py-1.5 text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg shrink-0 transition-colors"
                  >
                    Resolver
                  </button>
                )}
              </div>

              {resolving === item.id && (
                <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-3">
                  <div className="flex gap-2">
                    {ACTIONS.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setAction(a.value)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          action === a.value
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'border-[var(--card-border)] hover:bg-slate-50'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Nota de resolución..."
                    rows={2}
                    className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveBreak(item.id)}
                      className="px-4 py-2 bg-[var(--success)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-opacity"
                    >
                      Confirmar resolución
                    </button>
                    <button
                      onClick={() => { setResolving(null); setNote(''); }}
                      className="px-4 py-2 text-sm text-[var(--muted)] hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showResolved && resolvedBreaks.length > 0 && (
            <>
              <h3 className="font-semibold text-[var(--muted)] mt-6">Resueltos</h3>
              {resolvedBreaks.map(item => (
                <div key={item.id} className="bg-white border border-[var(--card-border)] rounded-xl p-4 opacity-75">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                          RESUELTO
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                          {item.breakType}
                        </span>
                        <span className="text-xs text-[var(--muted)] font-mono">{item.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-[var(--muted)]">
                        {item.resolutionAction && <span>Acción: <strong>{item.resolutionAction}</strong></span>}
                        {item.resolutionNote && <span>Nota: {item.resolutionNote}</span>}
                      </div>
                    </div>
                    {canResolve && (
                      <button
                        onClick={() => reopenBreak(item.id)}
                        className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-lg hover:bg-slate-50 shrink-0 transition-colors"
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
