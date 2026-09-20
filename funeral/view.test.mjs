import test from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./view.mjs').catch(() => ({}));
const {
  announceStatus,
  fieldForError,
  showFormError,
  showReceipt,
} = implementation;

function trackedClassList(initial = []) {
  const names = new Set(initial);
  return {
    contains: (name) => names.has(name),
    toggle(name, force) {
      if (force) names.add(name);
      else names.delete(name);
    },
  };
}

test('re-announces the same status message', () => {
  const element = { textContent: 'Receipt copied.' };
  const scheduled = [];

  announceStatus?.(element, 'Receipt copied.', (work) => scheduled.push(work));

  assert.equal(element.textContent, '');
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.equal(element.textContent, 'Receipt copied.');
});

test('maps take-home pay errors to the optional pay field', () => {
  const fields = {
    monthlyPrice: { id: 'monthly' },
    monthsPaid: { id: 'months' },
    usefulSessions: { id: 'sessions' },
    hourlyTakeHome: { id: 'hourly' },
    currency: { id: 'currency' },
  };

  assert.equal(
    fieldForError?.('Take-home pay per hour must be more than zero.', fields),
    fields.hourlyTakeHome,
  );
  assert.equal(
    fieldForError?.('Entered amounts produce work time that is too large.', fields),
    fields.hourlyTakeHome,
  );
  assert.equal(fieldForError?.('Choose GBP, USD, or EUR.', fields), fields.currency);
});

test('hides a stale receipt and focuses the invalid field', () => {
  const focused = [];
  const elements = {
    section: { hidden: false },
    error: {},
    status: {},
    field: { focus: () => focused.push('field') },
  };

  showFormError?.('Monthly price is invalid.', elements, (work) => work());

  assert.equal(elements.section.hidden, true);
  assert.equal(elements.error.textContent, 'Monthly price is invalid.');
  assert.equal(elements.status.textContent, 'Could not complete autopsy. Monthly price is invalid.');
  assert.deepEqual(focused, ['field']);
});

test('renders every receipt value and focuses the result heading', () => {
  const focused = [];
  const elements = {
    section: { hidden: true },
    heading: { focus: () => focused.push('heading') },
    service: {},
    monthly: {},
    months: {},
    usefulSessions: {},
    total: {},
    workTimeRows: { hidden: false },
    workPerMonth: {},
    workPerUsefulSession: {},
    each: { classList: trackedClassList(['big-cost-long']) },
    finding: {},
    status: {},
  };

  showReceipt?.({
    service: 'My coding tool',
    monthly: '£20.00',
    months: '3',
    usefulSessions: '4',
    total: '£60.00',
    workPerMonth: null,
    workPerUsefulSession: null,
    each: '£15.00',
    finding: 'The corpse can explain itself.',
  }, elements, (work) => work());

  assert.equal(elements.section.hidden, false);
  assert.equal(elements.service.textContent, 'My coding tool');
  assert.equal(elements.monthly.textContent, '£20.00');
  assert.equal(elements.months.textContent, '3');
  assert.equal(elements.usefulSessions.textContent, '4');
  assert.equal(elements.total.textContent, '£60.00');
  assert.equal(elements.workTimeRows.hidden, true);
  assert.equal(elements.each.textContent, '£15.00');
  assert.equal(elements.each.classList.contains('big-cost-long'), false);
  assert.equal(elements.finding.textContent, 'The corpse can explain itself.');
  assert.equal(elements.status.textContent, 'Autopsy complete. The receipt is ready.');
  assert.deepEqual(focused, ['heading']);
});

test('labels work time per useful session as unmeasurable at zero sessions', () => {
  const elements = {
    section: { hidden: true },
    heading: { focus: () => {} },
    service: {},
    monthly: {},
    months: {},
    usefulSessions: {},
    total: {},
    workTimeRows: { hidden: true },
    workPerMonth: {},
    workPerUsefulSession: {},
    each: { classList: trackedClassList() },
    finding: {},
    status: {},
  };

  showReceipt?.({
    service: 'My coding tool',
    monthly: '£20.00',
    months: '3',
    usefulSessions: '0',
    total: '£60.00',
    workPerMonth: '1h 20m',
    workPerUsefulSession: null,
    each: 'Not measurable',
    finding: 'Division by zero has entered the chat.',
  }, elements, (work) => work());

  assert.equal(elements.workTimeRows.hidden, false);
  assert.equal(elements.workPerUsefulSession.textContent, 'Not measurable');
  assert.equal(elements.each.classList.contains('big-cost-long'), true);
});

test('reveals work-time rows when the receipt has affordability data', () => {
  const elements = {
    section: { hidden: true },
    heading: { focus: () => {} },
    service: {},
    monthly: {},
    months: {},
    usefulSessions: {},
    total: {},
    workTimeRows: { hidden: true },
    workPerMonth: {},
    workPerUsefulSession: {},
    each: {},
    finding: {},
    status: {},
  };

  showReceipt?.({
    service: 'My coding tool',
    monthly: '£20.00',
    months: '3',
    usefulSessions: '4',
    total: '£60.00',
    workPerMonth: '1h 20m',
    workPerUsefulSession: '1h',
    each: '£15.00',
    finding: 'The corpse can explain itself.',
  }, elements, (work) => work());

  assert.equal(elements.workTimeRows.hidden, false);
  assert.equal(elements.workPerMonth.textContent, '1h 20m');
  assert.equal(elements.workPerUsefulSession.textContent, '1h');
});
