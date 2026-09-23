import React from 'react';

export function StatusChip({ status }) {
  return (
    <span className={`chip chip--${status.tone}`}>
      <span className="chip__dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}

/** Eight ticks, one per check. Failures carry the colour; passes stay quiet. */
export function TickStrip({ checks }) {
  return (
    <span className="ticks" aria-hidden="true">
      {checks.map((check) => (
        <span key={check.name} className={check.passed ? 'tick' : 'tick tick--fail'} />
      ))}
    </span>
  );
}

export function CheckMark({ passed }) {
  if (passed) {
    return (
      <svg className="check__mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path
          d="M3.6 8.5 6.4 11.3 12.4 4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      className="check__mark check__mark--fail"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Fields({ items }) {
  return (
    <dl className="fields">
      {items.map((item) => (
        <div className="field" key={item.label}>
          <dt className="field__label">{item.label}</dt>
          <dd className={item.mono ? 'field__value mono' : 'field__value'}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
