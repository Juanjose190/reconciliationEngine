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

function formatBreakType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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
      const runsRes = await api<{ data: Array<{ id: string }> }>('/reconciliation/runs?limit=1', { token: token! });
      let resolvedItems: BreakItem[] = [];
      if (runsRes.data.length > 0) {
        const allItems = await api<{ data: BreakItem[] }>(
          `/reconciliation/runs/${runsRes.data[0].id}/items?state=BREAK&limit=200`,
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

  if (loading) return <p className="text-rule-dark">Cargando breaks...</p>;

  const openBreaks = breaks.filter(b => b.resolutionStatus === 'OPEN');
  const resolvedBreaks = breaks.filter(b => b.resolutionStatus === 'RESOLVED');

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h2 className="font-garamond italic text-[34px] text-fg leading-tight">
            Clasificación de Breaks
          </h2>
          <p className="text-[12px] text-rule-dark tracking-[0.06em] uppercase font-medium mt-1">
            {openBreaks.length} abiertos · {resolvedBreaks.length} resueltos
          </p>
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-[13px] text-botanical-green hover:underline font-medium"
        >
          {showResolved ? 'Ocultar resueltos' : 'Ver resueltos'}
        </button>
      </div>

      {error && (
        <div className="bg-botanical-scarlet-light border border-botanical-scarlet/20 text-botanical-scarlet px-4 py-3 text-[13px] mb-6">
          {error}
        </div>
      )}

      {openBreaks.length === 0 && !showResolved ? (
        <p className="text-rule-dark">No hay breaks abiertos.</p>
      ) : (
        <div className="space-y-4">
          {openBreaks.map(item => (
            <div key={item.id} className="border border-rule p-5 bg-bg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-garamond italic text-[16px] text-botanical-scarlet">
                      {formatBreakType(item.breakType)}
                    </span>
                    <span className="text-[11px] text-rule-dark font-mono">{item.id.slice(0, 8)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border border-rule">
                    <div className="p-4 border-r border-rule">
                      <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">
                        Ledger
                      </div>
                      {item.ledgerAmount ? (
                        <div className="font-mono text-[16px] tabular-nums font-semibold">{item.ledgerAmount}</div>
                      ) : (
                        <div className="text-rule-dark text-[14px]">Sin registro</div>
                      )}
                      {item.asset && <div className="text-[12px] text-rule-dark mt-1">{item.asset}</div>}
                    </div>
                    <div className="p-4">
                      <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">
                        Externa
                      </div>
                      {item.externalAmount ? (
                        <div className="font-mono text-[16px] tabular-nums font-semibold">{item.externalAmount}</div>
                      ) : (
                        <div className="text-rule-dark text-[14px]">Sin registro</div>
                      )}
                      {item.txHash && (
                        <div className="text-[11px] text-rule-dark mt-1 font-mono">
                          tx: {item.txHash.slice(0, 16)}…
                        </div>
                      )}
                    </div>
                  </div>

                  {item.difference && (
                    <div className="mt-3 text-[13px]">
                      <span className="text-rule-dark">Diferencia: </span>
                      <span className="font-mono font-semibold text-botanical-scarlet">{item.difference}</span>
                    </div>
                  )}
                  {item.probableCause && (
                    <div className="mt-1 text-[12px] text-rule-dark">{item.probableCause}</div>
                  )}
                </div>

                {canResolve && resolving !== item.id && (
                  <button
                    onClick={() => setResolving(item.id)}
                    className="px-4 py-2 bg-botanical-green text-rail-fg text-[13px] font-medium shrink-0 hover:opacity-90 transition-opacity"
                  >
                    Resolver
                  </button>
                )}
              </div>

              {resolving === item.id && (
                <div className="mt-5 pt-5 border-t border-rule space-y-4">
                  <div className="flex gap-2">
                    {ACTIONS.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setAction(a.value)}
                        className={`px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                          action === a.value
                            ? 'bg-fg text-bg border-fg'
                            : 'border-rule text-fg hover:bg-[var(--hover)]'
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
                    className="w-full px-4 py-2.5 border border-rule bg-bg text-[13px] text-fg placeholder:text-rule transition-colors"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => resolveBreak(item.id)}
                      className="px-5 py-2 bg-botanical-green text-rail-fg text-[13px] font-medium hover:opacity-90 transition-opacity"
                    >
                      Confirmar resolución
                    </button>
                    <button
                      onClick={() => { setResolving(null); setNote(''); }}
                      className="px-4 py-2 text-[13px] text-rule-dark hover:text-fg transition-colors"
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
              <div className="mt-8 mb-4 pb-3 border-b border-rule">
                <h3 className="font-garamond italic text-[20px] text-rule-dark">Resueltos</h3>
              </div>
              {resolvedBreaks.map(item => (
                <div key={item.id} className="border border-rule p-5 bg-bg opacity-70">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-block px-2 py-[1px] text-[11px] font-medium bg-botanical-green-light text-botanical-green">
                          RESUELTO
                        </span>
                        <span className="font-garamond italic text-[14px] text-rule-dark">
                          {formatBreakType(item.breakType)}
                        </span>
                        <span className="text-[11px] text-rule-dark font-mono">{item.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex gap-4 text-[13px] text-rule-dark">
                        {item.resolutionAction && <span>Acción: <strong className="text-fg">{item.resolutionAction}</strong></span>}
                        {item.resolutionNote && <span>Nota: {item.resolutionNote}</span>}
                      </div>
                    </div>
                    {canResolve && (
                      <button
                        onClick={() => reopenBreak(item.id)}
                        className="px-3 py-1.5 text-[12px] border border-rule text-fg hover:bg-[var(--hover)] shrink-0 transition-colors"
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
