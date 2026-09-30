// Headless tuning harness: node tests/tune.js
const Sim = require('../physics.js');

function run(levelIdx, name, list, verbose) {
  const L = Sim.LEVELS[levelIdx];
  const d = Sim.buildDesign(L, list);
  const probs = Sim.validateDesign(L, d);
  const cost = Sim.designCost(d);
  const r = Sim.simulate(L, d, { after: 0.3 });
  const o = r.outcome || { success: false, reason: 'none' };
  let line = `L${L.id} ${name.padEnd(22)} cost ${String(cost).padStart(4)}/${L.budget}  ${o.success ? 'SUCCESS' : 'FAIL   '} ${o.reason.padEnd(9)} t=${(o.t || r.t).toFixed(1)} broken=${r.broken} peak=${r.peak.toFixed(2)}`;
  if (probs.length) line += '  INVALID: ' + probs.join('; ');
  console.log(line);
  if (verbose) {
    for (const k of r.world.bends) console.log('    weld at', k.B.id, k.broken ? 'BROKEN' : '', 'peak', k.peak.toFixed(2));
    for (const b of r.world.beams) {
      console.log('   ', b.mat.id, b.a.id, '->', b.b.id, b.broken ? 'BROKEN' : '', 'peak', b.peak.toFixed(2));
    }
  }
  return r;
}

module.exports = { run };

if (require.main === module) {
  const R = 'road', Wd = 'wood', I = 'iron', Rp = 'rope';
  // ---- Level 1 (8..14)
  const l1naive = [[R, 8, 0, 10, 0], [R, 10, 0, 12, 0], [R, 12, 0, 14, 0]];
  run(0, 'empty', []);
  run(0, 'naive', l1naive);
  run(0, 'naive 1m', [[R, 8, 0, 9, 0], [R, 9, 0, 10, 0], [R, 10, 0, 11, 0], [R, 11, 0, 12, 0], [R, 12, 0, 13, 0], [R, 13, 0, 14, 0]]);
  run(0, 'minimal', l1naive.concat([[Wd, 8, 2, 10, 0], [Wd, 14, 2, 12, 0]]));
  run(0, 'one side', l1naive.concat([[Wd, 8, 2, 10, 0]]));
  run(0, 'truss', l1naive.concat([[Wd, 8, 2, 10, 0], [Wd, 14, 2, 12, 0], [Wd, 10, 0, 11, 1], [Wd, 11, 1, 12, 0], [Wd, 8, 2, 10, 2], [Wd, 10, 2, 11, 1]]));
  run(0, 'arch', [[R, 8, 0, 10, 0], [R, 10, 0, 12, 0], [R, 12, 0, 14, 0], [Wd, 8, 2, 9, 1], [Wd, 9, 1, 10, 0], [Wd, 14, 2, 13, 1], [Wd, 13, 1, 12, 0], [Wd, 8, 0, 9, 1], [Wd, 14, 0, 13, 1]]);

  // ---- Level 2 (7..15, spire 11,3)
  const l2road = [[R, 7, 0, 9, 0], [R, 9, 0, 11, 0], [R, 11, 0, 13, 0], [R, 13, 0, 15, 0]];
  run(1, 'naive', l2road);
  run(1, 'wood only', l2road.concat([[Wd, 7, 2, 9, 0], [Wd, 15, 2, 13, 0], [Wd, 11, 3, 11, 0]]));
  run(1, 'wood fan', l2road.concat([[Wd, 7, 2, 9, 0], [Wd, 15, 2, 13, 0], [Wd, 11, 3, 11, 0], [Wd, 11, 3, 10, 1], [Wd, 10, 1, 9, 0], [Wd, 11, 3, 12, 1], [Wd, 12, 1, 13, 0], [Wd, 10, 1, 11, 0], [Wd, 12, 1, 11, 0]]));
  run(1, 'iron mix', l2road.concat([[Wd, 7, 2, 9, 0], [I, 11, 3, 9, 0], [I, 11, 3, 11, 0], [I, 11, 3, 13, 0], [Wd, 15, 2, 13, 0]]));
  run(1, 'iron struts', l2road.concat([[I, 7, 2, 9, 0], [I, 15, 2, 13, 0], [I, 11, 3, 11, 0]]));

  // ---- Level 3 (6..16, towers 5,-3 / 17,-3)
  const l3road = [[R, 6, 0, 8, 0], [R, 8, 0, 10, 0], [R, 10, 0, 12, 0], [R, 12, 0, 14, 0], [R, 14, 0, 16, 0]];
  run(2, 'naive', l3road);
  run(2, 'ropes 4', l3road.concat([[Rp, 5, -3, 8, 0], [Rp, 5, -3, 10, 0], [Rp, 17, -3, 12, 0], [Rp, 17, -3, 14, 0]]));
  run(2, 'ropes 2', l3road.concat([[Rp, 5, -3, 10, 0], [Rp, 17, -3, 12, 0]]));
  run(2, 'struts only', l3road.concat([[Wd, 6, 2, 8, 0], [Wd, 16, 2, 14, 0]]));
}
