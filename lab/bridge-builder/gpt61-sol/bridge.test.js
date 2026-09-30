'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = {};
vm.runInNewContext(fs.readFileSync('bridge-core.js', 'utf8'), sandbox);
const R = sandbox.BridgeRules;
function full(deck, braced = false) { return R.makeSpans().map(() => ({ deck, braced })); }
function cross(spans, payload) {
  const damage = Array(5).fill(0), dt = 1 / 120;
  for (let x = R.geometry.startX; x <= R.geometry.finishX; x += R.geometry.speed * dt) {
    const loads = R.loadsAt(x, payload);
    for (let i = 0; i < 5; i++) {
      if (loads[i] && !spans[i].deck) return { success: false, kind: 'gap', index: i };
      damage[i] = R.damageStep(damage[i], loads[i], R.capacity(spans[i]), dt);
      if (damage[i] >= 1) return { success: false, kind: 'capacity', index: i };
    }
  }
  return { success: true };
}
test('timber, iron, and triangles have the displayed capacities', () => {
  assert.equal(R.capacity({ deck: null, braced: false }), 0);
  assert.equal(R.capacity({ deck: 'wood', braced: false }), 3);
  assert.equal(R.capacity({ deck: 'wood', braced: true }), 7);
  assert.equal(R.capacity({ deck: 'iron', braced: false }), 8);
  assert.equal(R.capacity({ deck: 'iron', braced: true }), 12);
});
test('a build is transactional, and braces require a deck', () => {
  const spans = R.makeSpans();
  assert.equal(R.build(spans, 0, 'brace', 16).reason, 'needsDeck');
  assert.equal(R.spent(spans), 0);
  const result = R.build(spans, 0, 'wood', 16);
  assert.equal(result.ok, true); assert.equal(result.left, 14);
  assert.equal(spans[0].deck, null); assert.equal(result.next[0].deck, 'wood');
});
test('the budget cannot go negative', () => {
  let spans = R.makeSpans();
  for (let i = 0; i < 4; i++) spans = R.build(spans, i, 'iron', 16).next;
  assert.equal(R.spent(spans), 16);
  const rejected = R.build(spans, 4, 'iron', 16);
  assert.equal(rejected.ok, false); assert.equal(rejected.need, 4);
  assert.equal(spans[4].deck, null);
});
test('replacements, brace toggles, and erasing refund the correct amount', () => {
  let spans = R.build(R.makeSpans(), 0, 'wood', 16).next;
  spans = R.build(spans, 0, 'brace', 16).next;
  const upgrade = R.build(spans, 0, 'iron', 16);
  assert.equal(upgrade.delta, 2); assert.equal(R.capacity(upgrade.next[0]), 12);
  const downgrade = R.build(upgrade.next, 0, 'wood', 16);
  assert.equal(downgrade.delta, -2); assert.equal(downgrade.next[0].braced, true);
  const noBrace = R.build(downgrade.next, 0, 'brace', 16);
  assert.equal(noBrace.delta, -1); assert.equal(R.capacity(noBrace.next[0]), 3);
  const erased = R.build(upgrade.next, 0, 'erase', 16);
  assert.equal(erased.delta, -5); assert.equal(erased.left, 16);
  assert.equal(erased.next[0].braced, false);
});
test('clicking the installed deck twice spends nothing extra', () => {
  const spans = R.build(R.makeSpans(), 0, 'wood', 16).next;
  const same = R.build(spans, 0, 'wood', 16);
  assert.equal(same.ok, true); assert.equal(same.changed, false); assert.equal(same.delta, 0);
});
test('loads follow the two wheels and are conserved on the bridge', () => {
  assert.equal(R.loadsAt(R.geometry.left + 56, 6)[0], 6);
  const straddled = R.loadsAt(R.geometry.left + R.spanWidth, 6);
  assert.equal(straddled[0], 3); assert.equal(straddled[1], 3);
  assert.equal(straddled.reduce((a, b) => a + b, 0), 6);
  assert.equal(R.bayAt(R.geometry.right), -1);
});
test('construction changes the visible crossing outcome', () => {
  assert.equal(cross(full('wood'), 6).kind, 'capacity');
  assert.equal(cross(full('wood', true), 6).success, true);
  assert.equal(cross(full('iron'), 6).success, true);
  const gap = full('wood', true); gap[3] = { deck: null, braced: false };
  assert.equal(cross(gap, 6).kind, 'gap'); assert.equal(cross(gap, 6).index, 3);
});
test('all three deliveries are winnable within their bolt budgets', () => {
  const designs = [full('wood', true), full('iron'), full('iron', true)];
  R.contracts.forEach((job, index) => {
    assert.ok(R.spent(designs[index]) <= job.budget);
    assert.equal(R.inspect(designs[index], job.payload).ready, true);
    assert.equal(cross(designs[index], job.payload).success, true);
  });
});
test('the heavier jobs actually need stronger construction', () => {
  assert.equal(cross(full('wood', true), 8).kind, 'capacity');
  assert.equal(cross(full('iron'), 11).kind, 'capacity');
  assert.equal(cross(full('iron', true), 11).success, true);
});
test('invalid tool or span cannot alter the blueprint', () => {
  const spans = R.makeSpans();
  assert.equal(R.build(spans, -1, 'wood', 16).ok, false);
  assert.equal(R.build(spans, 5, 'wood', 16).ok, false);
  assert.equal(R.build(spans, 0, 'magic', 16).ok, false);
  assert.equal(R.spent(spans), 0);
});
