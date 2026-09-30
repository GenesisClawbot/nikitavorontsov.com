/* Small, deterministic rules shared by the scene and the local rule tests. */
(function (root) {
  'use strict';
  const geometry = Object.freeze({ width: 1120, height: 640, left: 280, right: 840, deckY: 334, bays: 5, axleHalf: 32, startX: 125, finishX: 978, speed: 103 });
  const materials = Object.freeze({
    wood: Object.freeze({ name: 'Timber', cost: 2, capacity: 3 }),
    iron: Object.freeze({ name: 'Iron', cost: 4, capacity: 8 }),
    brace: Object.freeze({ name: 'Triangle brace', cost: 1, capacity: 4 })
  });
  const contracts = Object.freeze([
    Object.freeze({ name: 'The pickle run', payload: 6, budget: 16, cargo: '6 tons of pickles. Glass jars. Bad idea.', type: 'pickles', hint: 'Triangles add 4t. Each deck should hold at least the 6t cart.', win: 'Six tons of pickles, safely delivered.', quip: 'The jars survived. The warranty did not.' }),
    Object.freeze({ name: 'Anvil express', payload: 8, budget: 21, cargo: '8 tons of anvils. Marked “fragile.”', type: 'anvils', hint: 'Braced timber holds 7t. Iron holds 8t. You have 21 bolts. Make them count.', win: 'Eight tons of anvils, without a splash.', quip: 'Finally, a delivery with some gravitas.' }),
    Object.freeze({ name: 'The mayor’s ego', payload: 11, budget: 26, cargo: '11 tons of gold-plated self-importance.', type: 'statue', hint: 'Iron holds 8t. Add a triangle for 12t. The mayor refuses to walk.', win: 'The mayor’s statue made it across.', quip: 'Three deliveries. Still not a licensed engineer.' })
  ]);
  const spanWidth = (geometry.right - geometry.left) / geometry.bays;
  function makeSpans() { return Array.from({ length: geometry.bays }, () => ({ deck: null, braced: false })); }
  function capacity(span) { return span && materials[span.deck] ? materials[span.deck].capacity + (span.braced ? materials.brace.capacity : 0) : 0; }
  function spent(spans) { return spans.reduce((sum, span) => sum + (materials[span.deck] ? materials[span.deck].cost + (span.braced ? materials.brace.cost : 0) : 0), 0); }
  function build(spans, index, tool, budget) {
    if (!Number.isInteger(index) || index < 0 || index >= spans.length) return { ok: false, reason: 'index' };
    const next = spans.map(span => ({ deck: span.deck, braced: span.braced }));
    const target = next[index];
    if (tool === 'wood' || tool === 'iron') target.deck = tool;
    else if (tool === 'brace') {
      if (!target.deck) return { ok: false, reason: 'needsDeck' };
      target.braced = !target.braced;
    } else if (tool === 'erase') { target.deck = null; target.braced = false; }
    else return { ok: false, reason: 'tool' };
    const cost = spent(next);
    if (cost > budget) return { ok: false, reason: 'budget', need: cost - budget };
    const changed = target.deck !== spans[index].deck || target.braced !== spans[index].braced;
    return { ok: true, changed, next, cost, left: budget - cost, delta: cost - spent(spans) };
  }
  function bayAt(x) {
    if (x < geometry.left || x >= geometry.right) return -1;
    return Math.min(geometry.bays - 1, Math.floor((x - geometry.left) / spanWidth));
  }
  function loadsAt(x, payload) {
    const loads = new Array(geometry.bays).fill(0);
    for (const wheel of [x - geometry.axleHalf, x + geometry.axleHalf]) {
      const index = bayAt(wheel);
      if (index !== -1) loads[index] += payload / 2;
    }
    return loads;
  }
  function damageStep(damage, load, limit, dt) {
    if (load <= limit + 0.001) return damage;
    if (limit <= 0) return 1;
    return Math.min(1, damage + dt * 3.5 * (0.7 + load / limit - 1));
  }
  function inspect(spans, payload) {
    const missing = [], weak = [];
    spans.forEach((span, index) => {
      if (!span.deck) missing.push(index);
      else if (capacity(span) < payload) weak.push(index);
    });
    return { missing, weak, ready: !missing.length && !weak.length, cost: spent(spans) };
  }
  root.BridgeRules = Object.freeze({ geometry, materials, contracts, spanWidth, makeSpans, capacity, spent, build, bayAt, loadsAt, damageStep, inspect });
})(globalThis);
