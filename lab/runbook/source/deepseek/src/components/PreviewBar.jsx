import React from 'react';
import { PREVIEWS } from '../data.js';

export default function PreviewBar({ preview, onChange, onReset }) {
  return (
    <section className="previews" aria-label="State preview">
      <div className="previews__text">
        <p className="previews__title">State preview</p>
        <p className="previews__hint">See how the runs panel reads when it is empty, still loading, or broken.</p>
      </div>
      <div className="previews__actions" role="group" aria-label="Preview states">
        {PREVIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chipbtn"
            aria-pressed={preview === item.id}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="previews__divider" aria-hidden="true" />
        <button type="button" className="chipbtn chipbtn--reset" onClick={onReset} disabled={preview === null}>
          Show normal state
        </button>
      </div>
    </section>
  );
}
