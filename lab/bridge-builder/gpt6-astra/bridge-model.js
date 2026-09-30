/* Small, deterministic load model. No randomness decides a crossing. */
(function (root) {
  'use strict';
  const BAYS = 5;
  const BUDGET = 12;
  const START = 270;
  const SPAN = 102;
  const END = START + BAYS * SPAN;
  const SPEED = 91;
  const CART_START = 137;
  const CART_FINISH = 892;
  const MATERIALS = Object.freeze({
    wood: Object.freeze({ name: 'Timber', cost: 2, strength: 4.0, shared: 0.4 }),
    iron: Object.freeze({ name: 'Scrap iron', cost: 3, strength: 6.8, shared: 1.0 })
  });
  const PEAK_LOADS = [3.2, 5.2, 6.4, 5.2, 3.2];
  const wheelOffsets = [-32, 32];
  const wheelWeights = [0.46, 0.54];
  const maxInfluence = 0.54 + 0.46 * (1 - 64 / SPAN);

  function cost(design) {
    return design.reduce((sum, material) => sum + (MATERIALS[material]?.cost || 0), 0);
  }
  function remaining(design) { return BUDGET - cost(design); }
  function place(design, index, material) {
    if (!Number.isInteger(index) || index < 0 || index >= BAYS) return null;
    if (material !== null && !MATERIALS[material]) return null;
    const next = design.slice();
    next[index] = next[index] === material ? null : material;
    return cost(next) <= BUDGET ? next : null;
  }
  function capacity(design, index) {
    let value = MATERIALS[design[index]]?.strength || 0.8;
    for (const neighbor of [index - 1, index + 1]) {
      if (neighbor >= 0 && neighbor < BAYS) value += MATERIALS[design[neighbor]]?.shared || 0;
    }
    return value;
  }
  function loadAt(x, index) {
    const center = START + SPAN * (index + 0.5);
    let influence = 0;
    for (let i = 0; i < 2; i++) {
      const wheelX = x + wheelOffsets[i];
      if (wheelX >= START - 8 && wheelX <= END + 8) {
        influence += Math.max(0, 1 - Math.abs(wheelX - center) / SPAN) * wheelWeights[i];
      }
    }
    return 0.22 + PEAK_LOADS[index] * influence / maxInfluence;
  }
  function createRun(design) {
    return {
      design: design.slice(), x: CART_START, time: 0, progress: 0,
      ratios: Array(BAYS).fill(0), damage: Array(BAYS).fill(0),
      peaks: Array(BAYS).fill(0), capacities: design.map((_, i) => capacity(design, i)),
      broken: -1, done: false, success: false
    };
  }
  function step(run, dt) {
    if (run.done || dt <= 0) return run;
    run.time += dt;
    const ramp = Math.min(1, run.time / 0.6);
    run.x += SPEED * ramp * dt;
    run.progress = Math.max(0, Math.min(1, (run.x - CART_START) / (CART_FINISH - CART_START)));
    for (let i = 0; i < BAYS; i++) {
      const ratio = loadAt(run.x, i) / run.capacities[i];
      run.ratios[i] = ratio;
      run.peaks[i] = Math.max(run.peaks[i], ratio);
      // Brief flex is survivable. Sustained overload causes a break.
      run.damage[i] += Math.max(0, ratio - 1) * dt * 8.5;
      if (run.damage[i] >= 1 && run.broken === -1) run.broken = i;
    }
    if (run.broken !== -1) run.done = true;
    if (run.x >= CART_FINISH && run.broken === -1) {
      run.x = CART_FINISH;
      run.progress = 1;
      run.done = true;
      run.success = true;
    }
    return run;
  }
  function simulate(design, dt) {
    const run = createRun(design);
    let guard = 0;
    while (!run.done && guard++ < 10000) step(run, dt || 1 / 120);
    return run;
  }
  const api = { BAYS, BUDGET, START, SPAN, END, SPEED, CART_START, CART_FINISH,
    MATERIALS, cost, remaining, place, capacity, loadAt, createRun, step, simulate };
  root.BridgeModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
