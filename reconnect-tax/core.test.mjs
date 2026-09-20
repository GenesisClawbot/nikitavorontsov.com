import test from 'node:test';
import assert from 'node:assert/strict';

test('counts reconnect notices from a pasted terminal log', async () => {
  const module = await import('./core.mjs').catch(() => ({}));
  assert.equal(typeof module.parseReconnectLog, 'function');

  const result = module.parseReconnectLog([
    'RECONNECTING 1/5',
    'RECONNECTING 2/5',
    'RECONNECTING 3/5',
  ].join('\n'));

  assert.equal(result.noticeCount, 3);
});

test('extracts each observed attempt label without inventing progress', async () => {
  const { parseReconnectLog } = await import('./core.mjs');

  const result = parseReconnectLog([
    '[transport] reconnecting 1 / 5',
    'noise between notices',
    'RECONNECTING 4/5',
  ].join('\n'));

  assert.deepEqual(result.notices, [
    { attempt: '1', limit: '5', label: '1/5' },
    { attempt: '4', limit: '5', label: '4/5' },
  ]);
});

test('preserves padded and oversized attempt labels exactly', async () => {
  const { parseReconnectLog } = await import('./core.mjs');

  const result = parseReconnectLog([
    'RECONNECTING 001/005',
    'RECONNECTING 9007199254740993/9007199254740995',
  ].join('\n'));

  assert.deepEqual(result.notices, [
    { attempt: '001', limit: '005', label: '001/005' },
    {
      attempt: '9007199254740993',
      limit: '9007199254740995',
      label: '9007199254740993/9007199254740995',
    },
  ]);
});

test('rejects logs without a reconnect notice', async () => {
  const { parseReconnectLog } = await import('./core.mjs');

  assert.throws(
    () => parseReconnectLog('Task finished normally.'),
    /No reconnect notices found/,
  );
});

test('does not join reconnect labels across lines', async () => {
  const { parseReconnectLog } = await import('./core.mjs');

  assert.throws(
    () => parseReconnectLog('RECONNECTING\n1/5 files restored'),
    /No reconnect notices found/,
  );
});

test('formats a receipt that separates observed notices from unknown cost', async () => {
  const { formatReceipt, parseReconnectLog } = await import('./core.mjs');
  const summary = parseReconnectLog([
    'RECONNECTING 1/5',
    'RECONNECTING 2/5',
  ].join('\n'));

  assert.equal(formatReceipt(summary), [
    'RECONNECT TAX',
    'TERMINAL INCIDENT RECEIPT',
    '',
    'ITEMIZED RETRIES',
    '01  RECONNECTING 1/5',
    '02  RECONNECTING 2/5',
    '',
    'TOTAL MATCHING NOTICES  2',
    '',
    'FINANCIAL IMPACT',
    'Unknown. This log cannot show whether any retry was billed.',
    '',
    'Counted only RECONNECTING n/n markers in the text you pasted.',
  ].join('\n'));
});
