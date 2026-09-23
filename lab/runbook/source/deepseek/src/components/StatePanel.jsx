import React from 'react';

function LoadingState() {
  return (
    <div className="state">
      <p className="state__title" role="status">
        Loading runs…
      </p>
      <p className="state__body">Fetching the last two days of experiment runs.</p>
      <ul className="skeleton" role="list" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li className="skeleton__row" key={row} />
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ onClearFilter }) {
  return (
    <div className="state">
      <h2 className="state__title">No runs match this filter</h2>
      <p className="state__body">
        The queue still holds runs from the last two days. Pick another status, or clear the filter to see all three.
      </p>
      <button type="button" className="btn btn--primary" onClick={onClearFilter}>
        Clear filter
      </button>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="state">
      <h2 className="state__title" role="alert">
        Could not load experiment runs.
      </h2>
      <p className="state__body">The runner answered 503 twice. Nothing was lost — the runs are still queued.</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export default function StatePanel({ mode, onClearFilter, onRetry }) {
  return (
    <section className="panel panel--state" aria-label="Run results">
      {mode === 'loading' ? (
        <LoadingState />
      ) : mode === 'error' ? (
        <ErrorState onRetry={onRetry} />
      ) : (
        <EmptyState onClearFilter={onClearFilter} />
      )}
    </section>
  );
}
