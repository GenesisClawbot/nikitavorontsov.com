import test from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./share.mjs').catch(() => ({}));
const { deliverShare } = implementation;

test('uses Web Share when it is available', async () => {
  const calls = [];
  const navigatorLike = {
    share: async (payload) => calls.push(['share', payload]),
    clipboard: { writeText: async (text) => calls.push(['copy', text]) },
  };

  const result = await deliverShare?.('receipt text', navigatorLike);

  assert.equal(result, 'shared');
  assert.deepEqual(calls, [[
    'share',
    { title: 'Subscription Autopsy', text: 'receipt text' },
  ]]);
});

test('copies the receipt when Web Share is unavailable', async () => {
  const calls = [];
  const navigatorLike = {
    clipboard: { writeText: async (text) => calls.push(text) },
  };

  const result = await deliverShare?.('receipt text', navigatorLike);

  assert.equal(result, 'copied');
  assert.deepEqual(calls, ['receipt text']);
});

test('reports browsers that cannot share or copy', async () => {
  await assert.rejects(
    () => deliverShare?.('receipt text', {}),
    { message: 'This browser cannot share or copy the receipt.' },
  );
});
