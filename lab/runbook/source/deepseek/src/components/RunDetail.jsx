import React, { useEffect, useRef, useState } from 'react';
import { STATUSES, checkCount, checksFor } from '../data.js';
import { CheckMark, Fields, StatusChip } from './ui.jsx';

export default function RunDetail({ run }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const status = STATUSES[run.status];
  const checks = checksFor(run);
  const { passed, total } = checkCount(run);
  const failed = total - passed;

  useEffect(() => {
    setCopied(false);
  }, [run.id]);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyChecks() {
    const text = [`${run.code} — ${run.title}`, ...checks.map((c) => `${c.passed ? 'pass' : 'fail'}  ${c.name}`)].join(
      '\n',
    );
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard is optional */
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="panel panel--detail" aria-label="Selected run">
      <p className="eyebrow">Selected run</p>
      <div className="detail__head">
        <h2 className="detail__title">{run.title}</h2>
        <StatusChip status={status} />
      </div>
      <p className="detail__tags">
        <span className="mono">{run.code}</span>
        <span aria-hidden="true">·</span>
        <span className="mono">{run.branch}</span>
      </p>

      <Fields
        items={[
          { label: 'Model', value: run.model },
          { label: 'Duration', value: run.duration, mono: true },
          { label: 'Cost', value: run.cost, mono: true },
          { label: 'Started', value: run.started },
        ]}
      />

      <div className="detail__section">
        <div className="detail__sectionTop">
          <h3>Checks</h3>
          <p className="detail__count">{`${passed} passed · ${failed} failed`}</p>
        </div>
        <ul className="checks" role="list">
          {checks.map((check) => (
            <li className="check" key={check.name}>
              <CheckMark passed={check.passed} />
              <span className="check__name">{check.name}</span>
              {check.passed ? (
                <span className="sr-only">Passed</span>
              ) : (
                <span className="check__result">Failed</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="detail__section">
        <h3>Note</h3>
        <p className="note">{run.note}</p>
      </div>

      <div className="detail__actions">
        <button type="button" className="btn btn--primary">
          Inspect run
        </button>
        <button type="button" className="btn btn--ghost" onClick={copyChecks}>
          {copied ? 'Copied' : 'Copy check list'}
        </button>
      </div>
    </section>
  );
}
