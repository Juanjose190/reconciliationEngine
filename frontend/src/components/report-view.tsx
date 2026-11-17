'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Report {
  runs: { total: number; completed: number; failed: number };
  items: { total: number; matched: number; breaks: number; pending: number };
  breaksByType: Record<string, number>;
  resolution: { open: number; resolved: number; resolutionRate: string };
  lastRunAt: string | null;
}

function formatBreakType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function ReportView() {
  const { token } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 31 * 86400_000);
    const to = new Date(now.getTime() + 86400_000);
    api<Report>(
      `/reconciliation/report?periodFrom=${from.toISOString()}&periodTo=${to.toISOString()}`,
      { token: token! },
    )
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-rule-dark">Cargando reporte...</p>;
  if (error) {
    return (
      <div className="bg-botanical-scarlet-light border border-botanical-scarlet/20 text-botanical-scarlet px-4 py-3 text-[13px]">
        {error}
      </div>
    );
  }
  if (!report) return null;

  const matchRate = report.items.total > 0
    ? ((report.items.matched / report.items.total) * 100).toFixed(1)
    : '0';

  const resolutionTotal = report.resolution.open + report.resolution.resolved;
  const resolutionPct = resolutionTotal > 0
    ? ((report.resolution.resolved / resolutionTotal) * 100).toFixed(1)
    : '0';

  const breakEntries = Object.entries(report.breaksByType);
  const maxBreakCount = breakEntries.length > 0 ? Math.max(...breakEntries.map(([, c]) => c)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h2 className="font-garamond italic text-[34px] text-fg leading-tight">
            Reporte de Reconciliación
          </h2>
          <p className="text-[12px] text-rule-dark tracking-[0.06em] uppercase font-medium mt-1">
            {report.lastRunAt
              ? `Última ejecución: ${new Date(report.lastRunAt).toLocaleDateString('es', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : 'Sin ejecuciones recientes'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-rule mb-10">
        <div className="bg-bg p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">Ejecuciones</div>
          <div className="text-[32px] font-semibold tabular-nums leading-none">{report.runs.total}</div>
          <div className="mt-2 flex gap-3 text-[12px]">
            <span className="text-botanical-green">{report.runs.completed} completas</span>
            {report.runs.failed > 0 && (
              <span className="text-botanical-scarlet">{report.runs.failed} con error</span>
            )}
          </div>
        </div>
        <div className="bg-bg p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">Tasa de Match</div>
          <div className="text-[32px] font-semibold tabular-nums leading-none text-botanical-green">{matchRate}%</div>
          <div className="mt-2 text-[12px] text-rule-dark">
            {report.items.matched} de {report.items.total} items
          </div>
        </div>
        <div className="bg-bg p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">Breaks Abiertos</div>
          <div className="text-[32px] font-semibold tabular-nums leading-none text-botanical-scarlet">{report.resolution.open}</div>
          <div className="mt-2 text-[12px] text-rule-dark">
            {report.items.breaks} detectados
          </div>
        </div>
        <div className="bg-bg p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-rule-dark mb-2">Resolución</div>
          <div className="text-[32px] font-semibold tabular-nums leading-none">{resolutionPct}%</div>
          <div className="mt-2 text-[12px] text-rule-dark">
            {report.resolution.resolved} resueltos
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div>
          <h3 className="font-garamond italic text-[22px] mb-4 pb-3 border-b-2 border-fg">
            Clasificación de Breaks
          </h3>
          {breakEntries.length === 0 ? (
            <p className="text-rule-dark text-[14px]">Sin breaks detectados en el período.</p>
          ) : (
            <div className="space-y-3">
              {breakEntries
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="font-garamond italic text-[14px] text-botanical-scarlet w-[200px] shrink-0">
                      {formatBreakType(type)}
                    </span>
                    <div className="flex-1 h-[6px] bg-rule/30">
                      <div
                        className="h-full bg-botanical-scarlet"
                        style={{ width: `${maxBreakCount > 0 ? (count / maxBreakCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[14px] font-semibold tabular-nums w-[40px] text-right">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-garamond italic text-[22px] mb-4 pb-3 border-b-2 border-fg">
            Distribución de Items
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-rule">
              <div className="flex items-center gap-3">
                <span className="w-[8px] h-[8px] bg-botanical-green" />
                <span className="text-[14px]">Matched</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] font-semibold tabular-nums text-botanical-green">{report.items.matched}</span>
                <span className="text-[12px] text-rule-dark">
                  {report.items.total > 0 ? ((report.items.matched / report.items.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-rule">
              <div className="flex items-center gap-3">
                <span className="w-[8px] h-[8px] bg-botanical-scarlet" />
                <span className="text-[14px]">Breaks</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] font-semibold tabular-nums text-botanical-scarlet">{report.items.breaks}</span>
                <span className="text-[12px] text-rule-dark">
                  {report.items.total > 0 ? ((report.items.breaks / report.items.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-rule">
              <div className="flex items-center gap-3">
                <span className="w-[8px] h-[8px] bg-botanical-amber" />
                <span className="text-[14px]">Pendientes</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] font-semibold tabular-nums text-botanical-amber">{report.items.pending}</span>
                <span className="text-[12px] text-rule-dark">
                  {report.items.total > 0 ? ((report.items.pending / report.items.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-rule">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-rule-dark">Total items procesados</span>
              <span className="text-[20px] font-semibold tabular-nums">{report.items.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
