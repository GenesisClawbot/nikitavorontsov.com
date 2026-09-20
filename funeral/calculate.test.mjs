import test from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./calculate.mjs').catch(() => ({}));
const {
  calculateAutopsy,
  formatMoney,
  formatWorkTime,
  receiptData,
  shareText,
} = implementation;

test('calculates total spend and per-session cost in minor units', () => {
  const result = calculateAutopsy?.({
    service: '  Claude Max  ',
    monthlyPrice: '19.99',
    monthsPaid: '3',
    usefulSessions: '4',
    currency: 'GBP',
  });

  assert.deepEqual(result, {
    service: 'Claude Max',
    monthlyMinor: 1999,
    monthsPaid: 3,
    usefulSessions: 4,
    currency: 'GBP',
    totalMinor: 5997,
    costPerUsefulSessionMinor: 1499,
    hourlyTakeHomeMinor: null,
    workMinutesPerMonth: null,
    workMinutesPerUsefulSession: null,
  });
});

test('turns optional hourly take-home pay into work time', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '4',
    hourlyTakeHome: '15',
    currency: 'GBP',
  });

  assert.equal(result.hourlyTakeHomeMinor, 1500);
  assert.equal(result.workMinutesPerMonth, 80);
  assert.equal(result.workMinutesPerUsefulSession, 60);
});

test('keeps zero useful sessions finite', () => {
  const result = calculateAutopsy?.({
    service: '',
    monthlyPrice: '20',
    monthsPaid: '2',
    usefulSessions: '0',
    currency: 'USD',
  });

  assert.equal(result.service, 'Unnamed subscription');
  assert.equal(result.totalMinor, 4000);
  assert.equal(result.costPerUsefulSessionMinor, null);
});

test('rejects malformed or impossible inputs', () => {
  const cases = [
    [{ monthlyPrice: '0', monthsPaid: '1', usefulSessions: '1', currency: 'GBP' }, 'Monthly price must be more than zero.'],
    [{ monthlyPrice: '3.999', monthsPaid: '1', usefulSessions: '1', currency: 'GBP' }, 'Monthly price must use no more than two decimal places.'],
    [{ monthlyPrice: '10', monthsPaid: '1.5', usefulSessions: '1', currency: 'GBP' }, 'Months paid must be a whole number of at least one.'],
    [{ monthlyPrice: '10', monthsPaid: '1', usefulSessions: '-1', currency: 'GBP' }, 'Useful sessions must be a whole number of zero or more.'],
    [{ monthlyPrice: '10', monthsPaid: '1', usefulSessions: '1', hourlyTakeHome: '0', currency: 'GBP' }, 'Take-home pay per hour must be more than zero.'],
    [{ monthlyPrice: '10', monthsPaid: '1', usefulSessions: '1', hourlyTakeHome: '3.999', currency: 'GBP' }, 'Take-home pay per hour must use no more than two decimal places.'],
    [{ monthlyPrice: '10', monthsPaid: '1', usefulSessions: '1', currency: 'JPY' }, 'Choose GBP, USD, or EUR.'],
  ];

  for (const [input, message] of cases) {
    assert.throws(() => calculateAutopsy?.(input), { message });
  }
});

test('rejects amounts outside exact minor-unit arithmetic', () => {
  assert.throws(
    () => calculateAutopsy?.({
      monthlyPrice: '90071992547409.92',
      monthsPaid: '1',
      usefulSessions: '1',
      currency: 'GBP',
    }),
    { message: 'Monthly price is too large.' },
  );

  assert.throws(
    () => calculateAutopsy?.({
      monthlyPrice: '90071992547409.91',
      monthsPaid: '2',
      usefulSessions: '1',
      currency: 'GBP',
    }),
    { message: 'Months paid produces a total that is too large.' },
  );
});

test('rejects work durations outside safe integer arithmetic', () => {
  assert.throws(
    () => calculateAutopsy?.({
      monthlyPrice: '90071992547409.91',
      monthsPaid: '1',
      usefulSessions: '1',
      hourlyTakeHome: '0.01',
      currency: 'GBP',
    }),
    { message: 'Entered amounts produce work time that is too large.' },
  );
});

test('formats supported currencies with two decimal places', () => {
  assert.equal(formatMoney?.(1299, 'GBP'), '£12.99');
  assert.equal(formatMoney?.(1299, 'USD'), '$12.99');
  assert.equal(formatMoney?.(1299, 'EUR'), '€12.99');
});

test('formats rounded work time without inventing precision', () => {
  assert.equal(formatWorkTime?.(0), 'Less than 1 min');
  assert.equal(formatWorkTime?.(1), '1 min');
  assert.equal(formatWorkTime?.(59), '59 min');
  assert.equal(formatWorkTime?.(60), '1h');
  assert.equal(formatWorkTime?.(61), '1h 1m');
  assert.equal(formatWorkTime?.(120), '2h');
});

test('formats receipt fields for the visible result', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '4',
    currency: 'GBP',
  });

  assert.deepEqual(receiptData?.(result), {
    service: 'My coding tool',
    monthly: '£20.00',
    months: '3',
    usefulSessions: '4',
    total: '£60.00',
    each: '£15.00',
    workPerMonth: null,
    workPerUsefulSession: null,
    finding: 'The corpse can explain itself.',
  });
});

test('formats work time for the visible receipt', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '4',
    hourlyTakeHome: '15',
    currency: 'GBP',
  });

  assert.equal(receiptData?.(result).workPerMonth, '1h 20m');
  assert.equal(receiptData?.(result).workPerUsefulSession, '1h');
});

test('uses a finite receipt message for zero useful sessions', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '0',
    currency: 'GBP',
  });

  assert.equal(receiptData?.(result).each, 'Not measurable');
  assert.equal(receiptData?.(result).finding, 'Division by zero has entered the chat.');
});

test('writes a factual share line from the entered numbers', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '4',
    currency: 'GBP',
  });

  assert.equal(
    shareText?.(result, 'https://jamiecole.page/funeral/'),
    'Subscription autopsy: I paid £60.00 for 4 useful sessions with My coding tool. That is £15.00 each. The corpse can explain itself. https://jamiecole.page/funeral/',
  );
});

test('shares work time without sharing the entered hourly pay', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '4',
    hourlyTakeHome: '15',
    currency: 'GBP',
  });

  const text = shareText?.(result, 'https://jamiecole.page/funeral/');
  assert.equal(
    text,
    'Subscription autopsy: I traded 1h of take-home pay for each of 4 useful sessions with My coding tool. The corpse can explain itself. https://jamiecole.page/funeral/',
  );
  assert.doesNotMatch(text, /£15\.00|per hour/);
});

test('shares monthly work time when useful sessions are zero', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '0',
    hourlyTakeHome: '15',
    currency: 'GBP',
  });

  assert.equal(
    shareText?.(result, 'https://jamiecole.page/funeral/'),
    'Subscription autopsy: I traded 1h 20m of take-home pay each month and counted 0 useful sessions with My coding tool. Division by zero has entered the chat. https://jamiecole.page/funeral/',
  );
});

test('does not divide by zero in shared copy', () => {
  const result = calculateAutopsy?.({
    service: 'My coding tool',
    monthlyPrice: '20',
    monthsPaid: '3',
    usefulSessions: '0',
    currency: 'GBP',
  });

  assert.equal(
    shareText?.(result, 'https://jamiecole.page/funeral/'),
    'Subscription autopsy: I paid £60.00 and counted 0 useful sessions with My coding tool. Division by zero has entered the chat. https://jamiecole.page/funeral/',
  );
});
