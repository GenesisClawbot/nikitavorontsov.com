'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../bridge-model.js');

test('placement, swapping and reclaiming conserve the 12-bolt budget', () => {
  let d = Array(5).fill(null);
  assert.equal(M.remaining(d), 12);
  d = M.place(d, 2, 'wood'); assert.equal(M.remaining(d), 10);
  d = M.place(d, 2, 'iron'); assert.equal(M.remaining(d), 9);
  d = M.place(d, 2, 'iron'); assert.equal(M.remaining(d), 12);
  assert.equal(d[2], null);
  assert.equal(M.place(d, -1, 'wood'), null);
  assert.equal(M.place(d, 5, 'wood'), null);
  assert.equal(M.place(d, 2, 'magic'), null);
  d = ['iron', 'iron', 'iron', 'iron', null];
  assert.equal(M.place(d, 4, 'wood'), null);
  assert.equal(M.cost(d), 12);
  assert.equal(M.place(d, 0, 'wood')[0], 'wood');
});
test('bare planks fail visibly at the first bay', () => {
  const result = M.simulate(Array(5).fill(null));
  assert.equal(result.success, false); assert.equal(result.broken, 0);
  assert.ok(result.time > 1 && result.time < 2);
});
test('all-timber design buckles under the central load', () => {
  const result = M.simulate(Array(5).fill('wood'));
  assert.equal(result.success, false); assert.equal(result.broken, 2);
  assert.ok(result.time > 3 && result.time < 6);
});
test('a central iron truss delivers the whole cart under budget', () => {
  const design = ['wood', 'wood', 'iron', 'wood', 'wood'];
  assert.equal(M.cost(design), 11);
  const run = M.simulate(design);
  assert.equal(run.success, true); assert.equal(run.broken, -1);
  assert.equal(run.progress, 1); assert.equal(run.x, M.CART_FINISH);
  assert.ok(run.time > 8 && run.time < 10);
});
test('neighbors share capacity; a second successful strategy exists', () => {
  const d = ['wood', 'iron', 'wood', 'iron', 'wood'];
  assert.equal(M.capacity(d, 2), 6);
  assert.ok(Math.abs(M.capacity(Array(5).fill('wood'), 2) - 4.8) < .00001);
  const run = M.simulate(d);
  assert.equal(run.success, true);
  assert.ok(run.damage[2] > 0 && run.damage[2] < 1, 'brief overload flexes without instantly snapping');
});
test('spending every bolt in the wrong places does not guarantee success', () => {
  const d = ['iron', 'wood', 'wood', 'wood', 'iron'];
  assert.equal(M.cost(d), 12); assert.equal(M.simulate(d).broken, 2);
});
test('all affordable designs have finite deterministic outcomes and six valid solutions', () => {
  let solutions = 0, minimum = Infinity;
  for (let mask = 0; mask < 243; mask++) {
    let n = mask; const d = [];
    for (let i = 0; i < 5; i++) { d.push([null, 'wood', 'iron'][n % 3]); n = Math.floor(n / 3); }
    if (M.cost(d) > M.BUDGET) continue;
    const a = M.simulate(d), b = M.simulate(d);
    assert.deepEqual(a, b); assert.ok(a.done && Number.isFinite(a.x));
    assert.ok(a.time < 10); assert.ok(a.peaks.every(Number.isFinite));
    if (a.success) { solutions++; minimum = Math.min(minimum, M.cost(d)); }
  }
  assert.equal(solutions, 6); assert.equal(minimum, 11);
});
test('frame subdivision preserves outcomes and runs snapshot the design', () => {
  for (const d of [Array(5).fill('wood'), ['wood', 'wood', 'iron', 'wood', 'wood'], ['wood', 'iron', 'wood', 'iron', 'wood']]) {
    const fast = M.simulate(d, 1 / 60), slow = M.simulate(d, 1 / 240);
    assert.equal(fast.success, slow.success); assert.equal(fast.broken, slow.broken);
  }
  const d = Array(5).fill('wood'), r = M.createRun(d); d[2] = 'iron';
  assert.equal(r.design[2], 'wood');
});
