import React from 'react';
import { FILTERS } from '../data.js';

export default function Toolbar({ status, onStatusChange, summary }) {
  return (
    <div className="toolbar">
      <fieldset className="segmented">
        <legend className="sr-only">Status</legend>
        <div className="segmented__track">
          {FILTERS.map((filter) => {
            const active = filter.value === status;
            return (
              <label key={filter.value} className={active ? 'segment segment--on' : 'segment'}>
                <input
                  className="segment__input"
                  type="radio"
                  name="run-status"
                  value={filter.value}
                  checked={active}
                  onChange={() => onStatusChange(filter.value)}
                />
                <span className="segment__label">{filter.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="toolbar__summary">{summary}</p>
    </div>
  );
}
