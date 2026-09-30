/* Grubnik's Bridge of Questionable Integrity - physics core + level data.
   Plain script (no modules). In the browser it defines window.BridgeSim.
   Under Node (for headless tests) it is also exported via module.exports.

   Units: metres, kilograms, seconds, newtons. y axis points DOWN (screen style).
   Solver: XPBD with many small substeps (one constraint iteration each).
   Beams are distance constraints with compliance; the constraint multiplier
   gives a physical force estimate which is compared to material strength. */
(function (root) {
  'use strict';

  const GRAVITY = 9.8;
  const SUBSTEPS = 24;
  const JOINT_MASS = 3;        // kg added to every free joint
  const AIR_DAMP = 0.35;       // 1/s global velocity damping
  const BEAM_DAMP = 60;        // 1/s axial damping of beams
  const STRESS_TAU = 0.03;     // s smoothing before a beam breaks
  const CART_SPEED = 3.0;      // m/s cruise speed of the cart
  const TRACTION = 10;         // m/s^2 max wheel acceleration
  const START_DELAY = 0.8;     // s: bridge settles before cart rolls
  const MAX_TIME = 30;         // s: hard limit for a test run
  const GOO_DAMP = 5;          // drag inside the snot river
  const GOO_LIFT = 6.5;        // buoyancy (m/s^2) inside the river

  const MATERIALS = {
    road: { id: 'road', name: 'Plank', key: '1', cost: 10, maxLen: 2.25, mass: 10, strength: 5200, strain: 0.03, road: true, rope: false, bendMax: 1300, bendK: 11000,
      blurb: 'Road deck. The ONLY thing the cart can drive on.' },
    wood: { id: 'wood', name: 'Wood Beam', key: '2', cost: 6, maxLen: 3.0, mass: 7, strength: 4200, strain: 0.03, road: false, rope: false,
      blurb: 'Cheap support. Holds light stuff. Burns nicely.' },
    iron: { id: 'iron', name: 'Iron Girder', key: '3', cost: 16, maxLen: 3.7, mass: 16, strength: 12500, strain: 0.012, road: false, rope: false,
      blurb: 'Strong, heavy, pricey. Like Grubnik\'s uncle.' },
    rope: { id: 'rope', name: 'Rope', key: '4', cost: 3, maxLen: 7.5, mass: 1.2, strength: 7600, strain: 0.025, road: false, rope: true,
      blurb: 'Only pulls, never pushes. Hang things from high up.' }
  };
  const MAT_ORDER = ['road', 'wood', 'iron', 'rope'];

  // ------------------------------------------------------------------ levels
  const LEVELS = [
    {
      id: 1, name: 'Gribble Gulch',
      cargo: 'cabbages', cargoName: 'Prize cabbages', cartMass: 210,
      intro: 'A tiny gap. A cart of prize cabbages. What could possibly go wrong?',
      budget: 150, time: 60,
      left: 8, right: 14, ground: 0, river: 7.5,
      rocks: [{ x0: -40, y0: 0, x1: 8, y1: 40 }, { x0: 14, y0: 0, x1: 60, y1: 40 }],
      anchors: [[8, 0], [14, 0], [8, 2], [14, 2]],
      posts: [],
      view: { x0: 1.5, x1: 20.5, y0: -4.6, y1: 8.2 },
      napkin: [['road', 8, 0, 10, 0], ['road', 10, 0, 12, 0], ['road', 12, 0, 14, 0], ['wood', 8, 2, 10, 0], ['wood', 14, 2, 12, 0]]
    },
    {
      id: 2, name: 'Snotwater Chasm',
      cargo: 'anvils', cargoName: "The Chieftain's anvil collection", cartMass: 560,
      intro: "Heavy anvils. A wider gap. Luckily an old troll's tooth sticks out of the goo.",
      budget: 300, time: 75,
      left: 7, right: 15, ground: 0, river: 8,
      rocks: [{ x0: -40, y0: 0, x1: 7, y1: 40 }, { x0: 15, y0: 0, x1: 60, y1: 40 }, { x0: 10.5, y0: 3, x1: 11.5, y1: 40, spire: true }],
      anchors: [[7, 0], [15, 0], [7, 2], [15, 2], [11, 3]],
      posts: [],
      view: { x0: 0.5, x1: 21.5, y0: -4.6, y1: 8.7 },
      napkin: [['road', 7, 0, 9, 0], ['road', 9, 0, 11, 0], ['road', 11, 0, 13, 0], ['road', 13, 0, 15, 0], ['iron', 7, 2, 9, 0], ['iron', 15, 2, 13, 0], ['iron', 11, 3, 11, 0]]
    },
    {
      id: 3, name: 'The Yawning Doom',
      cargo: 'granny', cargoName: 'Granny Grubnik (and 40 cats)', cartMass: 420,
      intro: 'The widest gap in goblin history. Granny insists. Use the rope towers!',
      budget: 260, time: 90,
      left: 6, right: 16, ground: 0, river: 8,
      rocks: [{ x0: -40, y0: 0, x1: 6, y1: 40 }, { x0: 16, y0: 0, x1: 60, y1: 40 }],
      anchors: [[6, 0], [16, 0], [6, 2], [16, 2], [5, -4], [17, -4]],
      posts: [{ x: 5, top: -4 }, { x: 17, top: -4 }],
      view: { x0: -0.5, x1: 22.5, y0: -5.4, y1: 8.7 },
      napkin: [['road', 6, 0, 8, 0], ['road', 8, 0, 10, 0], ['road', 10, 0, 12, 0], ['road', 12, 0, 14, 0], ['road', 14, 0, 16, 0], ['rope', 5, -4, 8, 0], ['rope', 5, -4, 10, 0], ['rope', 17, -4, 12, 0], ['rope', 17, -4, 14, 0]]
    }
  ];

  // ----------------------------------------------------------------- helpers
  function beamCost(mat, len) { return Math.ceil(len * MATERIALS[mat].cost - 1e-6); }

  function pointInRock(level, x, y, margin) {
    const m = margin || 0;
    for (const r of level.rocks) {
      if (x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m) return true;
    }
    return false;
  }

  function isAnchor(level, x, y) {
    for (const a of level.anchors) if (Math.abs(a[0] - x) < 1e-6 && Math.abs(a[1] - y) < 1e-6) return true;
    return false;
  }

  // Does the open segment pass through solid rock?
  function segmentHitsRock(level, x1, y1, x2, y2) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(4, Math.ceil(len / 0.05));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (pointInRock(level, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, -0.02)) return true;
    }
    return false;
  }

  // Returns null if a beam between the two points is legal, else a reason code.
  function checkBeam(level, x1, y1, x2, y2, mat) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) return 'short';
    if (len > MATERIALS[mat].maxLen + 1e-6) return 'toolong';
    if (!isAnchor(level, x1, y1) && pointInRock(level, x1, y1, 0.05)) return 'rock';
    if (!isAnchor(level, x2, y2) && pointInRock(level, x2, y2, 0.05)) return 'rock';
    if (segmentHitsRock(level, x1, y1, x2, y2)) return 'rock';
    return null;
  }

  // Build a design object from a compact list [[mat,x1,y1,x2,y2], ...]
  function buildDesign(level, list) {
    const points = [], beams = [], key = {};
    let nid = 0, bid = 0;
    level.anchors.forEach((a, i) => {
      const id = 'a' + i;
      points.push({ id, x: a[0], y: a[1], anchor: true });
      key[a[0] + ',' + a[1]] = id;
    });
    function P(x, y) {
      const k = x + ',' + y;
      if (!key[k]) { const id = 'n' + (++nid); key[k] = id; points.push({ id, x, y, anchor: false }); }
      return key[k];
    }
    for (const s of list) beams.push({ id: 'b' + (++bid), a: P(s[1], s[2]), b: P(s[3], s[4]), mat: s[0] });
    return { points, beams };
  }

  function designCost(design) {
    const byId = {};
    for (const p of design.points) byId[p.id] = p;
    let c = 0;
    for (const b of design.beams) {
      const A = byId[b.a], B = byId[b.b];
      if (A && B) c += beamCost(b.mat, Math.hypot(B.x - A.x, B.y - A.y));
    }
    return c;
  }

  // Validate every beam of a design; returns list of problems (empty = fine)
  function validateDesign(level, design) {
    const byId = {}, problems = [];
    for (const p of design.points) byId[p.id] = p;
    for (const b of design.beams) {
      const A = byId[b.a], B = byId[b.b];
      const r = checkBeam(level, A.x, A.y, B.x, B.y, b.mat);
      if (r) problems.push(r + ' ' + b.mat + ' ' + A.x + ',' + A.y + '-' + B.x + ',' + B.y);
    }
    return problems;
  }

  // ------------------------------------------------------------------- world
  function particle(x, y, m) {
    return { x, y, px: x, py: y, vx: 0, vy: 0, m, w: m > 0 ? 1 / m : 0,
      r: 0, contact: false, cnx: 0, cny: 1, cA: null, cB: null, ct: 0, wet: false };
  }

  function staticPoint(x, y) { return { x, y, vx: 0, vy: 0, w: 0 }; }

  function buildStatics(level) {
    const segs = [];
    for (const r of level.rocks) {
      segs.push({ a: staticPoint(r.x0, r.y0), b: staticPoint(r.x1, r.y0) });
      segs.push({ a: staticPoint(r.x0, r.y0), b: staticPoint(r.x0, r.y1) });
      segs.push({ a: staticPoint(r.x1, r.y0), b: staticPoint(r.x1, r.y1) });
    }
    return segs;
  }

  function makeCart(level) {
    const M = level.cartMass;
    const x = level.left - 3.3, g = level.ground;
    const R = 0.3, hw = 0.62, H = 0.85;
    const p = [
      particle(x - hw, g - R, M * 0.27),          // 0 rear wheel
      particle(x + hw, g - R, M * 0.27),          // 1 front wheel
      particle(x + hw + 0.12, g - R - H, M * 0.23), // 2 front top
      particle(x - hw - 0.12, g - R - H, M * 0.23)  // 3 rear top
    ];
    p[0].r = R; p[1].r = R; p[2].r = 0.15; p[3].r = 0.15;
    const links = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      links.push({ a: p[i], b: p[j], rest: Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) });
    }
    return { p, links, R, target: 0, motor: true, spin: 0, cx: x, cy: g - R - H / 2,
      bestX: x, bestT: 0, flipT: 0, touchedRoad: false, airT: 0, maxVy: 0 };
  }

  // Joints between two nearly straight road planks resist bending (a "weld").
  // Modelled as an XPBD constraint on the distance of the joint from the
  // midpoint of its neighbours; breaks when the bending moment is too large.
  function makeBends(W) {
    const bends = [];
    const byNode = new Map();
    for (const b of W.roadBeams) {
      for (const n of [b.a, b.b]) {
        if (!byNode.has(n)) byNode.set(n, []);
        byNode.get(n).push(b);
      }
    }
    for (const [B, list] of byNode) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const b1 = list[i], b2 = list[j];
          const A = b1.a === B ? b1.b : b1.a, C = b2.a === B ? b2.b : b2.a;
          const ax = A.x - B.x, ay = A.y - B.y, cx = C.x - B.x, cy = C.y - B.y;
          const la = Math.hypot(ax, ay), lc = Math.hypot(cx, cy);
          if (la < 1e-6 || lc < 1e-6) continue;
          const cos = (ax * cx + ay * cy) / (la * lc);
          if (cos > -0.85) continue; // not a straight-ish continuation
          const mat = b1.mat;
          const l = (la + lc) / 2;
          const mx = (A.x + C.x) / 2, my = (A.y + C.y) / 2;
          bends.push({ A, B, C, b1, b2, l, rest: Math.hypot(B.x - mx, B.y - my),
            compliance: l * l / (4 * mat.bendK), max: mat.bendMax, force: 0, stress: 0, peak: 0, broken: false });
        }
      }
    }
    return bends;
  }

  function createWorld(level, design) {
    const W = {
      level, t: 0, nodes: [], beams: [], roadBeams: [], statics: buildStatics(level),
      cart: makeCart(level), events: [], outcome: null,
      stats: { broken: 0, brokenBeforeCart: 0, peak: 0 }, maxStress: 0
    };
    const idx = {};
    for (const p of design.points) {
      idx[p.id] = W.nodes.length;
      const n = particle(p.x, p.y, p.anchor ? 0 : JOINT_MASS);
      n.anchor = !!p.anchor; n.id = p.id;
      W.nodes.push(n);
    }
    for (const b of design.beams) {
      const A = W.nodes[idx[b.a]], B = W.nodes[idx[b.b]];
      if (!A || !B || A === B) continue;
      const mat = MATERIALS[b.mat];
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      if (len < 0.01) continue;
      const m = mat.mass * len;
      if (!A.anchor) A.m += m / 2;
      if (!B.anchor) B.m += m / 2;
      const beam = { id: b.id, a: A, b: B, mat, rest: len,
        compliance: mat.strain * len / mat.strength,
        force: 0, stress: 0, peak: 0, bend: 0, broken: false, warned: false };
      W.beams.push(beam);
      if (mat.road) W.roadBeams.push(beam);
    }
    for (const n of W.nodes) n.w = n.anchor ? 0 : 1 / n.m;
    W.bends = makeBends(W);
    W.dyn = W.nodes.filter(n => !n.anchor).concat(W.cart.p);
    return W;
  }

  function collide(W, p, r, A, B, isRoad) {
    const abx = B.x - A.x, aby = B.y - A.y;
    const l2 = abx * abx + aby * aby;
    if (l2 < 1e-10) return;
    let t = ((p.x - A.x) * abx + (p.y - A.y) * aby) / l2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const qx = A.x + abx * t, qy = A.y + aby * t;
    const dx = p.x - qx, dy = p.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-7) {
      const L = Math.sqrt(l2);
      nx = aby / L; ny = -abx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      d = 0;
    } else { nx = dx / d; ny = dy / d; }
    const C = d - r;
    const wa = A.w * (1 - t), wb = B.w * t;
    const wsum = p.w + wa * (1 - t) + wb * t;
    if (wsum <= 0) return;
    const dl = -C / wsum;
    p.x += p.w * dl * nx; p.y += p.w * dl * ny;
    if (wa) { A.x -= wa * dl * nx; A.y -= wa * dl * ny; }
    if (wb) { B.x -= wb * dl * nx; B.y -= wb * dl * ny; }
    if (ny < p.cny) { p.cny = ny; p.cnx = nx; p.cA = A; p.cB = B; p.ct = t; }
    p.contact = true;
    if (isRoad) W.cart.touchedRoad = true;
  }

  function breakBeam(W, b) {
    b.broken = true;
    W.stats.broken++;
    if (!W.cart.touchedRoad) W.stats.brokenBeforeCart++;
    W.events.push({ type: 'break', mat: b.mat.id, road: b.mat.road,
      x1: b.a.x, y1: b.a.y, x2: b.b.x, y2: b.b.y,
      vx1: b.a.vx, vy1: b.a.vy, vx2: b.b.vx, vy2: b.b.vy, t: W.t });
  }

  function substep(W, h) {
    const cart = W.cart, L = W.level, dyn = W.dyn;
    const h2 = h * h;
    const damp = Math.exp(-AIR_DAMP * h);
    const gooDamp = Math.exp(-GOO_DAMP * h);

    // 1. integrate
    for (let i = 0; i < dyn.length; i++) {
      const p = dyn[i];
      p.vy += GRAVITY * h;
      if (p.y > L.river) {
        p.vx *= gooDamp; p.vy *= gooDamp; p.vy -= GOO_LIFT * h;
      }
      p.vx *= damp; p.vy *= damp;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * h; p.y += p.vy * h;
    }

    // 2. beams (XPBD distance constraints)
    const beams = W.beams;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (b.broken) continue;
      const A = b.a, B = b.b;
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-9) continue;
      const C = len - b.rest;
      if (b.mat.rope && C <= 0) { b.force = 0; continue; }
      const wsum = A.w + B.w;
      if (wsum === 0) { b.force = 0; continue; }
      const dl = -C / (wsum + b.compliance / h2);
      const nx = dx / len, ny = dy / len;
      A.x -= A.w * dl * nx; A.y -= A.w * dl * ny;
      B.x += B.w * dl * nx; B.y += B.w * dl * ny;
      b.force = -dl / h2;
    }

    // 2b. road welds (bending)
    const bends = W.bends;
    for (let i = 0; i < bends.length; i++) {
      const k = bends[i];
      if (k.broken) continue;
      if (k.b1.broken || k.b2.broken) { k.broken = true; k.force = 0; continue; }
      const A = k.A, B = k.B, Cn = k.C;
      const mx = (A.x + Cn.x) / 2, my = (A.y + Cn.y) / 2;
      const dx = B.x - mx, dy = B.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-9) { k.force = 0; continue; }
      const Cv = d - k.rest;
      const wsum = B.w + 0.25 * A.w + 0.25 * Cn.w;
      if (wsum === 0) { k.force = 0; continue; }
      const dl = -Cv / (wsum + k.compliance / h2);
      const nx = dx / d, ny = dy / d;
      B.x += B.w * dl * nx; B.y += B.w * dl * ny;
      A.x -= A.w * 0.5 * dl * nx; A.y -= A.w * 0.5 * dl * ny;
      Cn.x -= Cn.w * 0.5 * dl * nx; Cn.y -= Cn.w * 0.5 * dl * ny;
      k.force = -dl / h2;
    }

    // 3. cart rigid body links (two passes for stiffness)
    for (let k = 0; k < 2; k++) {
      for (const l of cart.links) {
        const A = l.a, B = l.b;
        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) continue;
        const dl = -(len - l.rest) / (A.w + B.w);
        const nx = dx / len, ny = dy / len;
        A.x -= A.w * dl * nx; A.y -= A.w * dl * ny;
        B.x += B.w * dl * nx; B.y += B.w * dl * ny;
      }
    }

    // 4. cart collisions against road planks and terrain
    const roads = W.roadBeams, statics = W.statics;
    for (let i = 0; i < 4; i++) {
      const p = cart.p[i];
      p.contact = false; p.cny = 1; p.cA = null;
      for (let j = 0; j < roads.length; j++) {
        const b = roads[j];
        if (!b.broken) collide(W, p, p.r, b.a, b.b, true);
      }
      for (let j = 0; j < statics.length; j++) collide(W, p, p.r, statics[j].a, statics[j].b, false);
    }

    // 5. keep bridge joints out of solid rock
    const rocks = L.rocks, nodes = W.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      if (p.anchor) continue;
      for (let j = 0; j < rocks.length; j++) {
        const r = rocks[j];
        if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) {
          const dl = p.x - r.x0, dr = r.x1 - p.x, dt = p.y - r.y0, db = r.y1 - p.y;
          const m = Math.min(dl, dr, dt, db);
          if (m === dt) p.y = r.y0; else if (m === dl) p.x = r.x0; else if (m === dr) p.x = r.x1; else p.y = r.y1;
          p.px += (p.x - p.px) * 0.5; // a bit of friction
        }
      }
    }

    // 6. velocities
    const inv = 1 / h;
    for (let i = 0; i < dyn.length; i++) {
      const p = dyn[i];
      p.vx = (p.x - p.px) * inv; p.vy = (p.y - p.py) * inv;
    }

    // 7. axial beam damping
    const kd = Math.min(1, BEAM_DAMP * h);
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (b.broken) continue;
      const A = b.a, B = b.b;
      const wsum = A.w + B.w;
      if (wsum === 0) continue;
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-9) continue;
      if (b.mat.rope && len < b.rest) continue;
      const nx = dx / len, ny = dy / len;
      const vrel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
      const imp = -vrel * kd / wsum;
      A.vx -= A.w * imp * nx; A.vy -= A.w * imp * ny;
      B.vx += B.w * imp * nx; B.vy += B.w * imp * ny;
    }

    // 8. wheel motor (traction along the contact surface) + top friction
    for (let i = 0; i < 4; i++) {
      const p = cart.p[i];
      if (!p.contact) continue;
      const tx = -p.cny, ty = p.cnx;
      let svx = 0, svy = 0;
      if (p.cA) {
        svx = p.cA.vx * (1 - p.ct) + p.cB.vx * p.ct;
        svy = p.cA.vy * (1 - p.ct) + p.cB.vy * p.ct;
      }
      const vt = (p.vx - svx) * tx + (p.vy - svy) * ty;
      let dv;
      if (i < 2) {
        if (p.cny > -0.35) continue;
        dv = cart.target - vt;
        const lim = TRACTION * h;
        if (dv > lim) dv = lim; else if (dv < -lim) dv = -lim;
      } else {
        dv = -vt * Math.min(1, 12 * h);
      }
      p.vx += dv * tx; p.vy += dv * ty;
    }

    // 9. stress + breaking
    const ks = Math.min(1, h / STRESS_TAU);
    let maxS = 0;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (b.broken) continue;
      const ratio = Math.abs(b.force) / b.mat.strength;
      b.stress += (ratio - b.stress) * ks;
      if (b.stress > maxS) maxS = b.stress;
      if (b.stress > W.stats.peak) W.stats.peak = b.stress;
      if (b.stress > b.peak) b.peak = b.stress;
      if (b.stress > 1) breakBeam(W, b);
      else if (!b.warned && b.stress > 0.8) {
        b.warned = true;
        W.events.push({ type: 'creak', mat: b.mat.id, x: (b.a.x + b.b.x) / 2, y: (b.a.y + b.b.y) / 2, t: W.t });
      }
    }
    for (let i = 0; i < beams.length; i++) beams[i].bend = 0;
    for (let i = 0; i < bends.length; i++) {
      const k = bends[i];
      if (k.broken) continue;
      const ratio = Math.abs(k.force) * k.l * 0.5 / k.max;
      k.stress += (ratio - k.stress) * ks;
      if (k.stress > k.peak) k.peak = k.stress;
      if (k.stress > W.stats.peak) W.stats.peak = k.stress;
      if (k.stress > maxS) maxS = k.stress;
      if (k.stress > k.b1.bend) k.b1.bend = k.stress;
      if (k.stress > k.b2.bend) k.b2.bend = k.stress;
      if (k.stress > 1) {
        k.broken = true;
        W.stats.welds = (W.stats.welds || 0) + 1;
        W.events.push({ type: 'weld', x: k.B.x, y: k.B.y, t: W.t });
      }
    }
    W.maxStress = maxS;
  }

  function step(W, dt) {
    const c = W.cart;
    if (c.motor) c.target = W.t < START_DELAY ? 0 : Math.min(CART_SPEED, (W.t - START_DELAY) * 4);
    else c.target = 0;
    const P = c.p;
    const mx0 = (P[0].x + P[1].x) / 2, my0 = (P[0].y + P[1].y) / 2;
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) substep(W, h);
    W.t += dt;

    // wheel spin for rendering
    const ax = P[1].x - P[0].x, ay = P[1].y - P[0].y, al = Math.hypot(ax, ay) || 1;
    const mx1 = (P[0].x + P[1].x) / 2, my1 = (P[0].y + P[1].y) / 2;
    c.spin += ((mx1 - mx0) * ax + (my1 - my0) * ay) / al / c.R;

    // splash events
    for (const p of W.dyn) {
      if (!p.wet && p.y > W.level.river) {
        p.wet = true;
        const isCart = c.p.indexOf(p) >= 0;
        if (isCart || Math.abs(p.vy) > 3) W.events.push({ type: 'splash', x: p.x, y: W.level.river, big: isCart, v: Math.abs(p.vy), t: W.t });
      }
    }
    checkOutcome(W, dt);
  }

  function cartState(W) {
    const P = W.cart.p;
    const cx = (P[0].x + P[1].x + P[2].x + P[3].x) / 4;
    const cy = (P[0].y + P[1].y + P[2].y + P[3].y) / 4;
    const ux = (P[2].x + P[3].x - P[0].x - P[1].x) / 2;
    const uy = (P[2].y + P[3].y - P[0].y - P[1].y) / 2;
    const vy = (P[0].vy + P[1].vy + P[2].vy + P[3].vy) / 4;
    const vx = (P[0].vx + P[1].vx + P[2].vx + P[3].vx) / 4;
    const minX = Math.min(P[0].x, P[1].x, P[2].x, P[3].x);
    const anyContact = P[0].contact || P[1].contact || P[2].contact || P[3].contact;
    return { cx, cy, ux, uy, vx, vy, minX, upsideDown: uy > 0.25, anyContact };
  }

  function checkOutcome(W, dt) {
    const c = W.cart, L = W.level;
    const s = cartState(W);
    c.cx = s.cx; c.cy = s.cy;
    c.flipT = s.upsideDown ? c.flipT + dt : 0;
    c.airT = s.anyContact ? 0 : c.airT + dt;
    if (W.outcome) {
      if (W.outcome.success && s.cx > L.right + 3.4) c.motor = false;
      return;
    }
    if (s.minX > L.right + 0.9 && s.cy < L.ground + 0.3) {
      W.outcome = { success: true, reason: s.upsideDown ? 'upside' : (W.stats.broken > 0 ? 'wobbly' : 'clean'), t: W.t };
    } else if (s.cy > L.river - 1.6) {
      let reason = 'fell';
      if (W.roadBeams.length === 0) reason = 'noroad';
      else if (W.stats.brokenBeforeCart > 0 && !c.touchedRoad) reason = 'collapsed';
      W.outcome = { success: false, reason, t: W.t };
    } else if (c.flipT > 2.5) {
      W.outcome = { success: false, reason: 'flipped', t: W.t };
    } else {
      if (s.cx > c.bestX + 0.2) { c.bestX = s.cx; c.bestT = W.t; }
      if (W.t - c.bestT > 5 || W.t > MAX_TIME) W.outcome = { success: false, reason: 'stuck', t: W.t };
    }
    if (W.outcome) W.events.push({ type: 'outcome', success: W.outcome.success, reason: W.outcome.reason, t: W.t });
  }

  // Headless helper: run a full test and return a summary (used by tests).
  function simulate(level, design, opts) {
    const o = opts || {};
    const W = createWorld(level, design);
    const dt = 1 / 60;
    const maxT = o.maxT || 34;
    while (W.t < maxT) {
      step(W, dt);
      W.events.length = 0;
      if (W.outcome && W.t - W.outcome.t > (o.after || 0.5)) break;
    }
    return { outcome: W.outcome, broken: W.stats.broken, peak: W.stats.peak, t: W.t, world: W };
  }

  const API = {
    GRAVITY, SUBSTEPS, MATERIALS, MAT_ORDER, LEVELS, START_DELAY,
    beamCost, pointInRock, isAnchor, segmentHitsRock, checkBeam,
    buildDesign, designCost, validateDesign, createWorld, step, cartState, simulate
  };
  root.BridgeSim = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
