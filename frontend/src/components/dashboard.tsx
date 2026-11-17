'use client';

import { useState } from 'react';
import { Nav, View } from './nav';
import { ReportView } from './report-view';
import { RunsView } from './runs-view';
import { BreaksView } from './breaks-view';
import { HealthView } from './health-view';

export function Dashboard() {
  const [view, setView] = useState<View>('runs');

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Nav current={view} onChange={setView} />
      <main className="flex-1 px-4 py-6 md:px-12 md:py-10 overflow-auto">
        {view === 'runs' && <RunsView />}
        {view === 'breaks' && <BreaksView />}
        {view === 'reports' && <ReportView />}
        {view === 'health' && <HealthView />}
      </main>
    </div>
  );
}
