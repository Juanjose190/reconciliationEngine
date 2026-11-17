'use client';

import { useAuth } from '@/lib/auth';

export type View = 'runs' | 'breaks' | 'reports' | 'health';

interface NavProps {
  current: View;
  onChange: (view: View) => void;
}

const NAV_ITEMS: { key: View; label: string }[] = [
  { key: 'runs', label: 'Ejecuciones' },
  { key: 'breaks', label: 'Breaks' },
  { key: 'reports', label: 'Reportes' },
  { key: 'health', label: 'Salud' },
];

export function Nav({ current, onChange }: NavProps) {
  const { email, tenant, role, logout } = useAuth();

  return (
    <>
      {/* Desktop: vertical rail */}
      <nav className="hidden md:flex w-[220px] min-h-screen bg-rail-bg flex-col shrink-0">
        <div className="px-6 pt-8 pb-6 border-b border-rail-border">
          <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-rail-fg">
            Reconciliation Engine
          </span>
        </div>

        <div className="flex flex-col py-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`text-left px-6 py-3 text-[14px] font-medium transition-colors ${
                current === item.key
                  ? 'text-rail-fg bg-[rgba(245,241,234,0.07)] border-l-2 border-botanical-green'
                  : 'text-rail-muted hover:text-rail-fg border-l-2 border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-auto px-6 py-4 border-t border-rail-border">
          <div className="text-[11px] text-rail-muted leading-relaxed">
            <div className="font-medium text-rail-fg text-[12px] mb-0.5">{tenant}</div>
            <div>{email}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="uppercase tracking-wider text-[10px]">{role}</span>
              <span className="text-rail-border">·</span>
              <button onClick={logout} className="text-botanical-scarlet hover:underline">
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile: top bar + bottom nav */}
      <div className="md:hidden">
        <div className="bg-rail-bg px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-rail-fg">
            Reconciliation Engine
          </span>
          <div className="flex items-center gap-3 text-[11px] text-rail-muted">
            <span className="text-rail-fg font-medium">{tenant}</span>
            <button onClick={logout} className="text-botanical-scarlet">
              Salir
            </button>
          </div>
        </div>
        <div className="bg-rail-bg flex border-t border-rail-border">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex-1 py-2.5 text-[12px] font-medium text-center transition-colors ${
                current === item.key
                  ? 'text-rail-fg border-b-2 border-botanical-green'
                  : 'text-rail-muted border-b-2 border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
