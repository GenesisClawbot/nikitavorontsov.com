import React, { useState } from 'react';
import './styles.css';

const TOTAL_CHECKS = 8;

const RUBRIC = [
  'Layout holds at 390px',
  'Labels stay legible',
  'Focus order matches reading order',
  'Empty state names the filter',
  'Error copy states the cause',
  'Muted text keeps contrast',
  'Targets are at least 44px tall',
  'Controls have accessible names',
];

const RUNS = [
  {
    id: 'run-128',
    ref: 'Run 128',
    name: 'Mobile table wrap',
    model: 'Mica 7B',
    status: 'Needs review',
    checks: 6,
    total: TOTAL_CHECKS,
    duration: '01:42',
    cost: '$0.03',
    started: 'Today, 10:24',
    note: 'The last column moves below the table at 390px. Two labels are too small to read.',
    failed: [1, 5],
  },
  {
    id: 'run-127',
    ref: 'Run 127',
    name: 'Empty filter state',
    model: 'Pine 3',
    status: 'Passed',
    checks: 8,
    total: TOTAL_CHECKS,
    duration: '00:58',
    cost: '$0.01',
    started: 'Today, 09:51',
    note: 'The empty message names the active filter and keeps the reset action in reach.',
    failed: [],
  },
  {
    id: 'run-124',
    ref: 'Run 124',
    name: 'Keyboard focus order',
    model: 'Mica 7B',
    status: 'Failed',
    checks: 4,
    total: TOTAL_CHECKS,
    duration: '02:13',
    cost: '$0.04',
    started: 'Yesterday, 16:08',
    note: 'Tab leaves the filter bar after one stop, so four rubric checks fall out of order.',
    failed: [1, 2, 6, 7],
  },
];

const STATUS_OPTIONS = ['All runs', 'Passed', 'Needs review', 'Failed'];

const TONE = {
  Passed: 'pass',
  Failed: 'fail',
  'Needs review': 'review',
};

const toSeconds = (value) => {
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
};

const CLOCK = (() => {
  const total = RUNS.reduce((sum, run) => sum + toSeconds(run.duration), 0);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
})();

const SPEND = (() => {
  const cents = RUNS.reduce((sum, run) => sum + Number(run.cost.replace('$0.', '')), 0);
  return `$0.${String(cents).padStart(2, '0')}`;
})();

const CHECKS_PASSED = RUNS.reduce((sum, run) => sum + run.checks, 0);
const CHECKS_TOTAL = RUNS.reduce((sum, run) => sum + run.total, 0);

function StatusChip({ status }) {
  return (
    <span className={`chip chip--${TONE[status]}`}>
      <span className="chip-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

function Meter({ value, total, size, status }) {
  const classes = ['meter'];
  if (size === 'lg') classes.push('meter--lg');
  if (status) classes.push(`meter--${TONE[status]}`);
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < value ? 'seg seg--on' : 'seg'} />
      ))}
    </span>
  );
}

function RunRow({ run, selected, onSelect }) {
  return (
    <li className="run-item">
      <button
        type="button"
        className={`run-row run-row--${TONE[run.status]}${selected ? ' is-selected' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(run.id)}
      >
        <span className="row-line row-line--top">
          <span className="run-name">{run.name}</span>
          <StatusChip status={run.status} />
        </span>
        <span className="row-line">
          <span className="row-checks">
            <Meter value={run.checks} total={run.total} status={run.status} />
            <span className="mono">{run.checks} of {run.total} checks</span>
          </span>
          <span className="mono row-figure">{run.duration} · {run.cost}</span>
        </span>
        <span className="row-line row-line--sub">
          <span className="mono">{run.ref} · {run.model}</span>
          <span className="mono">{run.started}</span>
        </span>
      </button>
    </li>
  );
}

export default function App() {
  const [filter, setFilter] = useState('All runs');
  const [selectedId, setSelectedId] = useState(RUNS[0].id);
  const [listState, setListState] = useState('normal');
  const [inspecting, setInspecting] = useState(false);

  const selected = RUNS.find((run) => run.id === selectedId) || RUNS[0];
  const filtered = filter === 'All runs' ? RUNS : RUNS.filter((run) => run.status === filter);

  const countText =
    listState === 'loading'
      ? 'Waiting on results'
      : listState === 'error'
        ? 'Results unavailable'
        : `${listState === 'empty' ? 0 : filtered.length} of ${RUNS.length} runs`;

  function handleFilter(next) {
    setFilter(next);
    setListState('normal');
    const nextList = next === 'All runs' ? RUNS : RUNS.filter((run) => run.status === next);
    if (nextList.length && !nextList.some((run) => run.id === selectedId)) {
      setSelectedId(nextList[0].id);
      setInspecting(false);
    }
  }

  function handleSelect(id) {
    setSelectedId(id);
    setInspecting(false);
  }

  function clearFilter() {
    setFilter('All runs');
    setListState('normal');
  }

  let body;
  if (listState === 'loading') {
    body = (
      <div className="state state--loading">
        <p className="state-line" role="status">Loading runs…</p>
        <div className="skeleton" aria-hidden="true">
          <span className="sk-row" />
          <span className="sk-row" />
          <span className="sk-row" />
        </div>
      </div>
    );
  } else if (listState === 'error') {
    body = (
      <div className="state state--error">
        <p className="state-line" role="alert">Could not load experiment runs.</p>
        <p className="state-hint">The filter stays as it is. Use Show normal state to bring the list back.</p>
      </div>
    );
  } else if (listState === 'empty' || filtered.length === 0) {
    body = (
      <div className="state state--empty">
        <p className="state-title">No runs match this filter</p>
        <p className="state-hint">Nothing in batch 24 recorded this result yet.</p>
        <button type="button" className="btn btn--quiet" onClick={clearFilter}>
          Clear filter
        </button>
      </div>
    );
  } else {
    body = (
      <ul className="run-list">
        {filtered.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            selected={run.id === selectedId}
            onSelect={handleSelect}
          />
        ))}
      </ul>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <span className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Runbook
        </span>
        <p className="topbar-meta">Batch 24 · Mobile web</p>
      </div>

      <header className="page-head">
        <div className="page-head-text">
          <h1>Experiment runs</h1>
          <p className="summary">Small tests. Clear results.</p>
        </div>
        <dl className="ledger">
          <div className="ledger-cell">
            <dt>Runs</dt>
            <dd className="mono">{RUNS.length}</dd>
          </div>
          <div className="ledger-cell">
            <dt>Checks</dt>
            <dd className="mono">{CHECKS_PASSED} of {CHECKS_TOTAL}</dd>
          </div>
          <div className="ledger-cell">
            <dt>Run time</dt>
            <dd className="mono">{CLOCK}</dd>
          </div>
          <div className="ledger-cell">
            <dt>Spend</dt>
            <dd className="mono">{SPEND}</dd>
          </div>
        </dl>
      </header>

      <div className="grid">
        <section className="panel runs-panel" aria-label="Runs">
          <div className="panel-head">
            <h2 className="panel-title">Runs</h2>
            <div className="filter">
              <label className="filter-label" htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                className="filter-select"
                value={filter}
                onChange={(event) => handleFilter(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="count mono">{countText}</p>

          {body}

          <div className="panel-foot" role="group" aria-label="List state preview">
            <p className="foot-label">Preview list states</p>
            <div className="preview-btns">
              <button
                type="button"
                className="chip-btn"
                aria-pressed={listState === 'loading'}
                onClick={() => setListState('loading')}
              >
                Loading preview
              </button>
              <button
                type="button"
                className="chip-btn"
                aria-pressed={listState === 'error'}
                onClick={() => setListState('error')}
              >
                Error preview
              </button>
              <button
                type="button"
                className="chip-btn"
                aria-pressed={listState === 'empty'}
                onClick={() => setListState('empty')}
              >
                Empty state preview
              </button>
              <span className="preview-split" aria-hidden="true" />
              <button
                type="button"
                className="chip-btn chip-btn--reset"
                aria-pressed={listState === 'normal'}
                onClick={() => setListState('normal')}
              >
                Show normal state
              </button>
            </div>
          </div>
        </section>

        <section
          className="panel detail"
          role="region"
          aria-label="Selected run"
          aria-live="polite"
        >
          <p className="eyebrow">Selected run</p>
          <div className="detail-head">
            <h2 className="detail-title">{selected.name}</h2>
            <StatusChip status={selected.status} />
          </div>
          <p className="detail-sub mono">{selected.ref} · {selected.model}</p>

          <dl className="spec">
            <div className="spec-row">
              <dt>Checks</dt>
              <dd>
                <span className="spec-checks">
                  <Meter
                    value={selected.checks}
                    total={selected.total}
                    size="lg"
                    status={selected.status}
                  />
                  <span className="mono">{selected.checks} of {selected.total} checks</span>
                </span>
              </dd>
            </div>
            <div className="spec-row">
              <dt>Run time</dt>
              <dd className="mono">{selected.duration}</dd>
            </div>
            <div className="spec-row">
              <dt>Cost</dt>
              <dd className="mono">{selected.cost}</dd>
            </div>
            <div className="spec-row">
              <dt>Started</dt>
              <dd className="mono">{selected.started}</dd>
            </div>
          </dl>

          <div className="note">
            <p className="eyebrow">Note</p>
            <p className="note-text">{selected.note}</p>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="btn"
              aria-expanded={inspecting}
              onClick={() => setInspecting((open) => !open)}
            >
              {inspecting ? 'Close inspection' : 'Inspect run'}
            </button>
          </div>

          {inspecting ? (
            <div className="inspect">
              <p className="eyebrow">Rubric · {selected.checks} of {selected.total} checks</p>
              <ul className="checks">
                {RUBRIC.map((label, index) => {
                  const passed = !selected.failed.includes(index);
                  return (
                    <li key={label} className={passed ? 'check check--pass' : 'check check--fail'}>
                      <span className="check-mark" aria-hidden="true">{passed ? '✓' : '✕'}</span>
                      <span className="check-label">{label}</span>
                      <span className="check-state mono">{passed ? 'Pass' : 'Fail'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
