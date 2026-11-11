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

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[var(--card-border)] rounded-xl p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || ''}`}>{value}</p>
    </div>
  );
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

  if (loading) return <p className="text-[var(--muted)]">Cargando reporte...</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!report) return null;

  const matchRate = report.items.total > 0
    ? ((report.items.matched / report.items.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard</h2>
        {report.lastRunAt && (
          <span className="text-sm text-[var(--muted)]">
            Última corrida: {new Date(report.lastRunAt).toLocaleString('es')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Corridas totales" value={report.runs.total} />
        <StatCard label="Completadas" value={report.runs.completed} color="text-[var(--success)]" />
        <StatCard label="Fallidas" value={report.runs.failed} color="text-[var(--danger)]" />
        <StatCard label="Tasa de match" value={`${matchRate}%`} color="text-[var(--primary)]" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Items totales" value={report.items.total} />
        <StatCard label="Matched" value={report.items.matched} color="text-[var(--success)]" />
        <StatCard label="Breaks" value={report.items.breaks} color="text-[var(--warning)]" />
        <StatCard label="Pendientes" value={report.items.pending} color="text-[var(--muted)]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-[var(--card-border)] rounded-xl p-5">
          <h3 className="font-semibold mb-3">Breaks por tipo</h3>
          {Object.keys(report.breaksByType).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin breaks detectados</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(report.breaksByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{type}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[var(--card-border)] rounded-xl p-5">
          <h3 className="font-semibold mb-3">Resolución</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Abiertos</span>
              <span className="font-bold text-[var(--warning)]">{report.resolution.open}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Resueltos</span>
              <span className="font-bold text-[var(--success)]">{report.resolution.resolved}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tasa de resolución</span>
              <span className="font-bold text-[var(--primary)]">{report.resolution.resolutionRate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
