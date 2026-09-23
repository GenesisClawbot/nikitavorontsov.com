import React, { useId, useMemo, useState } from 'react';
import './styles.css';

const TOTAL_CHECKS = 8;

const RUNS = [
  {
    id: 'run-142',
    name: 'Mobile table wrap',
    model: 'Mica 7B',
    status: 'review',
    passed: 6,
    duration: '01:42',
    cost: '$0.03',
    started: 'Today, 10:24',
    note: 'The last column moves below the table at 390px. Two labels are too small to read.',
    checks: [
      ['Renders at 1280px', true],
      ['Renders at 768px', true],
      ['Columns fit at 390px', false],
      ['Label size ≥ 12px', false],
      ['No horizontal scroll', true],
      ['Header stays sticky', true],
      ['Row actions reachable', true],
      ['Totals row aligned', true],
    ],
  },
  {
    id: 'run-141',
    name: 'Empty filter state',
    model: 'Pine 3',
    status: 'passed',
    passed: 8,
    duration: '00:58',
    cost: '$0.01',
    started: 'Today, 09:51',
    note: 'The message and the clear action show for every filter. Nothing to change.',
    checks: [
      ['Message shown on zero results', true],
      ['Clear action present', true],
      ['Clear restores all rows', true],
      ['Filter value announced', true],
      ['No layout shift', true],
      ['Copy under 12 words', true],
      ['Works with keyboard', true],
      ['Counts reset to total', true],
    ],
  },
  {
    id: 'run-140',
    name: 'Keyboard focus order',
    model: 'Mica 7B',
    status: 'failed',
    passed: 4,
    duration: '02:13',
    cost: '$0.04',
    started: 'Yesterday, 16:08',
    note: 'Focus jumps from the filter to the footer, skipping the list. The dialog does not trap focus.',
    checks: [
      ['Skip link works', true],
      ['Filter reachable by Tab', true],
      ['List follows filter', false],
      ['Focus ring visible', true],
      ['Dialog traps focus', false],
      ['Escape closes dialog', true],
      ['Focus returns on close', false],
      ['No positive tabindex', false],
    ],
  },
];

const STATUS = {
  review: { label: 'Needs review', tone: 'review' },
  passed: { label: 'Passed', tone: 'passed' },
  failed: { label: 'Failed', tone: 'failed' },
};

const FILTERS = [
  { value: 'all', label: 'All runs' },
  { value: 'review', label: 'Needs review' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
];

function StatusBadge({ status }) {
  const s = STATUS[status];
  return (
    <span className={`badge badge--${s.tone}`}>
      <span className="badge__dot" aria-hidden="true" />
      {s.label}
    </span>
  );
}

function CheckMeter({ passed, status }) {
  return (
    <span className="meter">
      <span className={`meter__bar meter__bar--${status}`} aria-hidden="true">
        {Array.from({ length: TOTAL_CHECKS }, (_, i) => (
          <span key={i} className={i < passed ? 'is-on' : ''} />
        ))}
      </span>
      <span className="meter__text">
        {passed} of {TOTAL_CHECKS} checks
      </span>
    </span>
  );
}

function StatusFilter({ value, onChange, counts }) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className="sr-only">Status</legend>
      {FILTERS.map((f) => (
        <label key={f.value} className={value === f.value ? 'is-active' : ''}>
          <input
            type="radio"
            name={name}
            value={f.value}
            checked={value === f.value}
            onChange={() => onChange(f.value)}
          />
          <span>{f.label}</span>
          <span className="segmented__count" aria-hidden="true">
            {counts[f.value]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RunRow({ run, selected, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className="run"
        aria-pressed={selected}
        onClick={() => onSelect(run.id)}
      >
        <span className="run__main">
          <span className="run__name">{run.name}</span>
          <span className="run__model">{run.model}</span>
        </span>
        <span className="run__status">
          <StatusBadge status={run.status} />
        </span>
        <span className="run__checks">
          <CheckMeter passed={run.passed} status={run.status} />
        </span>
        <span className="run__num">{run.duration}</span>
        <span className="run__num">{run.cost}</span>
        <span className="run__time">{run.started}</span>
      </button>
    </li>
  );
}

function SelectedRun({ run }) {
  const [inspecting, setInspecting] = useState(false);
  const checksId = useId();

  if (!run) {
    return (
      <section className="detail" aria-labelledby="selected-heading">
        <h2 id="selected-heading" className="eyebrow">Selected run</h2>
        <p className="muted">Choose a run to see its note.</p>
      </section>
    );
  }

  const failed = run.checks.filter(([, ok]) => !ok);

  return (
    <section className="detail" aria-labelledby="selected-heading">
      <h2 id="selected-heading" className="eyebrow">Selected run</h2>
      <div className="detail__head">
        <h3 className="detail__title">{run.name}</h3>
        <StatusBadge status={run.status} />
      </div>

      <blockquote className="note">
        <p>{run.note}</p>
      </blockquote>

      <dl className="facts">
        <div>
          <dt>Model</dt>
          <dd>{run.model}</dd>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>{run.passed} / {TOTAL_CHECKS}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd className="tabular">{run.duration}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className="tabular">{run.cost}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="btn btn--primary"
        aria-expanded={inspecting}
        aria-controls={checksId}
        onClick={() => setInspecting((v) => !v)}
      >
        Inspect run
      </button>

      <div id={checksId} hidden={!inspecting} className="checks">
        <h4 className="checks__title">
          {failed.length === 0
            ? 'All checks passed'
            : `${failed.length} failing ${failed.length === 1 ? 'check' : 'checks'}`}
        </h4>
        <ul>
          {run.checks.map(([label, ok]) => (
            <li key={label} className={ok ? 'ok' : 'bad'}>
              <span className="checks__mark" aria-hidden="true">{ok ? '✓' : '✕'}</span>
              <span>{label}</span>
              <span className="sr-only">{ok ? ' — passed' : ' — failed'}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PreviewBar({ view, onView }) {
  const items = [
    { value: 'normal', content: <><span className="sr-only">Show </span>Normal<span className="sr-only"> state</span></> },
    { value: 'empty', content: <>Empty<span className="sr-only"> state preview</span></> },
    { value: 'loading', content: <>Loading<span className="sr-only"> preview</span></> },
    { value: 'error', content: <>Error<span className="sr-only"> preview</span></> },
  ];
  return (
    <div className="preview" role="group" aria-labelledby="preview-label">
      <span id="preview-label" className="preview__label">Preview state</span>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`preview__btn ${view === item.value ? 'is-active' : ''}`}
          aria-pressed={view === item.value}
          onClick={() => onView(item.value)}
        >
          {item.content}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(RUNS[0].id);
  const [view, setView] = useState('normal');

  const counts = useMemo(() => {
    const c = { all: RUNS.length, review: 0, passed: 0, failed: 0 };
    RUNS.forEach((r) => { c[r.status] += 1; });
    return c;
  }, []);

  const visible = view === 'empty'
    ? []
    : RUNS.filter((r) => filter === 'all' || r.status === filter);

  const selected =
    visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const totalPassed = RUNS.reduce((n, r) => n + r.passed, 0);

  const clearFilter = () => {
    setFilter('all');
    setView('normal');
  };

  let body;
  if (view === 'loading') {
    body = (
      <div className="state" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading runs…
      </div>
    );
  } else if (view === 'error') {
    body = (
      <div className="state state--error" role="alert">
        <p className="state__title">Could not load experiment runs.</p>
        <p className="muted">The run service did not respond. Your filters are kept.</p>
        <button type="button" className="btn" onClick={() => setView('normal')}>
          Show normal state
        </button>
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="state">
        <p className="state__title">No runs match this filter</p>
        <p className="muted">Try another status, or clear the filter to see every run.</p>
        <button type="button" className="btn" onClick={clearFilter}>
          Clear filter
        </button>
      </div>
    );
  } else {
    body = (
      <div className="layout">
        <div className="table">
          <div className="table__head" aria-hidden="true">
            <span>Experiment</span>
            <span>Status</span>
            <span>Checks</span>
            <span className="num">Time</span>
            <span className="num">Cost</span>
            <span>Started</span>
          </div>
          <ul className="runs" aria-label="Runs">
            {visible.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                selected={selected?.id === run.id}
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        </div>
        <SelectedRun key={selected?.id} run={selected} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="brand__mark" aria-hidden="true" />
          Runbook
        </span>
        <PreviewBar view={view} onView={setView} />
      </header>

      <main className="page">
        <div className="page__head">
          <div>
            <h1>Experiment runs</h1>
            <p className="summary">Small tests. Clear results.</p>
          </div>
          <p className="totals">
            <span><strong>{RUNS.length}</strong> runs</span>
            <span><strong>{totalPassed}</strong>/{RUNS.length * TOTAL_CHECKS} checks passed</span>
          </p>
        </div>

        <div className="toolbar">
          <StatusFilter value={filter} onChange={(v) => { setFilter(v); if (view === 'empty') setView('normal'); }} counts={counts} />
        </div>

        {body}
      </main>
    </div>
  );
}
