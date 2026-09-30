// Physics balance regression tests (no dependencies): node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const Sim = require('../physics.js');

const R = 'road', Wd = 'wood', I = 'iron', Rp = 'rope';
function outcome(li, list) {
  const L = Sim.LEVELS[li];
  const d = Sim.buildDesign(L, list);
  return { r: Sim.simulate(L, d, { after: 0.2 }), cost: Sim.designCost(d), problems: Sim.validateDesign(L, d), L };
}
const deck = (a, b, step) => { const l = []; for (let x = a; x < b; x += step) l.push([R, x, 0, x + step, 0]); return l; };

test('napkin sketches are legal, affordable and succeed', () => {
  Sim.LEVELS.forEach((L, li) => {
    const { r, cost, problems } = outcome(li, L.napkin);
    assert.deepStrictEqual(problems, [], L.name + ' napkin legal');
    assert.ok(cost <= L.budget, L.name + ' napkin affordable');
    assert.ok(r.outcome && r.outcome.success, L.name + ' napkin succeeds');
  });
});

test('no bridge and naive plank-only decks fail', () => {
  assert.strictEqual(outcome(0, []).r.outcome.reason, 'noroad');
  for (let li = 0; li < 3; li++) {
    const L = Sim.LEVELS[li];
    const res = outcome(li, deck(L.left, L.right, 2));
    assert.strictEqual(res.r.outcome.success, false, L.name + ' naive deck fails');
  }
});

test('construction choices matter: wood vs iron on the heavy level', () => {
  const d2 = deck(7, 15, 2);
  const wood = outcome(1, d2.concat([[Wd, 7, 2, 9, 0], [Wd, 15, 2, 13, 0], [Wd, 11, 3, 11, 0]]));
  const iron = outcome(1, d2.concat([[I, 7, 2, 9, 0], [I, 15, 2, 13, 0], [I, 11, 3, 11, 0]]));
  assert.strictEqual(wood.r.outcome.success, false, 'wood struts break under anvils');
  assert.strictEqual(iron.r.outcome.success, true, 'iron struts hold the anvils');
});

test('1 m plank decks with sensible support pass level 1 (road joints resist bending)', () => {
  const res = outcome(0, deck(8, 14, 1).concat([[Wd, 8, 2, 9, 0], [Wd, 8, 2, 10, 0], [Wd, 14, 2, 13, 0], [Wd, 14, 2, 12, 0]]));
  assert.strictEqual(res.r.outcome.success, true);
});

test('level 3 needs ropes; two ropes are not enough, a fully roped 1 m deck is', () => {
  const d3 = deck(6, 16, 2);
  assert.strictEqual(outcome(2, d3.concat([[Rp, 5, -4, 10, 0], [Rp, 17, -4, 12, 0]])).r.outcome.success, false);
  const ropes = [[Rp, 5, -4, 7, 0], [Rp, 5, -4, 8, 0], [Rp, 5, -4, 9, 0], [Rp, 5, -4, 10, 0], [Rp, 5, -4, 11, 0],
    [Rp, 17, -4, 12, 0], [Rp, 17, -4, 13, 0], [Rp, 17, -4, 14, 0], [Rp, 17, -4, 15, 0]];
  const full = outcome(2, deck(6, 16, 1).concat(ropes));
  assert.ok(full.cost <= full.L.budget, 'fully roped deck is affordable');
  assert.strictEqual(full.r.outcome.success, true);
});

test('beam legality rules', () => {
  const L = Sim.LEVELS[0];
  assert.strictEqual(Sim.checkBeam(L, 8, 0, 11, -1, 'road'), 'toolong');
  assert.strictEqual(Sim.checkBeam(L, 8, 2, 7, 3, 'wood'), 'rock');
  assert.strictEqual(Sim.checkBeam(L, 8, 2, 10, 0, 'wood'), null);
  assert.strictEqual(Sim.checkBeam(L, 8, 0, 10, 0, 'road'), null);
});

test('simulation is deterministic and finite', () => {
  const L = Sim.LEVELS[1];
  const d = Sim.buildDesign(L, L.napkin);
  const a = Sim.simulate(L, d), b = Sim.simulate(L, d);
  assert.strictEqual(a.t, b.t);
  assert.strictEqual(a.peak, b.peak);
  for (const n of a.world.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
});
