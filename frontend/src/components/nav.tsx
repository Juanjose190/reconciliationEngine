'use client';

import { useAuth } from '@/lib/auth';

type View = 'dashboard' | 'runs' | 'breaks';

interface NavProps {
  current: View;
  onChange: (view: View) => void;
}

export function Nav({ current, onChange }: NavProps) {
  const { email, tenant, role, logout } = useAuth();

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'runs', label: 'Corridas' },
    { key: 'breaks', label: 'Breaks' },
  ];

  return (
    <header className="bg-white border-b border-[var(--card-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <span className="font-bold text-lg">Recon</span>
            <nav className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => onChange(t.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    current === t.key
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--muted)]">
              {email} <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{role}</span>
              <span className="text-xs ml-1 text-slate-400">@{tenant}</span>
            </span>
            <button onClick={logout} className="text-[var(--danger)] hover:underline text-sm">
              Salir
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
