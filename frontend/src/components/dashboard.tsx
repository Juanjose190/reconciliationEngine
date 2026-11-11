'use client';

import { useState } from 'react';
import { Nav } from './nav';
import { ReportView } from './report-view';
import { RunsView } from './runs-view';
import { BreaksView } from './breaks-view';

type View = 'dashboard' | 'runs' | 'breaks';

export function Dashboard() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className="min-h-screen">
      <Nav current={view} onChange={setView} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {view === 'dashboard' && <ReportView />}
        {view === 'runs' && <RunsView />}
        {view === 'breaks' && <BreaksView />}
      </main>
    </div>
  );
}
