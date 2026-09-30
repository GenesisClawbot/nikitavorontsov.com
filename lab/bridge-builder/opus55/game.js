/* Grubnik's Bridge of Questionable Integrity - game layer.
   Rendering (canvas 2D), input, UI flow, goblin commentary and audio.
   Physics lives in physics.js (window.BridgeSim). */
(function () {
  'use strict';

  const Sim = window.BridgeSim;
  const MATS = Sim.MATERIALS;
  const LEVELS = Sim.LEVELS;
  const LW = 1280, LH = 720, TOP = 58, BOT = 86;
  const STEP = 1 / 60;
  const GOB_X = 102;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');
  const el = {
    topbar: $('topbar'), lvlName: $('lvlName'), cargoName: $('cargoName'),
    budgetLabel: $('budgetLabel'), budgetFill: $('budgetFill'),
    timerBox: $('timerBox'), timerVal: $('timerVal'), btnSound: $('btnSound'),
    buildbar: $('buildbar'), testbar: $('testbar'), mats: $('mats'),
    btnDemolish: $('btnDemolish'), btnUndo: $('btnUndo'), btnClear: $('btnClear'),
    btnNapkin: $('btnNapkin'), btnGo: $('btnGo'),
    testInfo: $('testInfo'), stressVal: $('stressVal'), btnStop: $('btnStop'),
    bubble: $('bubble'), bubbleText: $('bubbleText'), overlay: $('overlay'), panel: $('panel')
  };

  // ------------------------------------------------------------ utilities
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  const lastPick = {};
  function pickFresh(key, arr) {
    if (arr.length < 2) return arr[0];
    let i, n = 0;
    do { i = Math.floor(Math.random() * arr.length); n++; } while (i === lastPick[key] && n < 8);
    lastPick[key] = i;
    return arr[i];
  }
  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixRgb(a, b, t) {
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------------------------------------------------------------- audio
  const Sound = (function () {
    const FILES = {
      music: 'assets/generate_music-1.mp3',
      crack: 'assets/generate_sfx-1.mp3',
      splash: 'assets/generate_sfx-2.mp3',
      cheer: 'assets/generate_sfx-3.mp3',
      trombone: 'assets/generate_sfx-4.mp3',
      thunk: 'assets/generate_sfx-5.mp3',
      clang: 'assets/generate_sfx-6.mp3',
      roll: 'assets/generate_sfx-7.mp3',
      vTriangles: 'assets/generate_voice-1.mp3',
      vGenius: 'assets/generate_voice-2.mp3',
      vPrototype: 'assets/generate_voice-3.mp3',
      vTimesUp: 'assets/generate_voice-4.mp3',
      vUhOh: 'assets/generate_voice-5.mp3',
      vRelease: 'assets/generate_voice-6.mp3'
    };
    const base = {};
    const last = {};
    let unlocked = false, muted = false, ac = null, music = null, roll = null, voice = null;
    for (const k in FILES) {
      try {
        const a = new Audio();
        a.preload = 'auto';
        a.addEventListener('error', () => { a._bad = true; });
        a.src = FILES[k];
        base[k] = a;
      } catch (e) { /* audio unsupported */ }
    }
    function safePlay(a) {
      try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
    }
    function ensureCtx() {
      if (ac) return ac;
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) ac = new C();
      } catch (e) { ac = null; }
      return ac;
    }
    function startMusic() {
      if (!unlocked || muted) return;
      const b = base.music;
      if (!b || b._bad) return;
      music = b; music.loop = true; music.volume = 0.2;
      if (music.paused) safePlay(music);
    }
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      const c = ensureCtx();
      if (c && c.state === 'suspended' && c.resume) c.resume().catch(() => {});
      startMusic();
    }
    function synth(kind) {
      if (!unlocked || muted) return;
      const c = ensureCtx();
      if (!c) return;
      try {
        const t = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        let f = 440, f2 = 0, d = 0.08, type = 'square', v = 0.05;
        switch (kind) {
          case 'tick': f = 700; d = 0.045; type = 'triangle'; v = 0.07; break;
          case 'buzz': f = 150; f2 = 95; d = 0.16; type = 'sawtooth'; v = 0.045; break;
          case 'blip': f = 880; f2 = 1320; d = 0.08; type = 'sine'; v = 0.08; break;
          case 'thunk': f = 190; f2 = 70; d = 0.08; type = 'triangle'; v = 0.12; break;
          case 'crack': case 'clang': f = 320; f2 = 60; d = 0.12; type = 'square'; v = 0.06; break;
          case 'splash': f = 220; f2 = 40; d = 0.35; type = 'sawtooth'; v = 0.05; break;
          case 'cheer': f = 520; f2 = 1040; d = 0.35; type = 'triangle'; v = 0.07; break;
          case 'trombone': f = 290; f2 = 140; d = 0.9; type = 'sawtooth'; v = 0.05; break;
          default: break;
        }
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* ignore */ }
    }
    function play(name, vol, rate, minGapMs) {
      if (!unlocked || muted) return;
      const now = performance.now();
      if (minGapMs && last[name] && now - last[name] < minGapMs) return;
      last[name] = now;
      const b = base[name];
      if (!b || b._bad) { synth(name); return; }
      try {
        const a = b.cloneNode(true);
        a.volume = clamp(vol == null ? 1 : vol, 0, 1);
        if (rate) a.playbackRate = rate;
        safePlay(a);
      } catch (e) { synth(name); }
    }
    function say(name) {
      if (!unlocked || muted) return;
      const b = base[name];
      if (!b || b._bad) return;
      try {
        if (voice) voice.pause();
        voice = b.cloneNode(true);
        voice.volume = 1;
        safePlay(voice);
      } catch (e) { /* ignore */ }
    }
    function rolling(on, vol) {
      const b = base.roll;
      if (!b || b._bad) return;
      if (on && unlocked && !muted) {
        if (!roll) { roll = b.cloneNode(true); roll.loop = true; }
        roll.volume = clamp(vol, 0, 1);
        if (roll.paused) safePlay(roll);
      } else if (roll && !roll.paused) {
        roll.pause();
      }
    }
    function setMuted(m) {
      muted = m;
      if (m) {
        if (music) music.pause();
        if (voice) voice.pause();
        rolling(false, 0);
      } else startMusic();
    }
    return { unlock, play, say, synth, rolling, setMuted, isMuted: () => muted };
  })();

  // ------------------------------------------------------------ text bank
  const TXT = {
    levelStart: [
      "Rule one: Planks are road. Rule two: something must hold the planks UP. Click a glowing bolt to start a beam!",
      "Anvils. HEAVY anvils. Wood will cry. Iron won't. That troll tooth in the middle makes a lovely anchor.",
      "Ten metres of nothing! Those towers LOVE ropes. Ropes pull, ropes are cheap. I love ropes."
    ],
    tips: [
      "Triangles! Triangles are basically magic that nobody can explain.",
      "A plank with nothing under it is just a long, plank-shaped hope.",
      "Click a bolt or joint, then click again to place a beam. It keeps chaining. Right-click or Esc to stop.",
      "Red preview means NO. Too long, solid rock, or you're broke.",
      "Stuck? Press H for cousin Snazzgit's napkin sketch. He only charges a little.",
      "Only Planks carry the cart. Everything else just holds the planks up.",
      "Iron is strong, heavy and pricey. Like my uncle Borgle.",
      "Ropes only pull. Push a rope and it just sulks.",
      "Right-click a beam to smash it. Very therapeutic.",
      "The cart leaves when the timer hits zero. Ready or not!"
    ],
    place: ["Beautiful. Mostly.", "Hammered it in with my forehead!", "Snug as a bug. A load-bearing bug.",
      "That one's sturdy. Probably.", "Ooh, engineering!", "Nailed it. Literally.", "Grubnik approves. Tentatively."],
    hurry: ["Hurry! The Chieftain is tapping his foot!", "Ten seconds! The driver is revving the hamster!",
      "Faster! The cargo is getting impatient!"],
    go: ["For science!", "Everyone stand WAY back.", "Don't look down!", "Fingers crossed. All eleven."],
    retry: ["Back to the drawing board. The board is also a beam now.", "Right. Fix the bit that went crunch.",
      "Again! This time with more triangles.", "The ravine is patient. Grubnik is not."],
    creak: ["Hear that creak? That's the sound of... confidence.", "It's supposed to bend like that. Probably.",
      "Red beams mean 'very busy'. Also 'doomed'."],
    brk: ["That's a load-bearing CRACK!", "It's fine. It's FINE.", "Nobody saw that.", "Less bridge. More ravine.",
      "Was that important? That looked important."],
    smash: ["SMASH!", "Demolition is also engineering.", "Goodbye, beam. You were mediocre."],
    noroadGo: "No road at all? Bold. Very bold."
  };
  const COMPLAIN = {
    toolong: (m) => 'Too long for ' + MATS[m].name + '! Max ' + MATS[m].maxLen.toFixed(1) + ' m. Add a joint in between.',
    short: () => 'Too short. Even goblins need SOME beam.',
    rock: () => "That's solid rock. Grubnik doesn't do tunnels.",
    gold: () => 'Out of gold! The Chieftain checks the receipts.',
    dup: () => 'Already built that one. I admire the enthusiasm.',
    max: () => 'That is plenty of beams. The forest is running out of trees.',
    nostart: () => 'Start from a glowing bolt or an existing joint, genius!'
  };
  const SHORT = { toolong: 'Too long!', short: 'Too short', rock: 'Solid rock!', gold: 'Not enough gold!', dup: 'Already built', max: 'Too many beams' };
  const RESULT = {
    success: {
      cabbages: ['The cabbages arrive! Mostly unbruised.', 'Cabbage delivery complete. Nobody cried. Much.'],
      anvils: ['All 47 anvils present. The Chieftain counted twice.', 'The anvils arrive! The Chieftain almost smiled!'],
      granny: ["Granny made it! She says the bridge 'lacks doilies'.", 'Granny and all 40 cats arrived. Well, 41. Somebody had a kitten.']
    },
    fell: {
      cabbages: ['Cabbage soup for everyone downstream!', 'The cabbages achieved flight. Briefly.'],
      anvils: ['The anvils sank. Anvils are REALLY good at that.', "The Chieftain's anvils are now the river's anvils."],
      granny: ["Granny is fine. She's swimming back. She's FURIOUS.", 'The cats landed on their feet. On Granny.']
    },
    collapsed: 'The bridge collapsed before the cart even got there. Efficient!',
    noroad: "You... didn't build any road. The cart noticed.",
    stuck: 'The cart has decided to live on your bridge now. Forever.',
    flipped: "The cart is upside-down. The cargo calls it 'a learning experience'.",
    wobbly: "Some beams snapped along the way. We'll call them 'optional'.",
    upside: 'It arrived upside-down. Technically still a delivery!'
  };
  const HEAD = {
    success: ['IT HOLDS!', 'DELIVERED!', 'GENIUS!'],
    fell: ['KER-SPLOOSH!', 'GLORP.', 'SPLOOSH!'],
    collapsed: ['KA-RUMBLE!'],
    noroad: ['...WHAT ROAD?'],
    stuck: ['STUCK!'],
    flipped: ['WHOOPSIE!']
  };
  const FAIL_TIP = {
    road: 'A Plank snapped. Planks need support underneath (or rope from above) - triangles, remember?',
    wood: 'A Wood Beam gave up. Try Iron in that spot, or share the load with more triangles.',
    iron: 'Even the Iron snapped! Spread the weight over more supports.',
    rope: 'A Rope snapped. Add more ropes so they share the weight.',
    weld: 'A plank joint bent too far. Heavy cargo needs a support or rope under EVERY road joint - or use longer planks between supports.',
    none: 'Nothing snapped... the cart just went somewhere silly. Keep the road smooth and connected end to end.',
    noroad: 'Planks (key 1) are the road. Connect a Plank chain from the left bolt to the right bolt.',
    stuck: 'That slope was too steep for the cart. Keep the road flat-ish.',
    collapsed: 'The bridge could not even hold itself up. Support the planks before adding cargo!'
  };

  // --------------------------------------------------------------- styles
  const MSTYLE = {
    road: { w: 0.22, fill: '#9a6532', edge: '#3a220d', hi: '#d39a5a' },
    wood: { w: 0.13, fill: '#d29c58', edge: '#5a3714', hi: '#f0c98e' },
    iron: { w: 0.15, fill: '#8c99a8', edge: '#28303a', hi: '#d5dde6' },
    rope: { w: 0.055, fill: '#e3cb8e', edge: '#6e5728', hi: '#fff0c4' }
  };
  for (const k in MSTYLE) MSTYLE[k].rgb = hexRgb(MSTYLE[k].fill);
  const RED = [255, 46, 30];
  const NAPKIN = { road: 'rgba(255,255,255,0.9)', wood: 'rgba(255,205,120,0.95)', iron: 'rgba(150,215,255,0.95)', rope: 'rgba(255,245,190,0.95)' };
  const SKY = [
    { top: '#4f9fd6', mid: '#9fd3ea', bot: '#f5dca8', sun: '#fff3b8', glow: 'rgba(255,245,190,0.55)', m1: '#8aa7c2', m2: '#6a88a6', cloud: 'rgba(255,255,255,0.85)' },
    { top: '#35295f', mid: '#b0578a', bot: '#f4a259', sun: '#ffd27a', glow: 'rgba(255,200,120,0.55)', m1: '#74507f', m2: '#523862', cloud: 'rgba(255,200,210,0.55)' },
    { top: '#0c1533', mid: '#28306b', bot: '#6c4f8f', sun: '#f4efd6', glow: 'rgba(230,230,255,0.35)', m1: '#343466', m2: '#23234d', cloud: 'rgba(170,170,220,0.35)', stars: true }
  ];

  // ---------------------------------------------------------------- state
  const S = {
    mode: 'title', li: 0, level: null, design: null, designs: [], undo: [], ver: 0,
    mat: 'road', tool: 'build', drawStart: null, drag: null, hoverBeam: null,
    mouse: { lx: 0, ly: 0, wx: 0, wy: 0, inside: false },
    timer: 60, world: null, acc: 0, outcomeAt: 0, lastSuccess: false,
    attempts: [0, 0, 0], stars: [0, 0, 0], pocket: [0, 0, 0],
    napkin: false, time: 0, shake: 0, slowmo: 0, flash: 0,
    particles: [], debris: [], labels: [], later: [],
    cam: { s: 40, tx: 0, ty: 0 }, vis: { x0: 0, y0: 0, x1: 1, y1: 1 }, k: 1,
    gob: { mood: 'neutral', moodT: 0, base: 'neutral', blink: 0, blinkT: 2.5, look: { x: 0, y: 0 }, talkT: 0 },
    bubbleT: 0, tipT: 14, flags: {}, tf: {}, idleCart: null, bg: null, reachKey: '', reach: null, nextId: 1
  };

  // --------------------------------------------------------------- camera
  function computeCamera() {
    const v = S.level.view;
    const aw = LW, ah = LH - TOP - BOT;
    const s = Math.min(aw / (v.x1 - v.x0), ah / (v.y1 - v.y0));
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    S.cam = { s, tx: LW / 2 - cx * s, ty: TOP + ah / 2 - cy * s };
    const a = s2w(0, 0), b = s2w(LW, LH);
    S.vis = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }
  function w2s(x, y) { return { x: x * S.cam.s + S.cam.tx, y: y * S.cam.s + S.cam.ty }; }
  function s2w(x, y) { return { x: (x - S.cam.tx) / S.cam.s, y: (y - S.cam.ty) / S.cam.s }; }

  function resize() {
    const vw = window.innerWidth || LW, vh = window.innerHeight || LH;
    const fit = Math.max(0.2, Math.min(vw / LW, vh / LH));
    stage.style.transform = 'translate(-50%, -50%) scale(' + fit + ')';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(LW * fit * dpr));
    canvas.height = Math.max(1, Math.round(LH * fit * dpr));
    S.k = canvas.width / LW;
  }

  // -------------------------------------------------------------- backdrop
  function buildBackdrop() {
    const L = S.level;
    const rng = seeded(L.id * 7919 + 31);
    const gy = w2s(0, 0).y;
    function ridge(baseY, amp, step) {
      const pts = [];
      let x = -60;
      while (x < LW + 60) { pts.push([x, baseY - rng() * amp]); x += step * (0.5 + rng()); }
      pts.push([LW + 60, baseY - rng() * amp]);
      return pts;
    }
    const faces = L.rocks.map(() => {
      const mk = () => { const arr = []; for (let y = 0; y <= 24; y += 0.5) arr.push([y === 0 ? 0 : -0.13 + rng() * 0.16, y]); return arr; };
      return { left: mk(), right: mk(), pebbles: Array.from({ length: 40 }, () => [rng(), rng(), 0.05 + rng() * 0.1]), tufts: Array.from({ length: 60 }, () => [rng(), 0.08 + rng() * 0.18]) };
    });
    const rim = [];
    for (let x = L.left - 0.5; x <= L.right + 0.5 + 1e-6; x += 0.5) rim.push([x, 0.3 + rng() * 0.35]);
    const cracks = [];
    for (let i = 0; i < 7; i++) {
      const x = L.left + 0.6 + rng() * (L.right - L.left - 1.2), y = 1 + rng() * (L.river - 2);
      cracks.push([x, y, x + rng() * 0.6 - 0.3, y + 0.6 + rng() * 0.5, x + rng() * 0.8 - 0.4, y + 1.2 + rng() * 0.8]);
    }
    S.bg = {
      groundY: gy,
      far: ridge(gy - 70, 150, 80),
      near: ridge(gy - 5, 90, 55),
      clouds: Array.from({ length: 6 }, () => ({ x: rng() * (LW + 300), y: 72 + rng() * Math.max(40, gy * 0.45), s: 0.6 + rng() * 0.8, v: 5 + rng() * 10 })),
      stars: Array.from({ length: 70 }, () => ({ x: rng() * LW, y: rng() * gy * 0.85, r: 0.8 + rng() * 1.6, p: rng() * 6 })),
      faces, rim, cracks,
      bubbles: Array.from({ length: 6 }, () => ({ x: L.left + 0.4 + rng() * (L.right - L.left - 0.8), p: rng() * 5, s: 0.5 + rng() }))
    };
  }

  // --------------------------------------------------------------- design
  function newDesign(level) {
    return { points: level.anchors.map((a, i) => ({ id: 'a' + i, x: a[0], y: a[1], anchor: true })), beams: [] };
  }
  function ptMap() { const m = {}; for (const p of S.design.points) m[p.id] = p; return m; }
  function pointById(id) { for (const p of S.design.points) if (p.id === id) return p; return null; }
  function pointAt(x, y) { for (const p of S.design.points) if (p.x === x && p.y === y) return p; return null; }
  function beamBetween(a, b) {
    for (const bm of S.design.beams) if ((bm.a === a && bm.b === b) || (bm.a === b && bm.b === a)) return bm;
    return null;
  }
  function spent() { return Sim.designCost(S.design); }
  function hasRoad() { for (const b of S.design.beams) if (b.mat === 'road') return true; return false; }
  // Is there a chain of planks from the left edge bolt to the right edge bolt?
  function roadConnected() {
    const L = S.level;
    const start = pointAt(L.left, L.ground), goal = pointAt(L.right, L.ground);
    if (!start || !goal) return false;
    const seen = new Set([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift();
      if (id === goal.id) return true;
      for (const b of S.design.beams) {
        if (b.mat !== 'road') continue;
        const other = b.a === id ? b.b : b.b === id ? b.a : null;
        if (other && !seen.has(other)) { seen.add(other); queue.push(other); }
      }
    }
    return false;
  }
  function changed() { S.ver++; }
  function pushUndo() {
    S.undo.push(JSON.stringify(S.design));
    if (S.undo.length > 80) S.undo.shift();
  }
  function cleanup() {
    const used = new Set();
    for (const b of S.design.beams) { used.add(b.a); used.add(b.b); }
    S.design.points = S.design.points.filter((p) => p.anchor || used.has(p.id));
    if (S.drawStart && !pointById(S.drawStart)) S.drawStart = null;
    changed();
  }
  function setDesign(d) { S.design = d; S.designs[S.li] = d; S.drawStart = null; S.drag = null; changed(); }

  function beamProblem(start, gx, gy, mat) {
    const L = S.level;
    const reason = Sim.checkBeam(L, start.x, start.y, gx, gy, mat);
    if (reason) return reason;
    const end = pointAt(gx, gy);
    const existing = end ? beamBetween(start.id, end.id) : null;
    if (existing && existing.mat === mat) return 'dup';
    const len = Math.hypot(gx - start.x, gy - start.y);
    const cost = Sim.beamCost(mat, len);
    const refund = existing ? Sim.beamCost(existing.mat, len) : 0;
    if (spent() - refund + cost > L.budget) return 'gold';
    if (!existing && S.design.beams.length >= 70) return 'max';
    return null;
  }

  function tryAddBeam(start, gx, gy, mat) {
    const reason = beamProblem(start, gx, gy, mat);
    if (reason) return { ok: false, reason };
    pushUndo();
    let end = pointAt(gx, gy);
    if (!end) { end = { id: 'n' + (S.nextId++), x: gx, y: gy, anchor: false }; S.design.points.push(end); }
    const existing = beamBetween(start.id, end.id);
    if (existing) existing.mat = mat;
    else S.design.beams.push({ id: 'b' + (S.nextId++), a: start.id, b: end.id, mat });
    changed();
    return { ok: true, end, replaced: !!existing };
  }

  function beamNear(wx, wy, tol) {
    const m = ptMap();
    let best = null, bd = tol;
    for (const b of S.design.beams) {
      const A = m[b.a], B = m[b.b];
      if (!A || !B) continue;
      const d = distToSeg(wx, wy, A.x, A.y, B.x, B.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function demolishAt(wx, wy) {
    const gx = Math.round(wx), gy = Math.round(wy);
    const p = pointAt(gx, gy);
    if (p && !p.anchor && Math.hypot(wx - gx, wy - gy) < 0.3) {
      pushUndo();
      S.design.beams = S.design.beams.filter((b) => b.a !== p.id && b.b !== p.id);
      cleanup();
      smashFx(gx, gy);
      return true;
    }
    const b = beamNear(wx, wy, 0.3);
    if (b) {
      const m = ptMap(), A = m[b.a], B = m[b.b];
      pushUndo();
      S.design.beams = S.design.beams.filter((x) => x !== b);
      cleanup();
      smashFx((A.x + B.x) / 2, (A.y + B.y) / 2);
      return true;
    }
    return false;
  }
  function smashFx(x, y) {
    Sound.play('crack', 0.35, 1.5, 60);
    for (let i = 0; i < 8; i++) spawn({ type: 'splinter', x, y, vx: rnd(-2.5, 2.5), vy: rnd(-3.5, -0.5), g: 1, life: 0.9, rot: rnd(0, 6), vr: rnd(-12, 12), color: '#c89250' });
    if (Math.random() < 0.3) gobSay(pickFresh('smash', TXT.smash), 'smug', 2);
  }

  function doUndo() {
    if (S.mode !== 'build') return;
    if (!S.undo.length) { gobSay('Nothing to undo. Grubnik has no regrets.', 'smug', 2.5); Sound.synth('buzz'); return; }
    setDesign(JSON.parse(S.undo.pop()));
    Sound.synth('tick');
  }
  function doClear() {
    if (S.mode !== 'build') return;
    if (!S.design.beams.length) return;
    pushUndo();
    S.design.beams = [];
    cleanup();
    S.drawStart = null;
    gobSay('Scorched earth! Very bold. (Z brings it back.)', 'shock', 3);
    Sound.play('crack', 0.5, 0.8);
  }
  function selectMat(id) {
    if (!MATS[id]) return;
    S.mat = id; S.tool = 'build';
    S.reachKey = '';
    Sound.synth('tick');
    gobSay(MATS[id].name + ': ' + MATS[id].blurb, 'neutral', 3.2);
  }
  function toggleDemolish() {
    S.tool = S.tool === 'demolish' ? 'build' : 'demolish';
    S.drawStart = null; S.drag = null;
    Sound.synth('tick');
    if (S.tool === 'demolish') gobSay('Smash mode! Click beams or joints to destroy them. X to go back.', 'smug', 3);
  }
  function toggleNapkin() {
    S.napkin = !S.napkin;
    Sound.synth('tick');
    if (S.napkin) {
      const cost = Sim.designCost(Sim.buildDesign(S.level, S.level.napkin));
      gobSay("Cousin Snazzgit's napkin sketch. About " + cost + " gold. He says it 'probably' works.", 'smug', 5);
    }
  }

  // ---------------------------------------------------------------- goblin
  function gobSay(text, mood, dur) {
    el.bubbleText.textContent = text;
    el.bubble.classList.remove('hidden');
    // restart pop animation
    el.bubble.style.animation = 'none';
    void el.bubble.offsetWidth;
    el.bubble.style.animation = '';
    S.bubbleT = dur || 4;
    S.gob.talkT = Math.min(2.2, text.length * 0.035);
    if (mood) { S.gob.mood = mood; S.gob.moodT = Math.max(1.2, Math.min(dur || 3, 3.5)); }
  }
  function setMood(mood, t) { S.gob.mood = mood; S.gob.moodT = t; }
  function later(delay, fn) { S.later.push({ t: S.time + delay, fn }); }

  // ------------------------------------------------------------ modes/flow
  function setLevel(li) {
    S.li = li;
    S.level = LEVELS[li];
    if (!S.designs[li]) S.designs[li] = newDesign(S.level);
    S.design = S.designs[li];
    S.undo = []; S.drawStart = null; S.drag = null; S.world = null; S.tool = 'build';
    S.particles = []; S.debris = []; S.napkin = false; S.reachKey = '';
    S.idleCart = Sim.createWorld(S.level, { points: [], beams: [] }).cart;
    computeCamera();
    buildBackdrop();
    changed();
  }

  function openPanel(html, style) {
    el.panel.innerHTML = html;
    el.overlay.classList.remove('hidden');
    el.overlay.classList.toggle('dim', style === true || style === 'dim');
    el.overlay.classList.toggle('side', style === 'side');
    el.panel.style.animation = 'none';
    void el.panel.offsetWidth;
    el.panel.style.animation = '';
  }
  function closePanel() { el.overlay.classList.add('hidden'); el.panel.innerHTML = ''; }

  function setBars() {
    const m = S.mode;
    el.topbar.classList.toggle('hidden', m === 'title' || m === 'victory');
    el.buildbar.classList.toggle('hidden', m !== 'build');
    el.testbar.classList.toggle('hidden', !(m === 'test' || m === 'result'));
  }

  function starsHtml(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += i < n ? '&#9733;' : '<span class="off">&#9733;</span>';
    return s;
  }

  function showTitle() {
    setLevel(0);
    S.gob.moodT = 0; S.gob.base = 'neutral';
    S.mode = 'title';
    setBars();
    el.bubble.classList.add('hidden');
    let lv = '';
    LEVELS.forEach((L, i) => {
      lv += '<button class="lvlbtn" data-act="level" data-li="' + i + '">' + (i + 1) + '. ' + esc(L.name) +
        (S.stars[i] ? ' <span style="color:#ffd66b">' + '&#9733;'.repeat(S.stars[i]) + '</span>' : '') + '</button>';
    });
    openPanel(
      '<h1>GRUBNIK\'S BRIDGE</h1>' +
      '<div class="title-sub">of Questionable Integrity</div>' +
      '<p class="flavor">"Build it quick. Build it cheap. Blame the cart."<br>- Grubnik Wrenchbottom, Licensed* Bridge Engineer</p>' +
      '<ul class="howto">' +
      '<li><b>Build:</b> click a glowing bolt, then click grid points to lay beams (it keeps chaining). Right-click or <b>Esc</b> stops. Dragging works too.</li>' +
      '<li><b>Planks</b> are the only road. <b>Wood</b>, <b>Iron</b> and <b>Rope</b> hold the planks up. Triangles are magic.</li>' +
      '<li>Mind the gold. Press <b>GO</b> before the timer runs out - the cart leaves either way!</li>' +
      '<li>Watch the test run: red beams are about to snap. Press <b>R</b> to fix it and retry instantly.</li>' +
      '</ul>' +
      '<div class="row"><button class="primary" data-act="start">Start building! <kbd>Enter</kbd></button></div>' +
      '<div class="row">' + lv + '</div>' +
      '<p class="stats">*license drawn by Grubnik. In crayon. &nbsp;|&nbsp; M toggles sound</p>',
      true);
  }

  function showIntro(li) {
    setLevel(li);
    S.gob.moodT = 0; S.gob.base = 'neutral';
    S.mode = 'intro';
    setBars();
    const L = S.level;
    openPanel(
      '<h2>Level ' + L.id + ' of ' + LEVELS.length + '</h2>' +
      '<h1>' + esc(L.name) + '</h1>' +
      '<p class="flavor">' + esc(L.intro) + '</p>' +
      '<p><span class="tag">Cargo: ' + esc(L.cargoName) + ' - ' + L.cartMass + ' kg</span></p>' +
      '<p><span class="tag">Budget: ' + L.budget + ' gold</span><span class="tag">Cart leaves in ' + L.time + ' s</span></p>' +
      '<div class="row"><button class="primary" data-act="build">Start building! <kbd>Enter</kbd></button>' +
      '<button data-act="menu">Title</button></div>',
      true);
    el.bubble.classList.add('hidden');
  }

  function startBuild() {
    closePanel();
    S.mode = 'build';
    S.timer = S.level.time;
    S.flags = { warned10: false, placed: 0 };
    S.tipT = 16;
    setBars();
    gobSay(TXT.levelStart[S.li] || TXT.tips[0], 'happy', 7);
    if (S.li === 0 && S.attempts[0] === 0) later(0.3, () => Sound.say('vTriangles'));
  }

  function startTest(auto) {
    if (S.mode !== 'build') return;
    S.mode = 'test';
    S.drawStart = null; S.drag = null;
    S.attempts[S.li]++;
    S.world = Sim.createWorld(S.level, S.design);
    S.acc = 0; S.outcomeAt = 0; S.slowmo = 0;
    S.tf = { breaks: 0, creak: false, spilled: false, firstBreak: null, smokeT: 0, brkSaidAt: -9, confetti: false };
    S.particles = []; S.debris = [];
    setBars();
    el.testInfo.textContent = 'Test run #' + S.attempts[S.li] + ' - ' + S.level.cargoName + '. R to stop and fix.';
    if (auto) {
      Sound.say('vTimesUp');
      gobSay("Time's up! Send the cart! It waits for no goblin!", 'shock', 3);
    } else if (!hasRoad()) {
      gobSay(TXT.noroadGo, 'worried', 3);
    } else if (!roadConnected()) {
      gobSay("The road doesn't reach the other side! Bold. Stupid, but bold.", 'worried', 3.5);
    } else {
      Sound.say('vRelease');
      gobSay('Release the cart! ' + pickFresh('go', TXT.go), 'happy', 2.5);
    }
  }

  function backToBuild() {
    if (S.mode !== 'test' && S.mode !== 'result') return;
    closePanel();
    Sound.rolling(false, 0);
    S.world = null; S.particles = []; S.debris = []; S.later = [];
    S.mode = 'build';
    S.timer = S.level.time;
    S.flags = { warned10: false, placed: 0 };
    S.tipT = 18;
    setBars();
    gobSay(pickFresh('retry', TXT.retry), 'neutral', 3.5);
  }

  function onOutcome(o) {
    const W = S.world;
    Sound.rolling(false, 0);
    if (o.success) {
      Sound.play('cheer', 0.8);
      later(0.35, () => Sound.say('vGenius'));
      setMood('happy', 99);
      gobSay('It holds! Grubnik is a GENIUS!', 'happy', 3);
      confetti();
    } else {
      setMood(o.reason === 'stuck' ? 'worried' : 'shock', 1.2);
      if (o.reason === 'fell' || o.reason === 'collapsed' || o.reason === 'noroad') spillCargo();
      later(1.2, () => { setMood('sad', 99); });
    }
    S.outcomeAt = S.time;
    S.tf.broken = W.stats.broken;
  }

  function showResult() {
    const W = S.world, o = W.outcome, L = S.level;
    S.mode = 'result';
    S.lastSuccess = o.success;
    S.gob.base = o.success ? 'happy' : 'sad';
    setBars();
    const cargo = L.cargo;
    if (o.success) {
      const sp = spent();
      const frac = sp / L.budget;
      const stars = frac <= 0.7 ? 3 : frac <= 0.9 ? 2 : 1;
      S.stars[S.li] = Math.max(S.stars[S.li], stars);
      S.pocket[S.li] = Math.max(S.pocket[S.li], L.budget - sp);
      let flavor = pick(RESULT.success[cargo]);
      if (o.reason === 'upside') flavor = RESULT.upside;
      else if (o.reason === 'wobbly') flavor += ' ' + RESULT.wobbly;
      const last = S.li >= LEVELS.length - 1;
      openPanel(
        '<h1 class="win">' + pick(HEAD.success) + '</h1>' +
        '<p class="flavor">' + esc(flavor) + '</p>' +
        '<div class="stars">' + starsHtml(stars) + '</div>' +
        '<p class="stats">Spent ' + sp + ' of ' + L.budget + ' gold. Grubnik pockets the other ' + (L.budget - sp) + '.' +
        (stars < 3 ? ' (Spend under ' + Math.floor(L.budget * 0.7) + ' for three stars.)' : '') + '</p>' +
        '<p class="stats">Attempt #' + S.attempts[S.li] + (W.stats.broken ? ' &middot; ' + W.stats.broken + ' beam(s) snapped' : ' &middot; nothing snapped!') + '</p>' +
        '<div class="row"><button class="primary" data-act="next">' + (last ? 'Collect promotion' : 'Next level') + ' <kbd>Enter</kbd></button>' +
        '<button data-act="retry">Tweak it <kbd>R</kbd></button></div>', 'side');
    } else {
      Sound.play('trombone', 0.75);
      later(1.6, () => Sound.say('vPrototype'));
      const reason = o.reason;
      let flavor;
      if (reason === 'fell') flavor = pick(RESULT.fell[cargo]);
      else flavor = RESULT[reason] || RESULT.stuck;
      let tip;
      if (reason === 'noroad') tip = FAIL_TIP.noroad;
      else if (reason === 'stuck' && !S.tf.firstBreak) tip = FAIL_TIP.stuck;
      else if (reason === 'collapsed') tip = FAIL_TIP.collapsed;
      else tip = FAIL_TIP[S.tf.firstBreak || 'none'];
      openPanel(
        '<h1>' + pick(HEAD[reason] || HEAD.fell) + '</h1>' +
        '<p class="flavor">' + esc(flavor) + '</p>' +
        '<p class="stats">Snapped beams: ' + W.stats.broken + ' &middot; Worst stress: ' + Math.round(Math.min(W.stats.peak, 9.99) * 100) + '% &middot; Attempt #' + S.attempts[S.li] + '</p>' +
        '<p><b>Grubnik\'s tip:</b> ' + esc(tip) + '</p>' +
        '<div class="row"><button class="primary" data-act="retry">Fix it &amp; retry <kbd>R</kbd></button>' +
        '<button data-act="retrynapkin">Show napkin</button></div>', 'side');
      gobSay('That was a prototype. Nobody panic. ' + pick(['We will call it a "learning experience".', 'Physics is so unfair to goblins.', 'The ravine wins this round.']), 'sad', 4.5);
    }
  }

  function nextLevel() {
    if (S.li < LEVELS.length - 1) showIntro(S.li + 1);
    else showVictory();
  }

  function showVictory() {
    S.mode = 'victory';
    S.gob.base = 'happy';
    S.world = null;
    Sound.rolling(false, 0);
    setBars();
    const total = S.pocket.reduce((a, b) => a + b, 0);
    const tries = S.attempts.reduce((a, b) => a + b, 0);
    let rows = '';
    LEVELS.forEach((L, i) => { rows += '<div>' + esc(L.name) + ': <span class="stars" style="font-size:22px">' + starsHtml(S.stars[i]) + '</span></div>'; });
    openPanel(
      '<h1 class="win">PROMOTED!</h1>' +
      '<p class="flavor">Grubnik is now Senior Bridge Goblin. Every bridge will be named after him - until it falls down.</p>' +
      rows +
      '<p class="stats">Gold "saved" (pocketed): ' + total + ' &middot; Test runs: ' + tries + '</p>' +
      '<div class="row"><button class="primary" data-act="again">Play again</button><button data-act="menu">Title screen</button></div>',
      true);
    gobSay('Senior Bridge Goblin! I am getting a BIGGER hat.', 'happy', 8);
    setMood('happy', 99);
    Sound.play('cheer', 0.8);
  }

  function restartGame() {
    S.designs = []; S.stars = [0, 0, 0]; S.pocket = [0, 0, 0]; S.attempts = [0, 0, 0];
    showIntro(0);
  }

  function doAction(act, data) {
    Sound.synth('tick');
    switch (act) {
      case 'start': showIntro(0); break;
      case 'level': showIntro(clamp(parseInt(data.li, 10) || 0, 0, LEVELS.length - 1)); break;
      case 'build': startBuild(); break;
      case 'retry': backToBuild(); break;
      case 'retrynapkin': backToBuild(); if (!S.napkin) toggleNapkin(); break;
      case 'next': nextLevel(); break;
      case 'again': restartGame(); break;
      case 'menu': Sound.rolling(false, 0); S.world = null; showTitle(); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ particles
  function spawn(p) {
    if (S.particles.length > 700) return;
    p.t = 0;
    if (p.rot == null) p.rot = 0;
    S.particles.push(p);
  }
  function confetti() {
    const W = S.world;
    const c = W ? W.cart : S.idleCart;
    const cols = ['#ffd24a', '#ff6b6b', '#6bd0ff', '#8dff6b', '#ff9df2', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      spawn({ type: 'confetti', x: c.cx + rnd(-2.5, 2.5), y: c.cy - rnd(1, 4), vx: rnd(-3, 3), vy: rnd(-6, -1), g: 0.25, drag: 1.2,
        life: rnd(2, 3.5), rot: rnd(0, 6), vr: rnd(-10, 10), color: pick(cols) });
    }
  }
  function spillCargo() {
    if (S.tf.spilled || !S.world) return;
    S.tf.spilled = true;
    const c = S.world.cart, P = c.p;
    const vx = (P[0].vx + P[1].vx) / 2, vy = (P[0].vy + P[1].vy) / 2;
    const kind = S.level.cargo;
    const n = kind === 'anvils' ? 3 : kind === 'granny' ? 5 : 6;
    for (let i = 0; i < n; i++) {
      let item = kind === 'cabbages' ? 'cabbage' : kind === 'anvils' ? 'anvil' : (i === 0 ? 'granny' : 'cat');
      spawn({ type: 'cargo', item, x: c.cx + rnd(-0.5, 0.5), y: c.cy - 0.6, vx: vx * 0.6 + rnd(-2.5, 2.5),
        vy: vy * 0.4 + (item === 'anvil' ? rnd(-1, 1) : rnd(-6, -3)), g: item === 'anvil' ? 1.3 : 1, life: 7, rot: rnd(0, 6), vr: rnd(-6, 6), sinks: true, cat: i });
    }
  }
  function updateParticles(dt) {
    const river = S.level ? S.level.river : 99;
    for (const p of S.particles) {
      p.t += dt;
      if (p.g) p.vy += 9.8 * p.g * dt;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
      if (p.sinks && p.y > river) {
        const f = Math.exp(-5 * dt); p.vx *= f; p.vy *= f;
        const floats = p.type === 'cargo' && p.item !== 'anvil';
        p.vy -= (floats ? 14 : 7.5 * p.g) * dt;
        if (floats) p.vr *= f;
        if (!p.wet) { p.wet = true; gooSplash(p.x, 0.8, false); }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.type === 'drop' && p.y > river + 0.05 && p.vy > 0) p.t = p.life;
    }
    S.particles = S.particles.filter((p) => p.t < p.life);
  }
  function gooSplash(x, strength, big) {
    const n = big ? 26 : 9;
    for (let i = 0; i < n; i++) {
      spawn({ type: 'drop', x: x + rnd(-0.4, 0.4) * (big ? 1.6 : 1), y: S.level.river - 0.05, vx: rnd(-2.5, 2.5) * strength,
        vy: -rnd(2, big ? 7 : 4) * strength, g: 1, life: 2, size: rnd(0.05, big ? 0.14 : 0.09) });
    }
  }

  function updateDebris(dt) {
    const L = S.level;
    for (const d of S.debris) {
      d.t += dt;
      d.vy += 9.8 * dt;
      if (d.y > L.river) {
        const f = Math.exp(-4 * dt); d.vx *= f; d.vy *= f; d.va *= f; d.vy -= 6.5 * dt;
        if (!d.wet) { d.wet = true; gooSplash(d.x, 0.7, false); }
      }
      d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
    }
    S.debris = S.debris.filter((d) => d.t < 9);
  }

  // ------------------------------------------------------------ sim events
  function handleEvents() {
    const W = S.world;
    for (const e of W.events) {
      if (e.type === 'break') onBreak(e);
      else if (e.type === 'creak') onCreak(e);
      else if (e.type === 'splash') onSplash(e);
      else if (e.type === 'weld') onWeld(e);
    }
    W.events.length = 0;
  }
  function onBreak(e) {
    const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    const ang = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
    S.debris.push({ x: (e.x1 + mx) / 2, y: (e.y1 + my) / 2, a: ang, len: len / 2, vx: e.vx1, vy: e.vy1, va: rnd(-5, 5), mat: e.mat, t: 0 });
    S.debris.push({ x: (e.x2 + mx) / 2, y: (e.y2 + my) / 2, a: ang, len: len / 2, vx: e.vx2, vy: e.vy2, va: rnd(-5, 5), mat: e.mat, t: 0 });
    if (e.mat === 'iron') {
      Sound.play('clang', 0.8, rnd(0.9, 1.1), 70);
      for (let i = 0; i < 14; i++) spawn({ type: 'spark', x: mx, y: my, vx: rnd(-5, 5), vy: rnd(-6, 1), g: 0.6, life: rnd(0.3, 0.7) });
    } else {
      Sound.play('crack', e.mat === 'rope' ? 0.6 : 0.9, e.mat === 'rope' ? 1.6 : rnd(0.9, 1.15), 70);
      const col = e.mat === 'rope' ? '#e3cb8e' : e.mat === 'road' ? '#9a6532' : '#d29c58';
      for (let i = 0; i < 12; i++) spawn({ type: 'splinter', x: mx, y: my, vx: rnd(-3.5, 3.5), vy: rnd(-4, 1), g: 1, life: rnd(0.8, 1.6), rot: rnd(0, 6), vr: rnd(-14, 14), color: col, sinks: true });
    }
    S.shake = Math.min(1.2, S.shake + 0.55);
    S.tf.breaks++;
    failureDrama(e.mat, pickFresh('brk', TXT.brk));
  }
  function failureDrama(kind, line) {
    if (!S.tf.firstBreak) {
      S.tf.firstBreak = kind;
      S.tf.brkSaidAt = S.time;
      S.slowmo = 0.55;
      S.flash = 0.25;
      Sound.say('vUhOh');
      gobSay('Uh oh. ' + line, 'shock', 2.5);
    } else if (S.time - S.tf.brkSaidAt > 2.5 && !S.world.outcome) {
      S.tf.brkSaidAt = S.time;
      gobSay(line, 'shock', 2);
    }
  }
  function onWeld(e) {
    Sound.play('crack', 0.55, 1.35, 90);
    for (let i = 0; i < 7; i++) spawn({ type: 'splinter', x: e.x, y: e.y, vx: rnd(-2, 2), vy: rnd(-3, 0.5), g: 1, life: rnd(0.6, 1.2), rot: rnd(0, 6), vr: rnd(-12, 12), color: '#9a6532', sinks: true });
    S.tf.welds = (S.tf.welds || 0) + 1;
    if (S.tf.welds <= 3) spawn({ type: 'text', x: e.x, y: e.y - 0.45, vx: 0, vy: -0.5, life: 1.2, text: 'joint bent!', color: '#ffb36b' });
    S.shake = Math.min(1.2, S.shake + 0.3);
    failureDrama('weld', pick(['That joint just folded like a goblin lawn chair!', 'The planks are bending at the joint!', 'Ooh, it kinked. Kinks are bad.']));
  }
  function onCreak() {
    if (S.tf.creak || S.tf.firstBreak) return;
    S.tf.creak = true;
    Sound.play('crack', 0.25, 0.55, 300);
    gobSay(pickFresh('creak', TXT.creak), 'worried', 2.5);
  }
  function onSplash(e) {
    if (e.big) {
      Sound.play('splash', 0.9, 1, 500);
      gooSplash(e.x, 1.2, true);
      S.shake = Math.min(1.2, S.shake + 0.4);
    } else {
      gooSplash(e.x, 0.6, false);
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    S.time += dt;
    // scheduled callbacks
    if (S.later.length) {
      const due = S.later.filter((l) => l.t <= S.time);
      S.later = S.later.filter((l) => l.t > S.time);
      for (const l of due) { try { l.fn(); } catch (e) { /* ignore */ } }
    }
    // goblin idle animation
    const g = S.gob;
    g.moodT -= dt; g.talkT -= dt;
    g.blinkT -= dt;
    if (g.blinkT <= 0) { g.blink = 0.13; g.blinkT = rnd(2, 5); }
    if (g.blink > 0) g.blink -= dt;
    if (S.bubbleT > 0) { S.bubbleT -= dt; if (S.bubbleT <= 0) el.bubble.classList.add('hidden'); }

    let lookX = S.mouse.lx, lookY = S.mouse.ly;

    if (S.mode === 'build') {
      S.timer -= dt;
      if (S.timer <= 10 && !S.flags.warned10) {
        S.flags.warned10 = true;
        gobSay(pickFresh('hurry', TXT.hurry), 'worried', 3.5);
        Sound.synth('blip');
      }
      g.base = S.timer < 10 ? 'worried' : 'neutral';
      if (S.timer <= 0) { startTest(true); }
      S.tipT -= dt;
      if (S.tipT <= 0) {
        if (S.bubbleT <= 0) gobSay(pickFresh('tips', TXT.tips), 'neutral', 6);
        S.tipT = 17;
      }
      // hover for demolish
      S.hoverBeam = (S.tool === 'demolish' && S.mouse.inside) ? beamNear(S.mouse.wx, S.mouse.wy, 0.3) : null;
    }

    if ((S.mode === 'test' || S.mode === 'result') && S.world) {
      const W = S.world;
      let scale = 1;
      if (S.slowmo > 0) { S.slowmo -= dt; scale = 0.3; }
      const frozen = W.outcome && W.t - W.outcome.t > 14;
      if (!frozen) {
        S.acc += dt * scale;
        let steps = 0;
        while (S.acc >= STEP && steps < 4) {
          Sim.step(W, STEP);
          handleEvents();
          S.acc -= STEP; steps++;
        }
        if (steps >= 4) S.acc = 0;
      }
      const cs = Sim.cartState(W);
      // chimney smoke
      S.tf.smokeT -= dt;
      if (S.tf.smokeT <= 0 && W.cart.motor && cs.cy < S.level.river - 0.3) {
        S.tf.smokeT = 0.09;
        const p = cartLocal(W.cart, -0.7, -1.42);
        spawn({ type: 'smoke', x: p.x, y: p.y, vx: -cs.vx * 0.2 + rnd(-0.2, 0.2), vy: rnd(-1.2, -0.6), life: 1.2, size: rnd(0.1, 0.16) });
      }
      const moving = Math.abs(cs.vx) > 0.4 && cs.anyContact && cs.cy < S.level.river - 1;
      Sound.rolling(moving && S.mode === 'test', clamp(Math.abs(cs.vx) / 3, 0, 1) * 0.4);
      if (!W.outcome) {
        g.base = W.maxStress > 0.75 ? 'worried' : 'neutral';
        if (!S.tf.half && S.tf.breaks === 0 && !S.tf.firstBreak && cs.cx > (S.level.left + S.level.right) / 2) {
          S.tf.half = true;
          gobSay(pick(['Halfway! Nobody breathe!', "It's holding! IT'S HOLDING!", "Don't jinx it, don't jinx it..."]), 'worried', 2);
        }
        if (cs.vy > 4 && !cs.anyContact && !S.tf.fallSaid) { S.tf.fallSaid = true; gobSay(pick(['NOOOOO!', 'Aaaaaah!', 'Not the cargo!']), 'shock', 2); }
      }
      if (W.outcome && S.mode === 'test') {
        if (!S.outcomeAt) onOutcome(W.outcome);
        if (S.time - S.outcomeAt > (W.outcome.success ? 1.4 : 1.6)) showResult();
      }
      const sp = w2s(cs.cx, cs.cy);
      lookX = sp.x; lookY = sp.y;
    }

    // eyes follow mouse or cart
    const gx = GOB_X, gy = LH - BOT - 70;
    g.look.x = lerp(g.look.x, clamp((lookX - gx) / 300, -1, 1), Math.min(1, dt * 8));
    g.look.y = lerp(g.look.y, clamp((lookY - gy) / 250, -1, 1), Math.min(1, dt * 8));

    updateParticles(dt);
    if (S.level) updateDebris(dt);
    S.shake = Math.max(0, S.shake - dt * 2.8);
    S.flash = Math.max(0, S.flash - dt);
    updateHUD();
  }

  function cartLocal(cart, lx, ly) {
    const P = cart.p;
    const ax = P[1].x - P[0].x, ay = P[1].y - P[0].y, al = Math.hypot(ax, ay) || 1;
    const ux = ax / al, uy = ay / al;
    const ox = (P[0].x + P[1].x) / 2, oy = (P[0].y + P[1].y) / 2;
    return { x: ox + ux * lx - uy * ly, y: oy + uy * lx + ux * ly };
  }

  // ------------------------------------------------------------------- HUD
  const hud = {};
  function setText(node, key, v) { if (hud[key] !== v) { hud[key] = v; node.textContent = v; } }
  function setHTML(node, key, v) { if (hud[key] !== v) { hud[key] = v; node.innerHTML = v; } }
  function setClass(node, key, cls, on) { const k = key + cls; if (hud[k] !== on) { hud[k] = on; node.classList.toggle(cls, on); } }
  function updateHUD() {
    const L = S.level;
    if (!L) return;
    setText(el.lvlName, 'ln', 'Level ' + L.id + ': ' + L.name);
    setText(el.cargoName, 'cn', 'Cargo: ' + L.cargoName + ' (' + L.cartMass + ' kg)');
    const sp = spent();
    setHTML(el.budgetLabel, 'bl', 'Gold spent: <b>' + sp + '</b> / ' + L.budget + ' &nbsp;<span style="opacity:.75">(' + (L.budget - sp) + ' left)</span>');
    const frac = clamp(sp / L.budget, 0, 1);
    const w = Math.round(frac * 100) + '%';
    if (hud.bw !== w) { hud.bw = w; el.budgetFill.style.width = w; }
    setClass(el.budgetFill, 'bf', 'warn', frac > 0.8 && frac < 0.97);
    setClass(el.budgetFill, 'bf', 'full', frac >= 0.97);
    if (S.mode === 'build') {
      setText(el.timerVal, 'tv', fmtTime(S.timer));
      setClass(el.timerBox, 'tb', 'urgent', S.timer <= 10);
      setClass(el.timerBox, 'tb', 'off', false);
    } else {
      setText(el.timerVal, 'tv', S.mode === 'intro' ? fmtTime(L.time) : '--');
      setClass(el.timerBox, 'tb', 'urgent', false);
      setClass(el.timerBox, 'tb', 'off', S.mode !== 'intro');
    }
    for (const b of el.mats.children) setClass(b, 'm' + b.dataset.mat, 'active', S.tool === 'build' && S.mat === b.dataset.mat);
    setClass(el.btnDemolish, 'dm', 'active', S.tool === 'demolish');
    setClass(el.btnNapkin, 'nk', 'active', S.napkin);
    setClass(el.btnGo, 'go', 'ready', hasRoad());
    if (S.world) {
      const pct = Math.round(Math.min(9.99, S.world.maxStress) * 100);
      setText(el.stressVal, 'sv', pct + '%');
      const col = pct < 60 ? '#9dff7a' : pct < 85 ? '#ffd24a' : '#ff6b5a';
      if (hud.sc !== col) { hud.sc = col; el.stressVal.style.color = col; }
    }
  }

  function buildMatButtons() {
    el.mats.innerHTML = '';
    for (const id of Sim.MAT_ORDER) {
      const m = MATS[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mat';
      b.dataset.mat = id;
      b.title = m.name + ' - ' + m.blurb;
      b.innerHTML = '<span class="sw sw-' + id + '"></span><span class="mn">' + m.name + '</span>' +
        '<span class="mc">' + m.cost + 'g/m &middot; max ' + m.maxLen.toFixed(1) + 'm</span><kbd>' + m.key + '</kbd>';
      b.addEventListener('click', () => { if (S.mode === 'build') selectMat(id); });
      el.mats.appendChild(b);
    }
  }

  // ----------------------------------------------------------------- input
  function updateMouse(e) {
    const r = canvas.getBoundingClientRect();
    const rw = r.width || LW, rh = r.height || LH;
    S.mouse.lx = (e.clientX - r.left) * LW / rw;
    S.mouse.ly = (e.clientY - r.top) * LH / rh;
    const w = s2w(S.mouse.lx, S.mouse.ly);
    S.mouse.wx = w.x; S.mouse.wy = w.y;
    S.mouse.inside = S.mouse.ly > TOP && S.mouse.ly < LH - BOT;
  }

  function complain(reason, gx, gy) {
    const f = COMPLAIN[reason];
    const text = f ? f(S.mat) : 'Grubnik says no.';
    gobSay(text, 'worried', 3);
    Sound.synth('buzz');
    spawn({ type: 'text', x: gx, y: gy - 0.4, vx: 0, vy: -0.6, life: 1.1, text: SHORT[reason] || 'Nope!', color: '#ff8b7a' });
  }

  function placeTo(start, gx, gy, chain) {
    const r = tryAddBeam(start, gx, gy, S.mat);
    if (r.ok) {
      Sound.play('thunk', 0.55, rnd(0.9, 1.15), 40);
      for (let i = 0; i < 5; i++) spawn({ type: 'dust', x: gx, y: gy, vx: rnd(-0.8, 0.8), vy: rnd(-0.8, 0.3), life: 0.5, size: rnd(0.06, 0.12) });
      if (chain) S.drawStart = r.end.id;
      S.flags.placed = (S.flags.placed || 0) + 1;
      S.tipT = Math.max(S.tipT, 14);
      if (!S.flags.broke90 && spent() > 0.9 * S.level.budget) {
        S.flags.broke90 = true;
        gobSay('Nearly out of gold! Grubnik may have to sell a kidney. Not HIS kidney.', 'worried', 3.5);
      } else if (r.replaced) gobSay('Swapped it for ' + MATS[S.mat].name + '. Upgrades!', 'happy', 2);
      else if (Math.random() < 0.14) gobSay(pickFresh('place', TXT.place), 'happy', 2);
      else setMood('happy', 0.5);
      return true;
    }
    complain(r.reason, gx, gy);
    return false;
  }

  function primaryDown() {
    const gx = Math.round(S.mouse.wx), gy = Math.round(S.mouse.wy);
    if (S.tool === 'demolish') { demolishAt(S.mouse.wx, S.mouse.wy); return; }
    if (S.drawStart == null) {
      const p = pointAt(gx, gy);
      if (p && Math.hypot(S.mouse.wx - gx, S.mouse.wy - gy) < 0.55) {
        S.drawStart = p.id;
        S.drag = { x: gx, y: gy };
        Sound.synth('tick');
      } else {
        complain('nostart', gx, gy);
      }
      return;
    }
    const start = pointById(S.drawStart);
    if (!start) { S.drawStart = null; return; }
    if (start.x === gx && start.y === gy) { S.drawStart = null; S.drag = null; return; }
    const target = pointAt(gx, gy);
    if (target && Math.hypot(S.mouse.wx - gx, S.mouse.wy - gy) < 0.55) {
      const prob = beamProblem(start, gx, gy, S.mat);
      if (prob === 'toolong' || prob === 'rock' || prob === 'dup') {
        S.drawStart = target.id;
        S.drag = { x: gx, y: gy };
        Sound.synth('tick');
        return;
      }
    }
    placeTo(start, gx, gy, true);
  }
  function primaryUp() {
    if (!S.drag) return;
    const d = S.drag;
    S.drag = null;
    const gx = Math.round(S.mouse.wx), gy = Math.round(S.mouse.wy);
    if (gx === d.x && gy === d.y) return; // plain click: stay in chain mode
    const start = pointById(S.drawStart);
    if (!start) return;
    if (placeTo(start, gx, gy, false)) S.drawStart = null;
  }
  function secondary() {
    if (S.drawStart != null) { S.drawStart = null; S.drag = null; Sound.synth('tick'); return; }
    demolishAt(S.mouse.wx, S.mouse.wy);
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      updateMouse(e);
      if (S.mode !== 'build') return;
      e.preventDefault();
      if (e.button === 2) { secondary(); return; }
      if (e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      primaryDown();
    });
    canvas.addEventListener('pointermove', (e) => { updateMouse(e); });
    canvas.addEventListener('pointerup', (e) => {
      updateMouse(e);
      if (S.mode === 'build' && e.button === 0) primaryUp();
    });
    canvas.addEventListener('pointerleave', () => { S.mouse.inside = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('pointerdown', () => Sound.unlock(), true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);

    // buttons never keep focus (so Space/Enter only trigger our shortcuts)
    stage.addEventListener('mousedown', (e) => { if (e.target.closest && e.target.closest('button')) e.preventDefault(); });

    el.btnGo.addEventListener('click', () => startTest(false));
    el.btnUndo.addEventListener('click', doUndo);
    el.btnClear.addEventListener('click', doClear);
    el.btnDemolish.addEventListener('click', () => { if (S.mode === 'build') toggleDemolish(); });
    el.btnNapkin.addEventListener('click', () => { if (S.mode === 'build') toggleNapkin(); });
    el.btnStop.addEventListener('click', backToBuild);
    el.btnSound.addEventListener('click', toggleSound);
    el.panel.addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (b) doAction(b.dataset.act, b.dataset);
    });
  }

  function toggleSound() {
    Sound.unlock();
    Sound.setMuted(!Sound.isMuted());
    el.btnSound.textContent = Sound.isMuted() ? 'Sound: off' : 'Sound: on';
  }

  function onKey(e) {
    Sound.unlock();
    const k = e.key;
    const confirm = k === 'Enter' || k === ' ' || k === 'Spacebar';
    if (confirm) e.preventDefault();
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if (e.repeat && confirm) return;
    switch (S.mode) {
      case 'title': if (confirm) doAction('start', {}); return;
      case 'intro': if (confirm) doAction('build', {}); else if (k === 'Escape') doAction('menu', {}); return;
      case 'victory': if (confirm) doAction('again', {}); return;
      case 'result':
        if (k === 'r' || k === 'R') backToBuild();
        else if (S.lastSuccess && (confirm || k === 'n' || k === 'N')) nextLevel();
        else if (!S.lastSuccess && confirm) backToBuild();
        return;
      case 'test':
        if (k === 'r' || k === 'R' || k === 'Escape') backToBuild();
        return;
      case 'build':
        if (k >= '1' && k <= '4') selectMat(Sim.MAT_ORDER[Number(k) - 1]);
        else if (k === 'x' || k === 'X') toggleDemolish();
        else if (k === 'z' || k === 'Z') doUndo();
        else if (k === 'h' || k === 'H') toggleNapkin();
        else if (k === 'Escape') { S.drawStart = null; S.drag = null; if (S.tool === 'demolish') S.tool = 'build'; }
        else if (confirm) startTest(false);
        return;
      default: return;
    }
  }

  // --------------------------------------------------------------- drawing
  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function label(x, y, text, color, font) { S.labels.push({ x, y, text, color: color || '#fff4c8', font: font || 'bold 14px "Trebuchet MS", sans-serif' }); }

  function render() {
    const k = S.k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    if (!S.level || !S.bg) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH); return; }
    drawSky();
    let sx = 0, sy = 0;
    if (S.shake > 0) { sx = rnd(-1, 1) * S.shake * 7; sy = rnd(-1, 1) * S.shake * 7; }
    ctx.save();
    ctx.translate(sx * 0.3, sy * 0.3);
    drawMountains();
    ctx.restore();
    const c = S.cam;
    ctx.setTransform(k * c.s, 0, 0, k * c.s, k * (c.tx + sx), k * (c.ty + sy));
    drawRavine();
    drawPosts();
    drawRocks();
    drawDecor();
    const building = S.mode === 'build' || S.mode === 'intro';
    if (building) drawGrid();
    if (S.napkin && building) drawNapkin();
    if (S.world) drawWorldBridge(); else drawDesignBridge();
    drawAnchors();
    drawDebris();
    drawCart(S.world ? S.world.cart : S.idleCart);
    drawGoo();
    drawParticles();
    if (S.mode === 'build') drawPreview();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawLabels();
    drawGoblinPortrait();
    if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.9).toFixed(3) + ')'; ctx.fillRect(0, 0, LW, LH); }
  }

  function drawSky() {
    const pal = SKY[S.li] || SKY[0];
    const gY = S.bg.groundY;
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(200, gY + 120));
    g.addColorStop(0, pal.top); g.addColorStop(0.55, pal.mid); g.addColorStop(1, pal.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
    if (pal.stars) {
      ctx.fillStyle = '#fff';
      for (const s of S.bg.stars) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(S.time * 1.3 + s.p));
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }
    const sx = LW * 0.8, sy = Math.max(110, gY * 0.42);
    const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 140);
    glow.addColorStop(0, pal.glow); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 140, sy - 140, 280, 280);
    ctx.fillStyle = pal.sun;
    circle(sx, sy, 40);
    if (pal.stars) {
      ctx.fillStyle = 'rgba(160,160,190,0.35)';
      circle(sx - 12, sy - 8, 8); circle(sx + 14, sy + 10, 6); circle(sx + 4, sy - 18, 4);
    }
    for (const cl of S.bg.clouds) {
      const x = ((cl.x + S.time * cl.v) % (LW + 300)) - 150;
      ctx.fillStyle = pal.cloud;
      const s = cl.s;
      ctx.beginPath();
      ctx.ellipse(x, cl.y, 60 * s, 18 * s, 0, 0, TAU);
      ctx.ellipse(x - 30 * s, cl.y + 4 * s, 34 * s, 14 * s, 0, 0, TAU);
      ctx.ellipse(x + 26 * s, cl.y - 8 * s, 36 * s, 20 * s, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawMountains() {
    const pal = SKY[S.li] || SKY[0];
    for (const [pts, col] of [[S.bg.far, pal.m1], [S.bg.near, pal.m2]]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], LH);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(pts[pts.length - 1][0], LH);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRavine() {
    const L = S.level;
    const g = ctx.createLinearGradient(0, 0, 0, L.river + 1);
    g.addColorStop(0, '#5e4030'); g.addColorStop(1, '#1d130d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L.left - 0.5, L.river + 4);
    for (const p of S.bg.rim) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(L.right + 0.5, L.river + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 0.05;
    for (const c of S.bg.cracks) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[4], c[5]); ctx.stroke();
    }
    // wreck of the Mk. I cart and a skull, for motivation
    const wx = L.left + 1.3, wy = L.river;
    ctx.save();
    ctx.translate(wx, wy); ctx.rotate(-0.5);
    ctx.fillStyle = '#4d3219'; ctx.strokeStyle = '#1e1208'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(-0.8, -0.8); ctx.lineTo(0.8, -0.8); ctx.lineTo(0.65, 0); ctx.lineTo(-0.65, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1a0e'; circle(0.5, 0.05, 0.26);
    ctx.restore();
    label(wx, wy - 1.05, 'Mk. I', 'rgba(255,240,200,0.55)', 'bold 12px "Trebuchet MS", sans-serif');
  }

  function drawPosts() {
    const L = S.level;
    for (const p of L.posts) {
      const x = p.x, top = p.top;
      ctx.strokeStyle = '#4a2d12'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
      line(x - 1.0, 0, x, top + 1.6);
      line(x + 1.0, 0, x, top + 1.6);
      ctx.fillStyle = '#8a5a2e'; ctx.strokeStyle = '#3a220d'; ctx.lineWidth = 0.05;
      ctx.fillRect(x - 0.17, top, 0.34, -top);
      ctx.strokeRect(x - 0.17, top, 0.34, -top);
      ctx.strokeStyle = 'rgba(40,20,5,0.45)'; ctx.lineWidth = 0.03;
      for (let y = top + 0.5; y < -0.2; y += 0.7) line(x - 0.15, y, x + 0.15, y + 0.1);
      ctx.fillStyle = '#6b4424';
      ctx.fillRect(x - 0.45, top + 0.35, 0.9, 0.14);
      // pennant
      const wave = Math.sin(S.time * 4 + x) * 0.08;
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.moveTo(x, top - 0.75); ctx.lineTo(x + 0.7, top - 0.6 + wave); ctx.lineTo(x, top - 0.42); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a220d'; ctx.lineWidth = 0.05; line(x, top, x, top - 0.8);
    }
  }

  function drawRocks() {
    const L = S.level, vis = S.vis;
    for (let i = 0; i < L.rocks.length; i++) {
      const r = L.rocks[i];
      if (r.spire) { drawTooth(r); continue; }
      const f = S.bg.faces[i];
      const x0 = Math.max(r.x0, vis.x0 - 1), x1 = Math.min(r.x1, vis.x1 + 1);
      const yb = Math.min(r.y1, vis.y1 + 1);
      const leftFace = r.x0 > vis.x0 - 1, rightFace = r.x1 < vis.x1 + 1;
      ctx.beginPath();
      ctx.moveTo(x0, r.y0);
      ctx.lineTo(x1, r.y0);
      if (rightFace) { for (const p of f.right) if (r.y0 + p[1] <= yb) ctx.lineTo(r.x1 + p[0], r.y0 + p[1]); }
      ctx.lineTo(x1, yb);
      ctx.lineTo(x0, yb);
      if (leftFace) { for (let k = f.left.length - 1; k >= 0; k--) { const p = f.left[k]; if (r.y0 + p[1] <= yb) ctx.lineTo(r.x0 - p[0], r.y0 + p[1]); } }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, r.y0, 0, r.y0 + 9);
      g.addColorStop(0, '#9a6a40'); g.addColorStop(1, '#4a2f1c');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(50,28,12,0.35)'; ctx.lineWidth = 0.07;
      for (let y = r.y0 + 0.8; y < yb; y += 0.95) {
        ctx.beginPath();
        for (let x = x0; x <= x1 + 0.01; x += 0.5) {
          const yy = y + Math.sin(x * 1.3 + y * 2.1) * 0.08;
          if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,22,10,0.35)';
      for (const pb of f.pebbles) {
        const px = x0 + pb[0] * (x1 - x0), py = r.y0 + 0.4 + pb[1] * Math.min(8, yb - r.y0);
        ctx.beginPath(); ctx.ellipse(px, py, pb[2] * 1.6, pb[2], 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // grass
      ctx.fillStyle = '#5c9e3a';
      ctx.fillRect(x0, r.y0 - 0.06, x1 - x0, 0.17);
      ctx.fillStyle = '#76b94a';
      ctx.fillRect(x0, r.y0 - 0.06, x1 - x0, 0.05);
      ctx.fillStyle = '#5c9e3a';
      for (const t of f.tufts) {
        const tx = x0 + t[0] * (x1 - x0);
        ctx.beginPath(); ctx.moveTo(tx - 0.07, r.y0); ctx.lineTo(tx, r.y0 - t[1]); ctx.lineTo(tx + 0.07, r.y0); ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawTooth(r) {
    const cx = (r.x0 + r.x1) / 2;
    ctx.beginPath();
    ctx.moveTo(r.x0 - 0.06, r.y0 + 9);
    ctx.lineTo(r.x0 - 0.03, r.y0 + 0.5);
    ctx.quadraticCurveTo(r.x0 - 0.06, r.y0 - 0.14, r.x0 + 0.24, r.y0 - 0.08);
    ctx.quadraticCurveTo(cx, r.y0 + 0.07, r.x1 - 0.24, r.y0 - 0.08);
    ctx.quadraticCurveTo(r.x1 + 0.06, r.y0 - 0.14, r.x1 + 0.03, r.y0 + 0.5);
    ctx.lineTo(r.x1 + 0.06, r.y0 + 9);
    ctx.closePath();
    const g = ctx.createLinearGradient(r.x0, 0, r.x1, 0);
    g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#cdbb90');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,70,40,0.6)'; ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(cx - 0.1, r.y0 + 0.4); ctx.lineTo(cx + 0.08, r.y0 + 1.0); ctx.lineTo(cx - 0.05, r.y0 + 1.6); ctx.stroke();
    ctx.fillStyle = '#e7b92e';
    ctx.fillRect(cx + 0.12, r.y0 + 1.9, 0.22, 0.18);
    label(cx, r.y0 + 2.8, "troll's tooth", 'rgba(255,245,210,0.6)', 'bold 12px "Trebuchet MS", sans-serif');
  }

  function drawDecor() {
    const L = S.level, t = S.time;
    // finish flag
    const fx = L.right + 1.6;
    ctx.fillStyle = '#3a220d';
    ctx.fillRect(fx - 0.04, -2.4, 0.08, 2.4);
    const cols = 5, rows = 3, fw = 1.0, fh = 0.6, cw = fw / cols, ch = fh / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = fx + i * cw;
        const wv = Math.sin(t * 5 + i * 0.9) * 0.06 * (i / cols);
        ctx.fillStyle = (i + j) % 2 ? '#1a1a1a' : '#f4f4f4';
        ctx.fillRect(x, -2.4 + j * ch + wv, cw + 0.01, ch + 0.01);
      }
    }
    label(fx + 0.5, -2.75, 'FINISH', '#fff4c8', 'bold 13px "Trebuchet MS", sans-serif');
    // company sign on the left
    const sx = L.left - 5.9;
    ctx.fillStyle = '#4a2d12';
    ctx.fillRect(sx - 0.9, -1.2, 0.1, 1.2);
    ctx.fillRect(sx + 0.8, -1.2, 0.1, 1.2);
    ctx.fillStyle = '#9a6532'; ctx.strokeStyle = '#3a220d'; ctx.lineWidth = 0.05;
    ctx.fillRect(sx - 1.1, -2.0, 2.2, 0.85);
    ctx.strokeRect(sx - 1.1, -2.0, 2.2, 0.85);
    label(sx, -1.72, 'GRUBNIK & SONS', '#fff0c0', 'bold 12px "Trebuchet MS", sans-serif');
    label(sx, -1.43, 'bridges* (*no refunds)', '#f5dfb0', '11px "Trebuchet MS", sans-serif');
    // floating skull in the goo
    const kx = L.right - 1.2, ky = L.river - 0.12 + Math.sin(t * 1.7) * 0.05;
    ctx.fillStyle = '#efe6cc';
    circle(kx, ky, 0.2);
    ctx.fillRect(kx - 0.12, ky + 0.08, 0.24, 0.14);
    ctx.fillStyle = '#2a1a0e';
    circle(kx - 0.07, ky - 0.01, 0.05); circle(kx + 0.07, ky - 0.01, 0.05);
  }

  function getReach() {
    if (S.drawStart == null) return null;
    const key = S.drawStart + '|' + S.mat + '|' + S.ver;
    if (key === S.reachKey) return S.reach;
    const st = pointById(S.drawStart);
    const set = new Set();
    if (st) {
      const R = Math.floor(MATS[S.mat].maxLen);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (!dx && !dy) continue;
        const x = st.x + dx, y = st.y + dy;
        if (!Sim.checkBeam(S.level, st.x, st.y, x, y, S.mat)) set.add(x + ',' + y);
      }
    }
    S.reachKey = key; S.reach = set;
    return set;
  }

  function drawGrid() {
    const L = S.level, vis = S.vis;
    const reach = S.mode === 'build' ? getReach() : null;
    const xs = Math.ceil(vis.x0), xe = Math.floor(vis.x1);
    const ys = Math.ceil(Math.max(vis.y0, L.view.y0)), ye = Math.floor(L.river - 1);
    for (let y = ys; y <= ye; y++) {
      for (let x = xs; x <= xe; x++) {
        if (Sim.pointInRock(L, x, y, 0.05)) continue;
        const inReach = reach && reach.has(x + ',' + y);
        const r = inReach ? 0.07 : 0.045;
        ctx.fillStyle = inReach ? 'rgba(255,236,150,0.8)' : 'rgba(255,255,255,0.22)';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  function drawNapkin() {
    const L = S.level;
    ctx.setLineDash([0.16, 0.1]);
    ctx.lineWidth = 0.07;
    ctx.lineCap = 'round';
    for (const s of L.napkin) {
      ctx.strokeStyle = NAPKIN[s[0]];
      line(s[1], s[2], s[3], s[4]);
      if (s[0] !== 'road') label((s[1] + s[3]) / 2 + 0.25, (s[2] + s[4]) / 2, MATS[s[0]].name.split(' ')[0], NAPKIN[s[0]], 'bold 11px "Trebuchet MS", sans-serif');
    }
    ctx.setLineDash([]);
    label((L.left + L.right) / 2, L.view.y0 + 0.6, "Snazzgit's napkin sketch (H to hide)", '#fff4c8', 'italic bold 14px "Trebuchet MS", sans-serif');
  }

  function drawBeam(x1, y1, x2, y2, mat, stress, danger) {
    const st = MSTYLE[mat];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-3 || !st) return;
    const k = clamp((stress - 0.3) / 0.7, 0, 1);
    let fill = k > 0 ? mixRgb(st.rgb, RED, k) : st.fill;
    if (danger) fill = '#ff5040';
    const ux = dx / len, uy = dy / len;
    let nx = -uy, ny = ux;
    if (ny > 0) { nx = -nx; ny = -ny; } // normal pointing up
    if (mat === 'road') {
      const off = st.w * 0.4;
      x1 -= nx * off; y1 -= ny * off; x2 -= nx * off; y2 -= ny * off;
    }
    ctx.lineCap = mat === 'rope' ? 'round' : 'butt';
    ctx.strokeStyle = st.edge; ctx.lineWidth = st.w + 0.05;
    line(x1 - ux * 0.02, y1 - uy * 0.02, x2 + ux * 0.02, y2 + uy * 0.02);
    ctx.strokeStyle = fill; ctx.lineWidth = st.w;
    line(x1, y1, x2, y2);
    if (mat === 'road') {
      const o = st.w * 0.32;
      ctx.strokeStyle = k > 0.4 ? 'rgba(255,210,190,0.7)' : st.hi; ctx.lineWidth = 0.045;
      line(x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o);
      ctx.strokeStyle = st.edge; ctx.lineWidth = 0.025;
      const hw = st.w / 2;
      for (let s = 0.5; s < len - 0.15; s += 0.5) {
        const px = x1 + ux * s, py = y1 + uy * s;
        line(px + nx * hw, py + ny * hw, px - nx * hw, py - ny * hw);
      }
    } else if (mat === 'wood') {
      ctx.strokeStyle = st.hi; ctx.lineWidth = 0.025;
      const o = st.w * 0.22;
      line(x1 + ux * 0.1 + nx * o, y1 + uy * 0.1 + ny * o, x2 - ux * 0.1 + nx * o, y2 - uy * 0.1 + ny * o);
    } else if (mat === 'iron') {
      ctx.fillStyle = st.hi;
      for (let s = 0.2; s < len - 0.1; s += 0.35) {
        ctx.fillRect(x1 + ux * s - 0.022, y1 + uy * s - 0.022, 0.044, 0.044);
      }
    } else if (mat === 'rope') {
      ctx.strokeStyle = st.edge; ctx.lineWidth = 0.028;
      ctx.setLineDash([0.05, 0.07]);
      line(x1, y1, x2, y2);
      ctx.setLineDash([]);
    }
  }

  function drawJoint(x, y) {
    ctx.fillStyle = '#2e241a'; circle(x, y, 0.08);
    ctx.fillStyle = '#b9a47c'; circle(x, y, 0.037);
  }

  function drawAnchors() {
    const L = S.level;
    const pulse = S.mode === 'build' && S.drawStart == null && S.tool === 'build';
    for (const a of L.anchors) {
      const x = a[0], y = a[1];
      ctx.fillStyle = '#2f363e'; circle(x, y, 0.19);
      ctx.fillStyle = '#9aa7b4'; circle(x, y, 0.135);
      ctx.strokeStyle = '#2f363e'; ctx.lineWidth = 0.04;
      line(x - 0.08, y, x + 0.08, y); line(x, y - 0.08, x, y + 0.08);
      if (pulse) {
        ctx.strokeStyle = 'rgba(255,215,90,' + (0.55 + 0.35 * Math.sin(S.time * 5)).toFixed(3) + ')';
        ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.arc(x, y, 0.27 + 0.05 * Math.sin(S.time * 5), 0, TAU); ctx.stroke();
      }
    }
  }

  function drawDesignBridge() {
    const m = ptMap();
    const danger = S.mode === 'build' && S.tool === 'demolish' ? S.hoverBeam : null;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of S.design.beams) {
        if ((b.mat === 'road') !== (pass === 1)) continue;
        const A = m[b.a], B = m[b.b];
        if (A && B) drawBeam(A.x, A.y, B.x, B.y, b.mat, 0, b === danger);
      }
    }
    for (const p of S.design.points) if (!p.anchor) drawJoint(p.x, p.y);
  }

  function drawWorldBridge() {
    const W = S.world;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of W.beams) {
        if (b.broken || b.mat.road !== (pass === 1)) continue;
        drawBeam(b.a.x, b.a.y, b.b.x, b.b.y, b.mat.id, Math.max(b.stress, b.bend || 0), false);
      }
    }
    for (const n of W.nodes) if (!n.anchor) drawJoint(n.x, n.y);
  }

  function drawDebris() {
    for (const d of S.debris) {
      const c = Math.cos(d.a) * d.len / 2, s = Math.sin(d.a) * d.len / 2;
      drawBeam(d.x - c, d.y - s, d.x + c, d.y + s, d.mat, 0, false);
    }
  }

  function drawPreview() {
    if (!S.mouse.inside && !S.drag) return;
    const gx = Math.round(S.mouse.wx), gy = Math.round(S.mouse.wy);
    if (S.tool === 'demolish') {
      const x = S.mouse.wx, y = S.mouse.wy;
      ctx.strokeStyle = '#ff5040'; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
      line(x - 0.18, y - 0.18, x + 0.18, y + 0.18); line(x - 0.18, y + 0.18, x + 0.18, y - 0.18);
      return;
    }
    const hp = pointAt(gx, gy);
    if (S.drawStart == null) {
      if (hp) {
        ctx.strokeStyle = '#fff4c8'; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 0.3, 0, TAU); ctx.stroke();
        label(hp.x, hp.y - 0.62, 'click to start a beam', '#fff4c8', 'bold 12px "Trebuchet MS", sans-serif');
      } else if (!Sim.pointInRock(S.level, gx, gy, 0.05)) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(gx, gy, 0.08);
      }
      return;
    }
    const st = pointById(S.drawStart);
    if (!st) return;
    ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(st.x, st.y, 0.28, 0, TAU); ctx.stroke();
    if (gx === st.x && gy === st.y) {
      label(st.x, st.y - 0.62, 'click elsewhere to build, here to stop', '#fff4c8', 'bold 12px "Trebuchet MS", sans-serif');
      return;
    }
    const reason = beamProblem(st, gx, gy, S.mat);
    const len = Math.hypot(gx - st.x, gy - st.y);
    const sty = MSTYLE[S.mat];
    ctx.globalAlpha = 0.85;
    ctx.setLineDash([0.18, 0.12]);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = reason ? '#ff4632' : sty.fill;
    ctx.lineWidth = reason ? 0.08 : sty.w;
    line(st.x, st.y, gx, gy);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = reason ? '#ff4632' : '#fff4c8';
    circle(gx, gy, 0.09);
    const cost = Sim.beamCost(S.mat, len);
    const text = reason ? (SHORT[reason] || 'Nope') + (reason === 'toolong' ? ' (max ' + MATS[S.mat].maxLen.toFixed(1) + ' m)' : '') : len.toFixed(1) + ' m \u00b7 ' + cost + 'g';
    label(gx, gy - 0.5, text, reason ? '#ff9b8a' : '#fff4c8');
  }

  function drawWheel(x, y, r, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.fillStyle = '#2b1e12'; circle(0, 0, r);
    ctx.fillStyle = '#8a643c'; circle(0, 0, r * 0.76);
    ctx.strokeStyle = '#2b1e12'; ctx.lineWidth = 0.05;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      line(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74, -Math.cos(a) * r * 0.74, -Math.sin(a) * r * 0.74);
    }
    ctx.fillStyle = '#9aa7b4'; circle(0, 0, r * 0.2);
    ctx.restore();
  }

  function drawCargoItem(item, x, y, s, rot, idx) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(s, s);
    if (item === 'cabbage') {
      ctx.fillStyle = '#6fb83a'; circle(0, 0, 0.2);
      ctx.strokeStyle = '#3f7a1c'; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.arc(-0.05, 0.02, 0.13, -1.2, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.06, 0.0, 0.1, 2.0, 4.4); ctx.stroke();
      ctx.fillStyle = '#9ad65f'; circle(-0.06, -0.07, 0.05);
    } else if (item === 'anvil') {
      ctx.fillStyle = '#474d56'; ctx.strokeStyle = '#1c1f24'; ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.17, 0.12); ctx.lineTo(0.17, 0.12); ctx.lineTo(0.1, 0.02); ctx.lineTo(0.08, -0.04);
      ctx.lineTo(0.3, -0.07); ctx.lineTo(0.26, -0.15); ctx.lineTo(-0.2, -0.15); ctx.lineTo(-0.23, -0.07);
      ctx.lineTo(-0.08, -0.04); ctx.lineTo(-0.1, 0.02); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-0.18, -0.14, 0.4, 0.03);
    } else if (item === 'cat') {
      const cols = ['#222', '#e38a2b', '#8a8a8a', '#f2e6d0', '#222'];
      ctx.fillStyle = cols[(idx || 0) % cols.length];
      circle(0, 0, 0.13);
      ctx.beginPath(); ctx.moveTo(-0.12, -0.04); ctx.lineTo(-0.09, -0.2); ctx.lineTo(-0.02, -0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.12, -0.04); ctx.lineTo(0.09, -0.2); ctx.lineTo(0.02, -0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe14a'; circle(-0.05, -0.01, 0.025); circle(0.05, -0.01, 0.025);
    } else if (item === 'granny') {
      ctx.fillStyle = '#8ab85a'; circle(0, 0, 0.24);
      ctx.fillStyle = '#c9c9c9'; circle(0, -0.27, 0.12); circle(-0.12, -0.18, 0.09); circle(0.12, -0.18, 0.09);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.arc(-0.08, -0.02, 0.06, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.08, -0.02, 0.06, 0, TAU); ctx.stroke();
      line(-0.02, -0.02, 0.02, -0.02);
      ctx.beginPath(); ctx.arc(0, 0.1, 0.06, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = '#8ab85a';
      ctx.beginPath(); ctx.moveTo(-0.2, -0.05); ctx.lineTo(-0.42, -0.14); ctx.lineTo(-0.22, 0.06); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.2, -0.05); ctx.lineTo(0.42, -0.14); ctx.lineTo(0.22, 0.06); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawCargoInCart(kind) {
    if (kind === 'cabbages') {
      const pos = [[-0.52, -1.06], [-0.14, -1.1], [0.24, -1.06], [-0.33, -1.34], [0.06, -1.36]];
      for (const p of pos) drawCargoItem('cabbage', p[0], p[1], 1, 0);
    } else if (kind === 'anvils') {
      drawCargoItem('anvil', -0.4, -1.08, 1.1, 0);
      drawCargoItem('anvil', 0.28, -1.08, 1.1, 0);
      drawCargoItem('anvil', -0.05, -1.38, 1.1, 0);
    } else if (kind === 'granny') {
      drawCargoItem('granny', -0.12, -1.28, 1, 0);
      drawCargoItem('cat', -0.62, -1.08, 1, 0, 0);
      drawCargoItem('cat', 0.3, -1.1, 1, 0, 1);
      drawCargoItem('cat', 0.12, -1.55, 0.9, 0, 2);
    }
  }

  function drawIntern(x, y, scared) {
    ctx.fillStyle = '#7dbb43';
    ctx.beginPath(); ctx.moveTo(x - 0.1, y - 0.02); ctx.lineTo(x - 0.34, y - 0.12); ctx.lineTo(x - 0.1, y + 0.08); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 0.1, y - 0.02); ctx.lineTo(x + 0.34, y - 0.12); ctx.lineTo(x + 0.1, y + 0.08); ctx.closePath(); ctx.fill();
    circle(x, y, 0.16);
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x - 0.15, y - 0.08, 0.3, 0.05);
    ctx.fillStyle = '#bfe3ff'; circle(x - 0.06, y - 0.055, 0.05); circle(x + 0.06, y - 0.055, 0.05);
    ctx.fillStyle = '#3b1a12';
    if (scared) circle(x, y + 0.08, 0.05);
    else { ctx.fillRect(x - 0.05, y + 0.06, 0.1, 0.025); }
  }

  function drawCart(cart) {
    if (!cart) return;
    const P = cart.p;
    const ax = P[1].x - P[0].x, ay = P[1].y - P[0].y, al = Math.hypot(ax, ay) || 1;
    const ux = ax / al, uy = ay / al;
    const ox = (P[0].x + P[1].x) / 2, oy = (P[0].y + P[1].y) / 2;
    const scared = !!(S.world && ((P[0].vy + P[1].vy) / 2 > 3 || (S.world.outcome && !S.world.outcome.success)));
    ctx.save();
    ctx.transform(ux, uy, -uy, ux, ox, oy);
    // chimney
    ctx.fillStyle = '#3b3b3b'; ctx.fillRect(-0.8, -1.35, 0.17, 0.5);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-0.85, -1.42, 0.27, 0.09);
    if (!S.tf.spilled || !S.world) drawCargoInCart(S.level.cargo);
    drawIntern(0.66, -1.08, scared);
    // body
    ctx.fillStyle = '#8b5a2b'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(-0.96, -0.95); ctx.lineTo(0.96, -0.95); ctx.lineTo(0.8, -0.18); ctx.lineTo(-0.8, -0.18); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.lineWidth = 0.025;
    line(-0.92, -0.7, 0.92, -0.7); line(-0.87, -0.45, 0.87, -0.45);
    ctx.fillStyle = '#6d747c';
    ctx.fillRect(-0.98, -1.0, 1.96, 0.09);
    ctx.fillRect(-0.62, -0.95, 0.08, 0.77); ctx.fillRect(0.54, -0.95, 0.08, 0.77);
    ctx.restore();
    // "MK II" text drawn upright-ish in screen space
    const mid = cartLocal(cart, 0, -0.56);
    if (uy > -0.5 && ux > 0) label(mid.x, mid.y, 'MK II', 'rgba(255,230,180,0.75)', 'bold 10px "Trebuchet MS", sans-serif');
    ctx.save();
    ctx.transform(ux, uy, -uy, ux, ox, oy);
    drawWheel(-0.62, 0, 0.3, cart.spin);
    drawWheel(0.62, 0, 0.3, cart.spin);
    ctx.restore();
  }

  function drawGoo() {
    const L = S.level, t = S.time;
    const x0 = L.left - 0.2, x1 = L.right + 0.2, y = L.river;
    const wave = (x) => y + Math.sin(x * 1.7 + t * 2) * 0.05 + Math.sin(x * 3.3 - t * 1.4) * 0.03;
    ctx.beginPath();
    ctx.moveTo(x0, y + 12);
    for (let x = x0; x < x1; x += 0.25) ctx.lineTo(x, wave(x));
    ctx.lineTo(x1, wave(x1));
    ctx.lineTo(x1, y + 12);
    ctx.closePath();
    ctx.fillStyle = 'rgba(98,176,52,0.94)';
    ctx.fill();
    ctx.beginPath();
    for (let x = x0; x < x1; x += 0.25) { if (x === x0) ctx.moveTo(x, wave(x)); else ctx.lineTo(x, wave(x)); }
    ctx.lineTo(x1, wave(x1));
    ctx.strokeStyle = 'rgba(205,255,150,0.85)'; ctx.lineWidth = 0.07; ctx.stroke();
    ctx.fillStyle = 'rgba(190,245,140,0.7)';
    for (const b of S.bg.bubbles) {
      const ph = (t * 0.6 * b.s + b.p) % 1;
      const r = 0.04 + ph * 0.12;
      if (ph < 0.85) { ctx.beginPath(); ctx.arc(b.x, y + 0.15 - ph * 0.12, r, Math.PI, 0); ctx.fill(); }
    }
    label((L.left + L.right) / 2, y + 0.55, 'snot river (do not drink)', 'rgba(30,70,10,0.8)', 'bold 12px "Trebuchet MS", sans-serif');
  }

  function drawParticles() {
    for (const p of S.particles) {
      const a = clamp(1 - p.t / p.life, 0, 1);
      switch (p.type) {
        case 'splinter':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.fillRect(-0.08, -0.02, 0.16, 0.04);
          ctx.restore();
          break;
        case 'spark':
          ctx.strokeStyle = 'rgba(255,220,90,' + a.toFixed(3) + ')'; ctx.lineWidth = 0.04;
          line(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          break;
        case 'drop':
          ctx.fillStyle = 'rgba(140,210,80,0.95)'; circle(p.x, p.y, p.size);
          break;
        case 'smoke':
          ctx.fillStyle = 'rgba(90,90,90,' + (0.45 * a).toFixed(3) + ')'; circle(p.x, p.y, p.size * (1 + p.t * 2.2));
          break;
        case 'dust':
          ctx.fillStyle = 'rgba(230,200,150,' + (0.7 * a).toFixed(3) + ')'; circle(p.x, p.y, p.size * (1 + p.t * 3));
          break;
        case 'confetti':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.rot * 1.7), 1);
          ctx.fillStyle = p.color; ctx.fillRect(-0.07, -0.04, 0.14, 0.08);
          ctx.restore();
          break;
        case 'cargo': {
          const depth = p.y - S.level.river - 0.15;
          ctx.globalAlpha = clamp(1 - depth / 0.6, 0, 1) * clamp((p.life - p.t) / 0.8, 0, 1);
          if (ctx.globalAlpha > 0.01) drawCargoItem(p.item, p.x, p.y, 1, p.rot, p.cat);
          ctx.globalAlpha = 1;
          break;
        }
        case 'text':
          ctx.globalAlpha = 1;
          label(p.x, p.y, p.text, p.color, 'bold 15px "Trebuchet MS", sans-serif');
          break;
        default: break;
      }
    }
  }

  function drawLabels() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const l of S.labels) {
      const p = w2s(l.x, l.y);
      ctx.font = l.font;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(20,12,6,0.85)';
      ctx.strokeText(l.text, p.x, p.y);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, p.x, p.y);
    }
    S.labels.length = 0;
  }

  // ----------------------------------------------------------- the goblin
  function drawGoblinPortrait() {
    const cx = GOB_X, cy = LH - BOT - 70;
    ctx.fillStyle = 'rgba(28,18,10,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy + 4, 60, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#8a5a2e'; ctx.stroke();
    const g = S.gob;
    const mood = g.moodT > 0 ? g.mood : g.base;
    const talking = g.talkT > 0 && Math.floor(S.time * 9) % 2 === 0;
    drawGoblin(cx, cy, 0.95, mood, S.time, g.look, g.blink > 0, talking);
    ctx.fillStyle = '#3b2410';
    ctx.fillRect(cx - 44, cy + 50, 88, 17);
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 2; ctx.strokeRect(cx - 44, cy + 50, 88, 17);
    ctx.fillStyle = '#ffd66b'; ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GRUBNIK', cx, cy + 59);
  }

  function drawGoblin(cx, cy, sc, mood, t, look, blink, talk) {
    const skin = '#7dbb43', dark = '#2f4d16', inner = '#c98572';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // shoulders, clipped to the frame
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 4 / sc, 58, 0, TAU); ctx.clip();
    ctx.fillStyle = '#6b4424';
    ctx.beginPath(); ctx.ellipse(0, 76, 56, 32, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8d9b0';
    ctx.beginPath(); ctx.moveTo(-13, 44); ctx.lineTo(0, 60); ctx.lineTo(13, 44); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 5;
    line(-25, 48, -19, 80); line(25, 48, 19, 80);
    ctx.restore();
    ctx.fillStyle = skin; ctx.fillRect(-10, 30, 20, 16);
    // ears
    let ea = Math.sin(t * 2.3) * 0.05;
    if (mood === 'happy') ea -= 0.14;
    else if (mood === 'sad') ea += 0.42;
    else if (mood === 'shock') ea -= 0.3;
    else if (mood === 'worried') ea += 0.16;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 33, -4);
      ctx.rotate(side * ea);
      ctx.fillStyle = skin; ctx.strokeStyle = dark; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.quadraticCurveTo(side * 38, -26, side * 70, -32);
      ctx.quadraticCurveTo(side * 44, 0, 0, 13);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.moveTo(side * 6, -6);
      ctx.quadraticCurveTo(side * 34, -19, side * 56, -26);
      ctx.quadraticCurveTo(side * 36, -2, side * 6, 6);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // head
    ctx.fillStyle = skin; ctx.strokeStyle = dark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 4, 38, 36, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(40,70,10,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 24, 30, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(225,110,90,0.3)';
    ctx.beginPath(); ctx.ellipse(-23, 17, 7, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(23, 17, 7, 4, 0, 0, TAU); ctx.fill();
    // hard hat
    ctx.fillStyle = '#f4c534'; ctx.strokeStyle = '#6e4f0c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -16, 37, 28, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-47, -16); ctx.lineTo(47, -16); ctx.lineTo(44, -9); ctx.lineTo(-44, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d69f1c'; ctx.lineWidth = 4; line(0, -42, 0, -19);
    ctx.fillStyle = '#fff7c9'; ctx.strokeStyle = '#6e4f0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -30, 6, 0, TAU); ctx.fill(); ctx.stroke();
    // eyes
    const lx = clamp(look.x, -1, 1) * 3.5, ly = clamp(look.y, -1, 1) * 3;
    for (const side of [-1, 1]) {
      const ex = side * 14, ey = 2;
      if (mood === 'happy') {
        ctx.strokeStyle = '#1b1208'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(ex, ey + 4, 7.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle = '#1b1208'; ctx.lineWidth = 3; line(ex - 8, ey, ex + 8, ey);
      } else {
        const r = mood === 'shock' ? 12 : 10;
        ctx.fillStyle = '#fffbe8'; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.9, r, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1b1208';
        circle(ex + lx, ey + ly, mood === 'shock' ? 3 : 4.6);
        ctx.fillStyle = '#fff'; circle(ex + lx - 1.4, ey + ly - 1.6, 1.3);
        if (mood === 'sad' || mood === 'smug') {
          ctx.fillStyle = skin;
          ctx.beginPath(); ctx.ellipse(ex, ey - 1, r, r * 0.66, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = dark; ctx.lineWidth = 2.5; line(ex - r * 0.9, ey - 1, ex + r * 0.9, ey - 1);
        }
      }
    }
    // brows
    const BR = { neutral: [0, -2], happy: [-3, -5], worried: [-7, 1], shock: [-9, -8], sad: [-6, 2], smug: [3, -2] };
    const br = BR[mood] || BR.neutral;
    ctx.strokeStyle = '#2b3a12'; ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      let a = br[0], b = br[1];
      if (mood === 'smug' && side === 1) { a = -8; b = -10; }
      line(side * 5, -11 + a, side * 23, -11 + b);
    }
    // nose
    ctx.fillStyle = '#8fcc52'; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-5, 6); ctx.quadraticCurveTo(-3, 20, 3 + lx * 0.4, 26); ctx.quadraticCurveTo(8, 18, 5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d8f2a'; circle(4.5, 15, 2);
    // mouth
    ctx.strokeStyle = '#1b1208'; ctx.lineWidth = 3;
    const m = talk ? 'talk' : mood;
    if (m === 'happy') {
      ctx.fillStyle = '#5b1a14';
      ctx.beginPath(); ctx.moveTo(-17, 29); ctx.quadraticCurveTo(0, 50, 17, 29); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fffbe8'; ctx.fillRect(-9, 29.5, 6, 5); ctx.fillRect(4, 29.5, 5, 4);
      ctx.fillStyle = '#e0706a'; ctx.beginPath(); ctx.ellipse(0, 39, 6, 3, 0, 0, TAU); ctx.fill();
    } else if (m === 'shock' || m === 'talk') {
      ctx.fillStyle = '#5b1a14';
      ctx.beginPath(); ctx.ellipse(0, 35, m === 'talk' ? 8 : 7, m === 'talk' ? 5 : 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (m === 'worried') {
      ctx.beginPath(); ctx.moveTo(-14, 34); ctx.quadraticCurveTo(-7, 29, 0, 34); ctx.quadraticCurveTo(7, 39, 14, 33); ctx.stroke();
    } else if (m === 'sad') {
      ctx.beginPath(); ctx.moveTo(-14, 38); ctx.quadraticCurveTo(0, 27, 14, 38); ctx.stroke();
    } else if (m === 'smug') {
      ctx.beginPath(); ctx.moveTo(-12, 33); ctx.quadraticCurveTo(4, 38, 16, 28); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-14, 31); ctx.quadraticCurveTo(0, 38, 14, 31); ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.moveTo(5.5, 34); ctx.lineTo(10, 33.4); ctx.lineTo(8, 27.5); ctx.closePath(); ctx.fill();
    }
    // sweat
    if (mood === 'worried' || mood === 'shock') {
      const sy = -8 + ((t * 26) % 14);
      ctx.fillStyle = 'rgba(120,200,255,0.9)';
      ctx.beginPath(); ctx.moveTo(33, sy - 6); ctx.quadraticCurveTo(38, sy + 2, 33, sy + 3); ctx.quadraticCurveTo(28, sy + 2, 33, sy - 6); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ loop
  let lastT = 0;
  function frame(now) {
    if (!lastT) lastT = now;
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    try {
      update(dt);
      render();
    } catch (err) {
      // keep the loop alive; surface the problem in the console
      if (!frame.warned) { frame.warned = true; console.error(err); }
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    buildMatButtons();
    bindInput();
    resize();
    showTitle();
    requestAnimationFrame(frame);
  }

  // exposed for automated smoke tests only
  window.__grubnik = { S, update, render, startTest, backToBuild, showIntro, startBuild, doAction, tryAddBeam, pointAt, onKey };

  boot();
})();
