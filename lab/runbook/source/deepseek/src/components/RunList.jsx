import React from 'react';
import { STATUSES, checkCount, checkSummary, checksFor } from '../data.js';
import { StatusChip, TickStrip } from './ui.jsx';

function RunRow({ run, selected, onSelect }) {
  const status = STATUSES[run.status];
  const checks = checksFor(run);
  const { passed } = checkCount(run);

  return (
    <li className="runs__item">
      <button type="button" className="run" aria-pressed={selected} onClick={() => onSelect(run.id)}>
        <span className="run__main">
          <span className="run__title">{run.title}</span>
          <span className="run__meta">
            <span className="mono">{run.code}</span>
            <span className="run__dot" aria-hidden="true">
              ·
            </span>
            <span>{run.model}</span>
          </span>
        </span>
        <span className="run__status">
          <StatusChip status={status} />
        </span>
        <span className="run__checks">
          <span className="run__checksText">{checkSummary(run)}</span>
          <TickStrip checks={checks} />
        </span>
        <span className="run__metric">{run.duration}</span>
        <span className="run__metric">{run.cost}</span>
        <span className="run__started">{run.started}</span>
      </button>
    </li>
  );
}

export default function RunList({ runs, activeId, onSelect }) {
  return (
    <section className="panel panel--list" aria-labelledby="runs-heading">
      <div className="panel__head">
        <h2 className="panel__title" id="runs-heading">
          Runs
        </h2>
        <p className="panel__hint">Newest first</p>
      </div>
      <div className="listhead" aria-hidden="true">
        <span>Run</span>
        <span>Status</span>
        <span>Checks</span>
        <span className="is-num">Duration</span>
        <span className="is-num">Cost</span>
        <span className="is-num">Started</span>
      </div>
      <ul className="runs" role="list">
        {runs.map((run) => (
          <RunRow key={run.id} run={run} selected={run.id === activeId} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}
