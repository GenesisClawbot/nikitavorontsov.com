import React, { useMemo, useState } from 'react';
import { RUNS, queueStats } from './data.js';
import Toolbar from './components/Toolbar.jsx';
import RunList from './components/RunList.jsx';
import RunDetail from './components/RunDetail.jsx';
import StatePanel from './components/StatePanel.jsx';
import PreviewBar from './components/PreviewBar.jsx';
import './styles.css';

export default function App() {
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(RUNS[0].id);
  const [preview, setPreview] = useState(null);

  const visibleRuns = useMemo(
    () => (status === 'all' ? RUNS : RUNS.filter((run) => run.status === status)),
    [status],
  );

  // Keep the detail panel and the pressed row in agreement: if the selected run
  // is filtered out, the first visible run takes over.
  const activeId = visibleRuns.some((run) => run.id === selectedId) ? selectedId : (visibleRuns[0]?.id ?? null);
  const activeRun = visibleRuns.find((run) => run.id === activeId) ?? null;

  const mode = preview ?? (visibleRuns.length === 0 ? 'empty' : 'ready');
  const summary = preview
    ? `Previewing the ${preview} state`
    : `${visibleRuns.length} of ${RUNS.length} runs`;

  function clearFilter() {
    setStatus('all');
    setPreview(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__left">
            <span className="brand">
              <span className="brand__mark" aria-hidden="true" />
              Runbook
            </span>
            <span className="topbar__sep" aria-hidden="true" />
            <p className="topbar__context">Pattern library</p>
          </div>
          <p className="topbar__meta">Refreshed 4 minutes ago</p>
        </div>
      </header>

      <main className="page">
        <div className="page__head">
          <div className="page__intro">
            <p className="eyebrow">Review queue</p>
            <h1>Experiment runs</h1>
            <p className="lede">Small tests. Clear results.</p>
          </div>
          <dl className="stats">
            {queueStats().map((stat) => (
              <div className="stat" key={stat.label}>
                <dt className="stat__label">{stat.label}</dt>
                <dd className="stat__value">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Toolbar status={status} onStatusChange={setStatus} summary={summary} />

        <div className="grid">
          {mode === 'ready' ? (
            <>
              <RunList runs={visibleRuns} activeId={activeId} onSelect={setSelectedId} />
              <RunDetail run={activeRun} />
            </>
          ) : (
            <StatePanel mode={mode} onClearFilter={clearFilter} onRetry={() => setPreview(null)} />
          )}
        </div>

        <PreviewBar
          preview={preview}
          onChange={(id) => setPreview((current) => (current === id ? null : id))}
          onReset={() => setPreview(null)}
        />
      </main>

      <footer className="foot">
        <div className="foot__inner">
          <p>Runs are kept for 30 days. Costs are estimates from the model provider.</p>
          <p>Runbook 0.4 · pattern library team</p>
        </div>
      </footer>
    </div>
  );
}
