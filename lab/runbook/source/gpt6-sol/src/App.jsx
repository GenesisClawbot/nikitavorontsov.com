import React, { useState } from 'react';
import './styles.css';

const runs = [
  { id: 'RUN-024', title: 'Mobile table wrap', subtitle: 'Responsive layout · Table at 390px', status: 'Needs review', checks: '6 of 8 checks', duration: '01:42', cost: '$0.03', time: 'Today, 10:24', model: 'Mica 7B', owner: 'Maya Chen', initials: 'MC', note: 'The last column moves below the table at 390px. Two labels are too small to read.', passed: 6, failed: 2 },
  { id: 'RUN-023', title: 'Empty filter state', subtitle: 'Search experience · No results', status: 'Passed', checks: '8 of 8 checks', duration: '00:58', cost: '$0.01', time: 'Today, 09:51', model: 'Pine 3', owner: 'Leo Park', initials: 'LP', note: 'The empty state gives a clear way back to all runs. Copy and focus order passed review.', passed: 8, failed: 0 },
  { id: 'RUN-022', title: 'Keyboard focus order', subtitle: 'Accessibility · Run details', status: 'Failed', checks: '4 of 8 checks', duration: '02:13', cost: '$0.04', time: 'Yesterday, 16:08', model: 'Mica 7B', owner: 'Nina Patel', initials: 'NP', note: 'Focus skips the details action after selecting a run. Revisit the order before shipping.', passed: 4, failed: 4 },
];

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    runs: <><path d="M4 5.5h16M4 12h16M4 18.5h16"/><circle cx="8" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    flask: <><path d="M9 3h6m-5 0v7l-5.6 8.2A2 2 0 0 0 6 21h12a2 2 0 0 0 1.6-2.8L14 10V3M7.5 16h9"/></>,
    sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--icon-fill, #fff)"/><circle cx="16" cy="17" r="2" fill="var(--icon-fill, #fff)"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Status({ value }) { return <span className={`status status-${value.toLowerCase().replace(' ', '-')}`}><span className="status-dot" />{value}</span>; }

function App() {
  const [filter, setFilter] = useState('All runs');
  const [selectedId, setSelectedId] = useState(runs[0].id);
  const [preview, setPreview] = useState('normal');
  const [inspect, setInspect] = useState(false);
  const visibleRuns = runs.filter(run => filter === 'All runs' || run.status === filter);
  const selected = runs.find(run => run.id === selectedId) || runs[0];
  function changeFilter(value) {
    setFilter(value); setPreview('normal'); setInspect(false);
    const first = runs.find(run => value === 'All runs' || run.status === value);
    if (first) setSelectedId(first.id);
  }
  function reset() { setFilter('All runs'); setPreview('normal'); setSelectedId(runs[0].id); setInspect(false); }
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>Runbook</span></div>
      <div className="workspace-switch"><span className="workspace-avatar">S</span><span className="workspace-name"><strong>Studio team</strong><small>Team workspace</small></span><Icon name="chevron" size={15}/></div>
      <nav aria-label="Main navigation">
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-link"><Icon name="grid"/>Overview</div>
        <div className="nav-link active"><Icon name="runs"/>Experiment runs <span className="nav-count">3</span></div>
        <div className="nav-link"><Icon name="flask"/>Experiments</div>
        <div className="nav-label nav-label-second">MANAGE</div>
        <div className="nav-link"><Icon name="sliders"/>Settings</div>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-bottom-icon"><Icon name="info" size={17}/></div><div><strong>Keep learning</strong><span>Review results, then decide what ships.</span></div></div>
      <div className="sidebar-profile"><span className="profile-avatar">MC</span><span><strong>Maya Chen</strong><small>Team member</small></span><span className="profile-ellipsis">···</span></div>
    </aside>
    <main className="main-content">
      <div className="topbar"><span className="breadcrumb">Workspace <Icon name="chevron" size={14}/> <strong>Experiment runs</strong></span><span className="topbar-right"><span className="live-dot"/> Team activity <span className="topbar-divider"/> Updated today</span></div>
      <div className="page-content">
        <header className="page-header"><div><div className="eyebrow">RUNBOOK / EXPERIMENTS</div><h1>Experiment runs</h1><p>Small tests. Clear results.</p></div><div className="header-meta"><span className="header-meta-label">CURRENT WORKSPACE</span><strong>Studio team</strong><span>3 recent runs</span></div></header>
        <section className="overview" aria-label="Run overview">
          <div className="overview-item"><div className="overview-icon overview-icon-all"><Icon name="runs" size={18}/></div><div><span className="overview-label">TOTAL RUNS</span><div className="overview-value">03 <span>in this workspace</span></div></div></div>
          <div className="overview-item"><div className="overview-icon overview-icon-review"><span className="mini-circle"/></div><div><span className="overview-label">NEEDS REVIEW</span><div className="overview-value">01 <span>waiting on a decision</span></div></div></div>
          <div className="overview-item"><div className="overview-icon overview-icon-passed"><Icon name="check" size={18}/></div><div><span className="overview-label">CHECKS PASSED</span><div className="overview-value">18<span className="overview-denom"> / 24</span> <span>across all runs</span></div></div></div>
        </section>
        <div className="section-heading"><div><h2>Recent runs <span className="heading-count">3</span></h2><p>Results from the latest experiments in this workspace.</p></div><label className="filter-label">Status <span className="select-wrap"><select aria-label="Status" value={filter} onChange={e => changeFilter(e.target.value)}><option>All runs</option><option>Needs review</option><option>Passed</option><option>Failed</option></select></span></label></div>
        <div className="workspace-grid">
          <section className="runs-panel" aria-label="Runs list">
            <div className="list-head"><span>EXPERIMENT / RUN</span><span>RESULT</span></div>
            {preview === 'loading' ? <div className="state-panel" role="status"><div className="loading-spinner"/><h3>Loading runs…</h3><p>Getting the latest results for your team.</p><button className="state-reset" onClick={reset}>Show normal state</button></div>
              : preview === 'error' ? <div className="state-panel" role="alert"><div className="state-symbol error-symbol">!</div><h3>Could not load experiment runs.</h3><p>Something went wrong while fetching results. Your runs are safe.</p><button className="state-reset" onClick={reset}>Show normal state</button></div>
              : preview === 'empty' || visibleRuns.length === 0 ? <div className="state-panel"><div className="state-symbol empty-symbol"><Icon name="runs" size={22}/></div><h3>No runs match this filter</h3><p>Try another status or clear the filter to see all runs.</p><button className="state-reset" onClick={reset}>Clear filter</button></div>
              : <div className="run-list">{visibleRuns.map(run => <button key={run.id} type="button" className={`run-row ${selected.id === run.id ? 'selected' : ''}`} aria-pressed={selected.id === run.id} onClick={() => {setSelectedId(run.id);setInspect(false);}}>
                <span className="run-leading"><span className="run-glyph"><Icon name="flask" size={18}/></span><span className="run-copy"><span className="run-title">{run.title}</span><span className="run-subtitle">{run.model} · {run.subtitle}</span><span className="run-bottom"><span>{run.id}</span><span className="dot-separator">·</span><span>{run.time}</span></span></span></span>
                <span className="run-result"><Status value={run.status}/><span className="run-checks">{run.checks}</span><span className="run-checks">{run.duration} · {run.cost}</span></span><span className="row-arrow"><Icon name="chevron" size={17}/></span>
              </button>)}</div>}
            <div className="list-footer"><span>Showing {preview === 'normal' ? visibleRuns.length : 0} of 3 runs</span><span>Latest first</span></div>
          </section>
          <section className="detail-panel" role="region" aria-label="Selected run">
            <div className="detail-topline"><span>SELECTED RUN</span><span>{selected.id}</span></div>
            <div className="detail-heading"><div className="detail-glyph"><Icon name="flask" size={20}/></div><div><h2>{selected.title}</h2><span>{selected.subtitle}</span></div></div>
            <div className="detail-status"><Status value={selected.status}/><span className="detail-status-checks">{selected.checks}</span></div>
            <div className="progress-track" role="progressbar" aria-label="Checks passed" aria-valuenow={selected.passed} aria-valuemin="0" aria-valuemax="8"><span style={{width: `${selected.passed / 8 * 100}%`}}/></div>
            <div className="detail-divider"/><div className="note-label">REVIEW NOTE</div><p className="review-note">{selected.note}</p><div className="detail-divider"/>
            <div className="detail-data"><div><span>MODEL</span><strong>{selected.model}</strong></div><div><span>DURATION</span><strong>{selected.duration}</strong></div><div><span>COST</span><strong>{selected.cost}</strong></div><div><span>RAN AT</span><strong>{selected.time}</strong></div></div>
            <div className="detail-action-wrap"><button className="inspect-button" type="button" onClick={() => setInspect(!inspect)} aria-expanded={inspect}>{inspect ? 'Hide checks' : 'Inspect run'} <Icon name="arrow" size={17}/></button><span className="detail-owner"><span className="owner-avatar">{selected.initials}</span>{selected.owner}</span></div>
            {inspect && <div className="inspection"><strong>Check summary</strong><p>{selected.passed} passed · {selected.failed} need attention</p><div className="inspection-bar"><span style={{width: `${selected.passed / 8 * 100}%`}}/></div></div>}
          </section>
        </div>
        <div className="preview-bar"><div className="preview-intro"><span className="preview-icon"><Icon name="sliders" size={16}/></span><div><strong>State previews</strong><span>Check how this list behaves.</span></div></div><div className="preview-actions"><button className={preview === 'normal' ? 'preview-active' : ''} onClick={reset}>Show normal state</button><button className={preview === 'empty' ? 'preview-active' : ''} onClick={() => setPreview('empty')}>Empty state preview</button><button className={preview === 'loading' ? 'preview-active' : ''} onClick={() => setPreview('loading')}>Loading preview</button><button className={preview === 'error' ? 'preview-active' : ''} onClick={() => setPreview('error')}>Error preview</button></div></div>
        <footer className="page-footer"><span>Runbook <span className="footer-separator">/</span> Studio team</span><span>Made for better decisions, one run at a time.</span></footer>
      </div>
    </main>
  </div>;
}
export default App;
