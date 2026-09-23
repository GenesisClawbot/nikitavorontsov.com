/**
 * Synthetic data for the Runbook review queue.
 *
 * A "run" is one short experiment against a UI pattern: eight automated checks,
 * a duration, a model cost and a reviewer note.
 */

export const STATUSES = {
  passed: { key: 'passed', label: 'Passed', tone: 'pass' },
  review: { key: 'review', label: 'Needs review', tone: 'review' },
  failed: { key: 'failed', label: 'Failed', tone: 'fail' },
};

export const CHECK_NAMES = [
  'Column math at 390px',
  'Column math at 768px',
  'Long title wrapping',
  'Label legibility',
  'Contrast on tinted rows',
  'Tap targets 44px',
  'Focus order',
  'Zoom to 200%',
];

export const RUNS = [
  {
    id: 'run-2418',
    code: 'RUN-2418',
    title: 'Mobile table wrap',
    branch: 'exp/table-wrap',
    status: 'review',
    model: 'Mica 7B',
    duration: '01:42',
    cost: '$0.03',
    costValue: 0.03,
    started: 'Today, 10:24',
    note: 'The last column moves below the table at 390px. Two labels are too small to read.',
    failed: ['Label legibility', 'Tap targets 44px'],
  },
  {
    id: 'run-2416',
    code: 'RUN-2416',
    title: 'Empty filter state',
    branch: 'exp/empty-filter',
    status: 'passed',
    model: 'Mica 7B',
    duration: '00:58',
    cost: '$0.01',
    costValue: 0.01,
    started: 'Today, 09:51',
    note: 'Holds up in every state we tried. Ready to fold into the shared table pattern.',
    failed: [],
  },
  {
    id: 'run-2409',
    code: 'RUN-2409',
    title: 'Keyboard focus order',
    branch: 'exp/focus-order',
    status: 'failed',
    model: 'Pine 3',
    duration: '02:13',
    cost: '$0.04',
    costValue: 0.04,
    started: 'Yesterday, 16:08',
    note: 'Tab skips the row actions in Firefox and the focus ring disappears on tinted rows.',
    failed: ['Focus order', 'Tap targets 44px', 'Zoom to 200%', 'Contrast on tinted rows'],
  },
];

export const FILTERS = [
  { value: 'all', label: 'All runs' },
  { value: 'passed', label: 'Passed' },
  { value: 'review', label: 'Needs review' },
  { value: 'failed', label: 'Failed' },
];

export const PREVIEWS = [
  { id: 'empty', label: 'Empty state preview' },
  { id: 'loading', label: 'Loading preview' },
  { id: 'error', label: 'Error preview' },
];

export function checksFor(run) {
  return CHECK_NAMES.map((name) => ({ name, passed: !run.failed.includes(name) }));
}

export function checkCount(run) {
  return { passed: CHECK_NAMES.length - run.failed.length, total: CHECK_NAMES.length };
}

export function checkSummary(run) {
  const { passed, total } = checkCount(run);
  return `${passed} of ${total} checks`;
}

export function spendFor(runs) {
  return `$${runs.reduce((sum, run) => sum + run.costValue, 0).toFixed(2)}`;
}

export function queueStats(runs = RUNS) {
  return [
    { label: 'Runs', value: String(runs.length) },
    { label: 'Passed', value: String(runs.filter((run) => run.status === 'passed').length) },
    { label: 'Needs attention', value: String(runs.filter((run) => run.status !== 'passed').length) },
    { label: 'Spend', value: spendFor(runs) },
  ];
}
