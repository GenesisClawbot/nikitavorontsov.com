(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ui = {
    world: $('world'), intro: $('intro'), ending: $('ending'), hud: $('hud'), bottom: $('bottom-hud'),
    clock: $('clock'), route: $('route-fill'), marker: $('route-marker'), minis: [$('mini-0'), $('mini-1'), $('mini-2')],
    grip: $('grip-fill'), gripBar: document.querySelector('.grip-bar'), gripStatus: $('grip-status'), hint: $('play-hint'),
    threat: $('threat'), threatArrow: $('threat-arrow'), threatName: $('threat-name'), threatFill: $('threat-fill'),
    callout: $('callout'), calloutMain: $('callout-main'), calloutSub: $('callout-sub'), flash: $('flash'),
    combo: $('combo'), comboNumber: $('combo-number'), endTitle: $('end-title'), endKicker: $('end-kicker'),
    endNumber: $('result-number'), endDescription: $('end-description'), endCatches: $('end-catches'),
    endBest: $('end-best'), fallback: $('fallback')
  };
  if (!window.THREE) { ui.fallback.hidden = false; return; }

  const DURATION = 44;
  const SPEED = 3.5;
  const GOAL_Z = -SPEED * DURATION - 2.4;
  const TAU = Math.PI * 2;
  const UP = new THREE.Vector3(0, 1, 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  function seeded(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const decorRandom = seeded(712954);

  let scene, camera, renderer, hero, tray, goal, directional, warmLight, coolLight;
  let woodTexture, rugTexture, glowTexture, shadowTexture;
  let canvasWidth = innerWidth, canvasHeight = innerHeight;
  let heroZ = 0, globalTime = 0, previousFrame = performance.now();
  let cups = [], events = [], ambientPeople = [], sceneryChunks = [], lightSprites = [], particles = [];
  let trayRoll = 0, rollVelocity = 0, trayPitch = 0, pitchVelocity = 0;
  let calloutTimeout = 0, deliveryDelay = 0;
  let keyHeld = false, pointerHeld = false;
  let state = { mode: 'intro', t: 0, round: 0, grip: 1, held: false, braceAt: -99, perfects: 0, streak: 0, shake: 0, flash: 0, lastPerfect: -99, best: 0 };
  try { state.best = Number(localStorage.getItem('tipsy-griffin-best')) || 0; } catch (_) { /* Private browsing is fine. */ }

  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const BALL = new THREE.SphereGeometry(1, 12, 9);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
  const DROP = new THREE.IcosahedronGeometry(1, 0);
  const BOTTLE_BODY = new THREE.CylinderGeometry(.08, .105, 1, 8);
  const bottleMaterials = new Map();
  const STAR = new THREE.OctahedronGeometry(1, 0);
  const SHADOW_PLANE = new THREE.PlaneGeometry(1, 1);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .79, ...extra });
  const M = {
    wall: mat('#342435'), wallInset: mat('#422c3c'), darkWood: mat('#412635'),
    wood: mat('#754437'), lightWood: mat('#a46a46'), carvedWood: mat('#644037'),
    brass: mat('#e8ae65', { metalness: .48, roughness: .33 }), gold: mat('#ffd28b', { metalness: .28, roughness: .43 }),
    copper: mat('#bb7060', { metalness: .45, roughness: .42 }), iron: mat('#5c5060', { metalness: .55, roughness: .43 }),
    wine: mat('#803e58'), purple: mat('#564064'), velvet: mat('#b75879'),
    teal: mat('#3caaa1'), darkTeal: mat('#296e79'), cream: mat('#ffe2b5'),
    skin: mat('#f3ba8f'), rosy: mat('#e98787'), white: mat('#fff2d7'),
    ink: mat('#2d2535'), red: mat('#de726b'), green: mat('#8dc59a'),
    glowAmber: new THREE.MeshBasicMaterial({ color: '#ffd486' }),
    glowTeal: new THREE.MeshBasicMaterial({ color: '#7af2d8' }),
    glassA: mat('#ffdcaa', { transparent: true, opacity: .29, depthWrite: false, side: THREE.DoubleSide, roughness: .12, metalness: .12 }),
    glassB: mat('#ffd0ef', { transparent: true, opacity: .29, depthWrite: false, side: THREE.DoubleSide, roughness: .12, metalness: .12 }),
    glassC: mat('#b5fff1', { transparent: true, opacity: .31, depthWrite: false, side: THREE.DoubleSide, roughness: .12, metalness: .12 }),
    ale: mat('#ffb44e', { emissive: '#a44716', emissiveIntensity: .28, roughness: .26 }),
    berry: mat('#ee74bb', { emissive: '#8e327e', emissiveIntensity: .34, roughness: .24 }),
    mint: mat('#58e1c5', { emissive: '#1e8d82', emissiveIntensity: .34, roughness: .22 }),
    foamA: new THREE.MeshBasicMaterial({ color: '#fff1c4' }),
    foamB: new THREE.MeshBasicMaterial({ color: '#ffd9f1' }),
    foamC: new THREE.MeshBasicMaterial({ color: '#d5fff1' }),
    stainBlue: new THREE.MeshBasicMaterial({ color: '#438b9f' }),
    stainPink: new THREE.MeshBasicMaterial({ color: '#ac547e' }),
    stainGold: new THREE.MeshBasicMaterial({ color: '#c58d55' }),
    particleGold: new THREE.MeshBasicMaterial({ color: '#ffe399', transparent: true, depthWrite: false }),
    particleMint: new THREE.MeshBasicMaterial({ color: '#8affdf', transparent: true, depthWrite: false }),
    particleAle: new THREE.MeshBasicMaterial({ color: '#ffc371', transparent: true, depthWrite: false }),
    particleBerry: new THREE.MeshBasicMaterial({ color: '#ff9ed4', transparent: true, depthWrite: false })
  };

  function box(parent, material, x, y, z, w, h, d) {
    const o = new THREE.Mesh(BOX, material);
    o.position.set(x, y, z); o.scale.set(w, h, d); parent.add(o); return o;
  }
  function ball(parent, material, x, y, z, sx, sy = sx, sz = sx) {
    const o = new THREE.Mesh(BALL, material);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o;
  }
  function cylinder(parent, material, x, y, z, r, h) {
    const o = new THREE.Mesh(CYL, material);
    o.position.set(x, y, z); o.scale.set(r, h, r); parent.add(o); return o;
  }
  function tapered(parent, material, x, y, z, top, bottom, height, segments = 12, open = false) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments, 1, open), material);
    o.position.set(x, y, z); parent.add(o); return o;
  }
  function beam(parent, material, ax, ay, az, bx, by, bz, thickness, depth = thickness) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const direction = b.clone().sub(a), o = new THREE.Mesh(BOX, material);
    o.position.copy(a.add(b).multiplyScalar(.5));
    o.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
    o.scale.set(thickness, direction.length(), depth); parent.add(o); return o;
  }
  function ring(parent, material, r, tube, x, y, z) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 7, 24), material);
    o.position.set(x, y, z); o.rotation.x = Math.PI / 2; parent.add(o); return o;
  }
  function roundedPath(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function makeTexture(canvas) {
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  function paintWood() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const p = c.getContext('2d'), r = seeded(77221);
    p.fillStyle = '#342332'; p.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 128 + (row % 2 ? 64 : 0), y = row * 64;
        const shade = Math.floor(r() * 18);
        p.fillStyle = `rgb(${99 + shade},${55 + Math.floor(shade * .65)},${55 + Math.floor(shade * .45)})`;
        p.fillRect(x + 2, y + 2, 124, 60);
        p.fillStyle = 'rgba(255,191,124,.07)'; p.fillRect(x + 5, y + 4, 118, 2);
        p.fillStyle = 'rgba(24,13,25,.27)'; p.fillRect(x + 3, y + 57, 122, 3);
        for (let n = 0; n < 6; n++) {
          p.strokeStyle = `rgba(${r() > .45 ? '244,171,116' : '26,13,28'},${.045 + r() * .095})`;
          p.lineWidth = .7 + r() * 2; p.beginPath();
          const gy = y + 9 + n * 8 + r() * 3;
          p.moveTo(x + 9 + r() * 25, gy); p.bezierCurveTo(x + 38, gy + r() * 4, x + 82, gy - r() * 5, x + 116 - r() * 20, gy);
          p.stroke();
        }
        p.fillStyle = 'rgba(245,173,111,.26)'; p.beginPath(); p.arc(x + 11, y + 12, 1.4, 0, TAU); p.arc(x + 115, y + 50, 1.4, 0, TAU); p.fill();
      }
    }
    return makeTexture(c);
  }
  function paintRug() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const p = c.getContext('2d'); p.fillStyle = '#6d344f'; p.fillRect(0, 0, 256, 512);
    p.fillStyle = '#3c304b'; p.fillRect(14, 0, 228, 512);
    p.fillStyle = '#d29262'; p.fillRect(8, 0, 5, 512); p.fillRect(243, 0, 5, 512);
    p.fillStyle = '#8e4f64'; p.fillRect(20, 0, 6, 512); p.fillRect(230, 0, 6, 512);
    p.strokeStyle = '#d7a06c'; p.lineWidth = 4;
    for (const x of [34, 222]) {
      p.beginPath(); p.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 20) p.lineTo(x + (Math.floor(y / 20) % 2 ? 7 : -7), y);
      p.stroke();
    }
    for (let y = 0; y < 512; y += 128) {
      p.fillStyle = '#755871'; p.beginPath(); p.moveTo(128, y + 9); p.lineTo(211, y + 64); p.lineTo(128, y + 119); p.lineTo(45, y + 64); p.closePath(); p.fill();
      p.strokeStyle = '#dfa770'; p.lineWidth = 3; p.stroke();
      p.fillStyle = '#3b7780'; p.beginPath(); p.moveTo(128, y + 24); p.lineTo(190, y + 64); p.lineTo(128, y + 104); p.lineTo(66, y + 64); p.closePath(); p.fill();
      p.strokeStyle = '#daaa74'; p.lineWidth = 2; p.stroke();
      p.fillStyle = '#f4c47d'; p.beginPath(); p.moveTo(128, y + 44); p.lineTo(140, y + 64); p.lineTo(128, y + 84); p.lineTo(116, y + 64); p.closePath(); p.fill();
      for (const x of [78, 178]) {
        p.fillStyle = '#d09068'; p.beginPath(); p.arc(x, y + 8, 4, 0, TAU); p.arc(x, y + 120, 4, 0, TAU); p.fill();
      }
    }
    return makeTexture(c);
  }
  function paintGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const p = c.getContext('2d'), g = p.createRadialGradient(64, 64, 2, 64, 64, 63);
    g.addColorStop(0, 'rgba(255,255,255,.94)'); g.addColorStop(.14, 'rgba(255,255,255,.56)');
    g.addColorStop(.42, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    p.fillStyle = g; p.fillRect(0, 0, 128, 128); return makeTexture(c);
  }
  function paintShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const p = c.getContext('2d'), g = p.createRadialGradient(64, 64, 5, 64, 64, 63);
    g.addColorStop(0, 'rgba(14,6,17,.64)'); g.addColorStop(.48, 'rgba(18,9,22,.3)'); g.addColorStop(1, 'rgba(18,9,22,0)');
    p.fillStyle = g; p.fillRect(0, 0, 128, 128); return makeTexture(c);
  }
  function glow(parent, x, y, z, color = '#ffc47b', size = 1.7, opacity = .52) {
    const material = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(material); s.position.set(x, y, z); s.scale.set(size, size, 1); parent.add(s);
    lightSprites.push({ sprite: s, base: size, phase: decorRandom() * TAU }); return s;
  }
  function shadow(parent, x = 0, z = 0, width = 1.8, depth = 1.2) {
    const m = new THREE.Mesh(SHADOW_PLANE, new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: .58, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .022, z); m.scale.set(width, depth, 1); parent.add(m); return m;
  }
  function textBoard(lines, bg = '#412837', accent = '#efbd79', w = 768, h = 256) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const p = c.getContext('2d'); roundedPath(p, 9, 9, w - 18, h - 18, 26); p.fillStyle = bg; p.fill();
    p.strokeStyle = accent; p.lineWidth = 9; p.stroke(); roundedPath(p, 27, 27, w - 54, h - 54, 15);
    p.strokeStyle = 'rgba(255,222,165,.4)'; p.lineWidth = 2; p.stroke();
    p.textAlign = 'center'; p.textBaseline = 'middle';
    if (lines.length === 1) {
      p.fillStyle = '#ffeac3'; p.font = 'bold 88px Georgia'; p.fillText(lines[0], w / 2, h / 2 + 2);
    } else {
      p.fillStyle = '#f6cb88'; p.font = 'bold 34px Trebuchet MS, sans-serif'; p.fillText(lines[0], w / 2, 77);
      p.fillStyle = '#fff0d2'; p.font = 'bold 81px Georgia'; p.fillText(lines[1], w / 2, 160);
      if (lines[2]) { p.fillStyle = '#96e5ce'; p.font = 'bold 25px Trebuchet MS, sans-serif'; p.fillText(lines[2], w / 2, 221); }
    }
    const t = makeTexture(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
  }
  function quoteSprite(text, blue) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 168;
    const p = c.getContext('2d'); roundedPath(p, 12, 10, 488, 119, 26);
    p.fillStyle = blue ? '#d0fff0' : '#ffedc9'; p.fill();
    p.lineWidth = 7; p.strokeStyle = blue ? '#408a83' : '#9b5b62'; p.stroke();
    p.beginPath(); p.moveTo(97, 128); p.lineTo(138, 128); p.lineTo(105, 162); p.closePath(); p.fill(); p.stroke();
    p.fillStyle = '#3a2736'; p.textAlign = 'center'; p.textBaseline = 'middle';
    p.font = 'bold 48px Trebuchet MS, Arial, sans-serif'; p.fillText(text, 256, 73, 455);
    const tex = makeTexture(c), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sprite.scale.set(2.1, .69, 1); sprite.position.set(0, 2.55, 0); return sprite;
  }

  function makeArch(chunk, localZ) {
    for (const side of [-1, 1]) {
      const x = side * 5.15;
      box(chunk, M.darkWood, x, 2.25, localZ, .42, 4.52, .45);
      box(chunk, M.lightWood, x - side * .11, 2.21, localZ + .22, .08, 4.45, .07);
      box(chunk, M.brass, x - side * .16, 1.25, localZ + .24, .1, .045, .49);
      box(chunk, M.carvedWood, x, 4.53, localZ, .75, .22, .62);
      box(chunk, M.brass, x, 4.45, localZ + .32, .73, .055, .07);
      beam(chunk, M.darkWood, x, 4.52, localZ, side * 2.55, 5.68, localZ, .42, .48);
      beam(chunk, M.lightWood, x - side * .12, 4.62, localZ + .23, side * 2.52, 5.75, localZ + .23, .08, .06);
    }
    box(chunk, M.darkWood, 0, 5.72, localZ, 5.25, .32, .49);
    box(chunk, M.brass, 0, 5.54, localZ + .27, 5.12, .055, .055);
    ball(chunk, M.gold, 0, 5.56, localZ + .32, .09);
  }
  function makeLantern(chunk, x, z) {
    cylinder(chunk, M.iron, x, 5.48, z, .021, .78);
    box(chunk, M.brass, x, 5.12, z, .28, .07, .28);
    tapered(chunk, M.glowAmber, x, 4.88, z, .16, .21, .43, 6);
    for (const a of [-1, 1]) {
      box(chunk, M.iron, x + a * .19, 4.87, z, .038, .45, .036);
      box(chunk, M.iron, x, 4.87, z + a * .19, .036, .45, .038);
    }
    box(chunk, M.brass, x, 4.62, z, .34, .075, .34);
    ball(chunk, M.gold, x, 4.55, z, .058);
    glow(chunk, x, 4.87, z, '#ffad64', 2.9, .42);
  }
  function makeWindow(chunk, side, z) {
    const x = side * 5.25;
    box(chunk, M.darkWood, x, 3.08, z, .18, 1.9, 1.83);
    box(chunk, M.brass, x - side * .11, 3.08, z, .035, 1.73, 1.65);
    box(chunk, M.stainBlue, x - side * .13, 3.08, z, .025, 1.51, 1.44);
    for (let i = 0; i < 5; i++) {
      const zz = z - .56 + i * .28;
      box(chunk, i % 2 ? M.stainPink : M.stainGold, x - side * .153, 3.1, zz, .022, 1.34, .24);
      box(chunk, M.darkWood, x - side * .175, 3.1, zz + .14, .025, 1.49, .029);
    }
    box(chunk, M.darkWood, x - side * .19, 3.09, z, .04, .057, 1.74);
    box(chunk, M.carvedWood, x - side * .2, 2.08, z, .33, .12, 2.04);
    glow(chunk, x - side * .11, 3.13, z, side < 0 ? '#f279bc' : '#62dec5', 1.45, .13);
  }
  function makeBottle(parent, x, y, z, color, height = .33) {
    if (!bottleMaterials.has(color)) bottleMaterials.set(color, mat(color, { emissive: color, emissiveIntensity: .14, metalness: .07, roughness: .22 }));
    const fluid = bottleMaterials.get(color);
    const body = new THREE.Mesh(BOTTLE_BODY, fluid); body.position.set(x, y + height * .39, z); body.scale.y = height * .73; parent.add(body);
    cylinder(parent, fluid, x, y + height * .89, z, .036, height * .3);
    cylinder(parent, M.carvedWood, x, y + height + .012, z, .041, .055);
    box(parent, M.cream, x, y + height * .37, z + .095, .11, .075, .018);
  }
  function makeShelf(chunk, side, z) {
    const x = side * 4.92;
    for (const y of [1.66, 2.35]) {
      box(chunk, M.lightWood, x, y, z, .63, .11, 2.45);
      box(chunk, M.brass, x - side * .33, y - .035, z, .035, .045, 2.35);
    }
    const colors = ['#56bcb4', '#cc719a', '#edaa55', '#80bd80', '#ba92d8', '#e27f73'];
    for (let j = 0; j < 10; j++) {
      const y = j < 5 ? 1.72 : 2.41;
      makeBottle(chunk, x - side * .19, y, z - 1 + (j % 5) * .48, colors[j % colors.length], .25 + decorRandom() * .18);
    }
  }
  function makeTable(chunk, side, z, index) {
    const x = side * (3.58 + (index % 3) * .15);
    const table = new THREE.Group(); table.position.set(x, 0, z); chunk.add(table);
    shadow(table, 0, 0, 2.75, 2.15);
    cylinder(table, M.darkWood, 0, .45, 0, .1, .82);
    cylinder(table, M.carvedWood, 0, .12, 0, .42, .12);
    cylinder(table, M.wood, 0, .91, 0, .91, .14);
    ring(table, M.brass, .89, .025, 0, .989, 0);
    for (const a of [0, 2.13, 4.27]) {
      const sx = Math.cos(a) * .54, sz = Math.sin(a) * .55;
      cylinder(table, M.iron, sx, 1.02, sz, .115, .028);
      cylinder(table, [M.ale, M.berry, M.mint][Math.floor(a)], sx, 1.12, sz, .073, .18);
      ring(table, M.brass, .073, .011, sx, 1.225, sz);
    }
    for (const a of [-1, 1]) {
      const stool = new THREE.Group(); stool.position.set(a * .96, 0, a * .42); table.add(stool);
      cylinder(stool, M.darkWood, 0, .37, 0, .055, .7);
      cylinder(stool, M.carvedWood, 0, .73, 0, .32, .1);
      ring(stool, M.copper, .28, .023, 0, .788, 0);
    }
    if (index % 2 === 0) {
      cylinder(table, M.brass, -.17, 1.07, -.26, .051, .25);
      tapered(table, M.glowAmber, -.17, 1.27, -.26, .023, .04, .16, 6);
      glow(table, -.17, 1.28, -.26, '#ffbb74', .95, .32);
    }
    if (index % 3 === 0) {
      const barrel = new THREE.Group(); barrel.position.set(side * .85, 0, -1.5); table.add(barrel);
      tapered(barrel, M.wood, 0, .47, 0, .43, .42, .88, 10);
      for (const y of [.16, .77]) cylinder(barrel, M.iron, 0, y, 0, .445, .065);
      cylinder(barrel, M.darkWood, 0, .93, 0, .41, .06);
      shadow(barrel, 0, 0, 1.2, 1.1);
    }
  }
  function makeBanner(chunk, side, z) {
    const x = side * 3.64;
    box(chunk, M.brass, x, 4.97, z, 1.22, .05, .08);
    const fabric = box(chunk, side < 0 ? M.velvet : M.teal, x, 4.21, z, 1.04, 1.44, .048);
    fabric.rotation.z = side * .045;
    tapered(chunk, M.gold, x, 4.13, z + .05, 0, .17, .35, 3).rotation.z = Math.PI;
    ball(chunk, M.gold, x, 4.45, z + .058, .17, .24, .04);
    box(chunk, M.cream, x, 4.45, z + .10, .05, .43, .026);
    box(chunk, M.cream, x, 4.45, z + .11, .34, .05, .026);
  }
  // Static props within each ten-metre room share geometry and materials. Batch them
  // into GPU instances; keep moving guests, transparent shadows and glowing sprites separate.
  function instanceStatic(chunk) {
    chunk.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(chunk.matrixWorld).invert();
    const buckets = new Map();
    function visit(node) {
      for (const child of node.children) {
        if (child.userData.animated) continue;
        const g = child.geometry, m = child.material;
        if (child.isMesh && !child.isInstancedMesh && m && !m.transparent && child.renderOrder === 0 &&
            (g === BOX || g === BALL || g === CYL || g === BOTTLE_BODY)) {
          const key = g.id + '/' + m.id;
          if (!buckets.has(key)) buckets.set(key, { geometry: g, material: m, objects: [] });
          buckets.get(key).objects.push({ mesh: child, matrix: new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld) });
        } else visit(child);
      }
    }
    visit(chunk);
    for (const bucket of buckets.values()) {
      if (bucket.objects.length < 2) continue;
      const instanced = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.objects.length);
      bucket.objects.forEach((item, i) => instanced.setMatrixAt(i, item.matrix));
      instanced.instanceMatrix.needsUpdate = true;
      instanced.frustumCulled = false;
      for (const item of bucket.objects) item.mesh.parent.remove(item.mesh);
      chunk.add(instanced);
    }
  }

  function buildEnvironment() {
    woodTexture = paintWood(); woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping; woodTexture.repeat.set(3, 21);
    rugTexture = paintRug(); rugTexture.wrapS = rugTexture.wrapT = THREE.RepeatWrapping; rugTexture.repeat.set(1, 16);
    glowTexture = paintGlow(); shadowTexture = paintShadow();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 174), mat('#ffffff', { map: woodTexture, roughness: .96 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.052, -78); scene.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.94, 170), mat('#ffffff', { map: rugTexture, roughness: 1, emissive: '#230c25', emissiveIntensity: .1 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, -.029, -77); scene.add(carpet);
    box(scene, M.brass, -1.49, -.005, -77, .035, .025, 170);
    box(scene, M.brass, 1.49, -.005, -77, .035, .025, 170);
    for (const side of [-1, 1]) {
      box(scene, M.wall, side * 5.72, 2.75, -78, .48, 5.75, 174);
      box(scene, M.wallInset, side * 5.46, .59, -78, .14, 1.18, 174);
      box(scene, M.carvedWood, side * 5.36, 1.19, -78, .26, .13, 174);
      box(scene, M.brass, side * 5.29, 1.3, -78, .035, .035, 174);
    }
    box(scene, M.darkWood, 0, 6.06, -78, 11.6, .28, 174);
    const signMaterial = textBoard(['THE TIPSY GRIFFIN'], '#513044', '#f2bd7c', 768, 256);
    for (let i = 0; i < 17; i++) {
      const chunk = new THREE.Group(); chunk.position.z = 7 - i * 10;
      scene.add(chunk); sceneryChunks.push(chunk);
      makeArch(chunk, 0);
      makeLantern(chunk, i % 4 === 0 ? -.5 : .5, -3.4);
      for (const side of [-1, 1]) {
        makeWindow(chunk, side, -5.05);
        if (i % 2 === 0) makeTable(chunk, side, -4.6, i + (side > 0 ? 1 : 0));
        else if ((i + (side > 0 ? 1 : 0)) % 3 === 0) makeShelf(chunk, side, -4.9);
        if (i % 4 === 1 && side === -1) makeBanner(chunk, side, .06);
      }
      if (i === 2 || i === 10) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.04), signMaterial);
        sign.position.set(0, 4.6, .37); chunk.add(sign);
        box(chunk, M.brass, 0, 5.14, .37, 3.25, .05, .08);
      }
      if (i > 0 && i < 16 && i % 2 === 1) {
        const type = ['dwarf', 'witch', 'goblin', 'gnome', 'mushroom', 'orc'][i % 6];
        const person = makePerson(type, i * 2.1);
        person.root.position.set((i % 4 === 1 ? -1 : 1) * 3.78, 0, -5.02);
        person.root.rotation.y = (i % 4 === 1 ? -.6 : .55);
        person.root.userData.animated = true;
        chunk.add(person.root); ambientPeople.push(person);
      }
      instanceStatic(chunk);
    }
    const chalk = textBoard(['TONIGHT’S SPECIAL', 'DRAGON MEAD', 'NO REFUNDS'], '#352438', '#d99e73');
    const wallBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.25, .79), chalk);
    wallBoard.rotation.y = Math.PI / 2; wallBoard.position.set(-5.19, 2.08, -32); scene.add(wallBoard);
    makeGoal();
    const dustPos = [];
    for (let i = 0; i < 450; i++) dustPos.push((decorRandom() - .5) * 10, .7 + decorRandom() * 4.8, 10 - decorRandom() * 175);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#f9d6a6', size: .047, transparent: true, opacity: .55, depthWrite: false, sizeAttenuation: true })));
  }
  function makeGoal() {
    goal = new THREE.Group(); goal.position.z = GOAL_Z; scene.add(goal);
    for (const side of [-1, 1]) {
      box(goal, M.brass, side * 2.36, 2.44, -.28, .35, 4.86, .34);
      box(goal, M.darkWood, side * 2.37, 2.43, 0, .22, 4.81, .16);
      ball(goal, M.gold, side * 2.36, 4.82, .1, .25);
      glow(goal, side * 2.32, 3.75, .3, side < 0 ? '#f39bc0' : '#85ffe0', 3.0, .48);
    }
    box(goal, M.brass, 0, 4.88, -.18, 5.14, .35, .35);
    box(goal, M.darkWood, 0, 4.78, .07, 5.05, .29, .19);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.62, 1.22), textBoard(['YOUR ORDER FOR', 'TABLE THREE', '✦   RIGHT ON TIME   ✦'], '#513244', '#ffd18a'));
    sign.position.set(0, 3.69, .48); goal.add(sign);
    box(goal, M.lightWood, 0, 1.21, -1.4, 2.15, .2, 1.45);
    box(goal, M.brass, 0, 1.31, -1.4, 2.23, .05, 1.53);
    for (const x of [-.7, 0, .7]) {
      cylinder(goal, M.brass, x, 1.4, -1.5, .22, .04);
      ring(goal, M.gold, .22, .026, x, 1.45, -1.5);
    }
    for (let i = 0; i < 9; i++) {
      const x = -2 + i * .5, y = 5.0 + Math.sin(i * 1.2) * .12;
      ball(goal, i % 2 ? M.glowAmber : M.glowTeal, x, y, .2, .055);
      glow(goal, x, y, .2, i % 2 ? '#ffc780' : '#6cebd1', .54, .35);
    }
  }

  const personStyles = {
    gnome: { skin: '#f2ad80', coat: '#bc655d', hat: '#dd915d', height: .92, name: 'A GNOME WITH PLANS', quote: 'PARDON ME!' },
    witch: { skin: '#eab7af', coat: '#744782', hat: '#392f52', height: 1.07, name: 'A HURRIED WITCH', quote: 'HOT SOUP!' },
    goblin: { skin: '#9dc98d', coat: '#548782', hat: '#d7a963', height: .84, name: 'A GOBLIN SERVER', quote: 'OOPSIE!' },
    dwarf: { skin: '#e9b092', coat: '#426c84', hat: '#b57660', height: .92, name: 'A JOLLY DWARF', quote: 'FOR THE KING!' },
    mushroom: { skin: '#e8c6a4', coat: '#799987', hat: '#d67883', height: .83, name: 'A MUSHROOM PAL', quote: 'SQUEAK!' },
    orc: { skin: '#79bca8', coat: '#956f55', hat: '#e5b384', height: 1.14, name: 'A VERY BIG ORC', quote: 'MAKE WAY!' }
  };
  function makePerson(type, phase) {
    const style = personStyles[type];
    const root = new THREE.Group(); root.scale.setScalar(style.height);
    const coat = mat(style.coat), face = mat(style.skin), hat = mat(style.hat);
    const shoes = M.ink;
    shadow(root, 0, 0, 1.5, 1.05);
    ball(root, coat, 0, .95, 0, .4, .54, .32);
    ball(root, M.brass, 0, .65, .32, .075, .075, .026);
    box(root, M.darkWood, 0, .68, .29, .69, .11, .085);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .2, .53, 0); root.add(leg);
      ball(leg, coat, 0, -.23, 0, .145, .31, .155);
      ball(leg, shoes, 0, -.47, .095, .18, .13, .26); legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * .38, 1.23, 0); root.add(arm);
      ball(arm, coat, side * .07, -.18, 0, .18, .3, .17);
      ball(arm, face, side * .13, -.41, .08, .13, .13, .13);
      arms.push(arm);
    }
    const head = new THREE.Group(); head.position.set(0, 1.55, .04); root.add(head);
    ball(head, face, 0, 0, 0, .34, .35, .31);
    for (const side of [-1, 1]) {
      ball(head, M.white, side * .125, .055, .273, .065, .078, .045);
      ball(head, M.ink, side * .116, .045, .316, .029, .038, .021);
      ball(head, M.rosy, side * .228, -.09, .258, .063, .031, .03);
    }
    ball(head, face, 0, -.08, .31, .083, .095, .09);
    ball(head, M.darkWood, 0, -.185, .313, .086, .021, .018);
    if (type === 'gnome') {
      tapered(head, hat, -.055, .53, -.04, 0, .43, .78, 10).rotation.z = -.19;
      cylinder(head, M.copper, 0, .22, 0, .42, .09);
      ball(head, M.cream, 0, -.25, .263, .205, .23, .1);
      ball(head, M.white, -.07, -.14, .37, .105, .055, .045);
      ball(head, M.white, .07, -.14, .37, .105, .055, .045);
    } else if (type === 'witch') {
      cylinder(head, hat, 0, .31, 0, .49, .055);
      tapered(head, hat, 0, .68, 0, 0, .35, .73, 12).rotation.z = .19;
      ring(head, M.brass, .26, .026, 0, .34, 0);
      ball(head, M.gold, .14, .65, .14, .056);
      ball(head, M.purple, -.27, -.13, -.05, .15, .31, .15);
      ball(head, M.purple, .27, -.13, -.05, .15, .31, .15);
    } else if (type === 'goblin') {
      for (const side of [-1, 1]) {
        const ear = tapered(head, face, side * .43, .04, -.01, 0, .2, .51, 5);
        ear.rotation.z = -side * Math.PI / 2;
        ball(head, M.brass, side * .36, -.21, .06, .046);
      }
      ball(head, hat, 0, .3, -.07, .33, .13, .28);
      tapered(head, hat, .18, .39, -.01, 0, .14, .26, 5).rotation.z = -.35;
    } else if (type === 'dwarf') {
      ball(head, hat, 0, .26, -.01, .41, .18, .36);
      cylinder(head, M.iron, 0, .35, 0, .37, .08);
      tapered(head, hat, 0, -.29, .24, .32, .08, .47, 9).rotation.z = Math.PI;
      ball(head, hat, -.1, -.16, .36, .14, .075, .065);
      ball(head, hat, .1, -.16, .36, .14, .075, .065);
    } else if (type === 'mushroom') {
      ball(head, hat, 0, .29, -.02, .53, .23, .49);
      ball(head, M.cream, -.25, .43, .24, .095, .035, .09);
      ball(head, M.cream, .19, .46, -.16, .08, .037, .07);
      ball(head, M.cream, .32, .33, .08, .067, .028, .07);
    } else if (type === 'orc') {
      for (const side of [-1, 1]) {
        tapered(head, M.cream, side * .29, .33, -.02, 0, .13, .39, 7).rotation.z = -side * .39;
      }
      ball(head, M.cream, -.14, -.23, .328, .047, .094, .055);
      ball(head, M.cream, .14, -.23, .328, .047, .094, .055);
      box(root, M.cream, 0, .96, .317, .4, .51, .034);
      ball(root, M.brass, 0, .86, .347, .08);
    }
    // A ridiculous miniature tankard; every guest is part of the problem.
    const mugArm = arms[1];
    cylinder(mugArm, M.brass, .21, -.49, .18, .105, .19);
    cylinder(mugArm, M.ale, .21, -.38, .18, .089, .035);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.083, .022, 5, 12), M.brass);
    handle.position.set(.335, -.48, .18); mugArm.add(handle);
    return { root, head, legs, arms, phase, type };
  }

  function makeTray() {
    hero = new THREE.Group(); scene.add(hero);
    ball(hero, M.purple, 0, .67, 1.08, .58, .58, .4);
    box(hero, M.brass, -.3, .82, 1.44, .07, .86, .05).rotation.z = -.35;
    box(hero, M.brass, .3, .82, 1.44, .07, .86, .05).rotation.z = .35;
    for (const side of [-1, 1]) {
      beam(hero, M.wine, side * .57, .98, 1.24, side * .94, 1.42, -.28, .26, .24);
      beam(hero, M.brass, side * .83, 1.34, -.06, side * .93, 1.43, -.36, .055, .21);
    }
    tray = new THREE.Group(); tray.position.set(0, 1.46, -.47); hero.add(tray);
    const platterShape = new THREE.Shape(); platterShape.absellipse(0, 0, 1.11, .61, 0, TAU, false, 0);
    const lowerShape = new THREE.Shape(); lowerShape.absellipse(0, 0, 1.15, .65, 0, TAU, false, 0);
    const lower = new THREE.Mesh(new THREE.ExtrudeGeometry(lowerShape, { depth: .065, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .026, bevelThickness: .025, curveSegments: 24 }), M.brass);
    lower.rotation.x = -Math.PI / 2; lower.position.y = -.13; tray.add(lower);
    const upper = new THREE.Mesh(new THREE.ExtrudeGeometry(platterShape, { depth: .075, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .023, curveSegments: 24 }), M.lightWood);
    upper.rotation.x = -Math.PI / 2; upper.position.y = -.075; tray.add(upper);
    const lipPoints = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU; lipPoints.push(new THREE.Vector3(1.115 * Math.cos(a), .047, .615 * Math.sin(a))); }
    const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPoints, true), 80, .035, 7, true), M.gold);
    tray.add(lip);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * TAU;
      ball(tray, M.brass, 1.075 * Math.cos(a), .022, .595 * Math.sin(a), .027);
    }
    box(tray, M.carvedWood, 0, .029, -.36, 1.48, .014, .023);
    box(tray, M.carvedWood, 0, .029, .38, 1.48, .014, .023);
    for (const side of [-1, 1]) {
      ball(tray, M.skin, side * .99, -.037, .28, .145, .085, .16);
      cylinder(tray, M.brass, side * .98, -.11, .28, .14, .035);
    }
    cups = [
      makeDrink({ x: -.68, z: .025, bottom: .13, max: .52, radius: .21, shell: M.glassA, liquid: M.ale, foam: M.foamA, color: M.particleAle, stability: .96, type: 0 }),
      makeDrink({ x: 0, z: -.07, bottom: .39, max: .34, radius: .23, shell: M.glassB, liquid: M.berry, foam: M.foamB, color: M.particleBerry, stability: 1.13, type: 1 }),
      makeDrink({ x: .68, z: .02, bottom: .14, max: .53, radius: .165, shell: M.glassC, liquid: M.mint, foam: M.foamC, color: M.particleMint, stability: 1.08, type: 2 })
    ];
  }
  function makeDrink(c) {
    const holder = new THREE.Group(); holder.position.set(c.x, c.type === 1 ? .015 : -.018, c.z); tray.add(holder);
    cylinder(tray, M.darkWood, c.x, .053, c.z, .285, .018);
    ring(tray, M.brass, .272, .019, c.x, .07, c.z);
    if (c.type === 0) {
      tapered(holder, c.shell, 0, .39, 0, .255, .215, .58, 14, true).renderOrder = 4;
      cylinder(holder, M.brass, 0, .12, 0, .22, .065);
      ring(holder, M.gold, .246, .025, 0, .687, 0).renderOrder = 5;
      ring(holder, M.brass, .218, .018, 0, .18, 0);
      const h = new THREE.Mesh(new THREE.TorusGeometry(.16, .047, 7, 17), M.brass);
      h.position.set(-.318, .42, 0); holder.add(h);
      ball(holder, M.gold, -.12, .45, .247, .035, .2, .018);
    } else if (c.type === 1) {
      cylinder(holder, M.brass, 0, .075, 0, .22, .055);
      cylinder(holder, M.gold, 0, .236, 0, .05, .29);
      ball(holder, M.brass, 0, .358, 0, .105, .052, .105);
      tapered(holder, c.shell, 0, .575, 0, .273, .137, .45, 16, true).renderOrder = 4;
      ring(holder, M.gold, .273, .025, 0, .8, 0).renderOrder = 5;
      ball(holder, M.gold, 0, .22, .056, .07, .045, .04);
      const moon = new THREE.Mesh(new THREE.TorusGeometry(.082, .02, 5, 14, Math.PI * 1.55), M.gold);
      moon.position.set(0, .58, .255); moon.rotation.z = -.65; holder.add(moon);
    } else {
      tapered(holder, c.shell, 0, .42, 0, .19, .23, .65, 12, true).renderOrder = 4;
      cylinder(holder, M.brass, 0, .11, 0, .214, .063);
      ring(holder, M.gold, .194, .024, 0, .748, 0).renderOrder = 5;
      ring(holder, M.brass, .217, .017, 0, .203, 0);
      const h = new THREE.Mesh(new THREE.TorusGeometry(.145, .036, 6, 16), M.brass);
      h.position.set(.275, .43, 0); holder.add(h);
      ball(holder, M.white, -.091, .44, .185, .021, .23, .013);
    }
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(c.radius, c.radius * .8, 1, 16), c.liquid);
    holder.add(liquid); liquid.renderOrder = 1;
    const surface = new THREE.Mesh(new THREE.CircleGeometry(c.radius * .98, 22), c.foam);
    surface.rotation.x = -Math.PI / 2; holder.add(surface); surface.renderOrder = 3;
    const foam = new THREE.Group(); holder.add(foam);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + (c.type * .6);
      ball(foam, c.foam, Math.cos(a) * c.radius * .67, 0, Math.sin(a) * c.radius * .65, .042 + (i % 2) * .016, .027, .036);
    }
    const bubbles = [];
    for (let i = 0; i < 4; i++) {
      const bubble = ball(holder, c.foam, (i - 1.5) * c.radius * .31, .2, (i % 2 ? 1 : -1) * c.radius * .3, .015 + (i % 3) * .007);
      bubbles.push(bubble);
    }
    return { ...c, holder, liquid, surface, foam, bubbles, fill: 1, xSway: 0, zSway: 0, vx: 0, vz: 0, lastSplash: 0 };
  }

  const schedule = [4.3, 7.2, 9.8, 12.8, 15.1, 17.6, 20.6, 23.0, 25.9, 28.8, 31.0, 33.6, 36.2, 38.6, 40.9, 42.4];
  function buildEvents() {
    const order = ['gnome', 'goblin', 'witch', 'dwarf', 'orc', 'mushroom', 'goblin', 'witch', 'gnome', 'orc', 'dwarf', 'mushroom', 'witch', 'goblin', 'orc', 'gnome'];
    events = schedule.map((time, i) => {
      const person = makePerson(order[i], i * 1.91);
      scene.add(person.root);
      const speech = quoteSprite(personStyles[order[i]].quote, i % 2 === 0);
      person.root.add(speech); speech.visible = false;
      const marker = new THREE.Mesh(new THREE.RingGeometry(.68, .78, 32), new THREE.MeshBasicMaterial({ color: '#ffd085', transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
      const markerCenter = new THREE.Mesh(new THREE.CircleGeometry(.16, 20), new THREE.MeshBasicMaterial({ color: '#ffd085', transparent: true, opacity: .44, side: THREE.DoubleSide, depthWrite: false }));
      markerCenter.rotation.x = -Math.PI / 2; markerCenter.visible = false; scene.add(markerCenter);
      return { i, baseTime: time, t: time, side: 1, z: -SPEED * time, power: 1, person, speech, marker, markerCenter, hit: false };
    });
  }
  function configureEvents() {
    const r = seeded(92941 + state.round * 8197);
    let previousSide = 0, sameSide = 0;
    events.forEach((e, i) => {
      e.t = clamp(e.baseTime + (r() - .5) * (i < 2 ? .18 : .35), e.baseTime - .19, e.baseTime + .19);
      let side = r() < .5 ? -1 : 1;
      if (side === previousSide) sameSide++; else sameSide = 0;
      if (sameSide >= 2) { side = -side; sameSide = 0; }
      previousSide = side; e.side = side;
      e.z = -SPEED * e.t - .45;
      e.power = .88 + r() * .32 + (i >= 12 ? .085 : 0);
      e.hit = false; e.person.root.visible = false; e.speech.visible = false;
      e.marker.visible = false; e.markerCenter.visible = false;
      e.marker.position.set(side * 1.04, .041, e.z);
      e.markerCenter.position.set(side * 1.04, .042, e.z);
      e.marker.material.color.set(side < 0 ? '#ff9d9e' : '#82f3d8');
      e.markerCenter.material.color.set(side < 0 ? '#ffc0a2' : '#92f4da');
    });
  }

  function createParticles(x, y, z, count, material, direction = 0, magical = false) {
    for (let i = 0; i < count && particles.length < 170; i++) {
      const mesh = new THREE.Mesh(magical ? STAR : DROP, material);
      const size = magical ? rand(.035, .083) : rand(.025, .07);
      mesh.scale.setScalar(size); mesh.position.set(x + rand(-.1, .1), y + rand(-.02, .06), z + rand(-.1, .1));
      scene.add(mesh);
      particles.push({ mesh, size, life: magical ? rand(.55, 1.1) : rand(.34, .8), max: magical ? 1.1 : .8,
        vx: rand(-.95, .95) + direction * (magical ? .5 : 1.05), vy: magical ? rand(.8, 2.65) : rand(.8, 2.3), vz: rand(-1.05, 1.05), magical });
    }
  }
  const worldPos = new THREE.Vector3();
  function splashCup(c, n, direction) {
    if (c.fill <= .005) return;
    c.holder.getWorldPosition(worldPos);
    createParticles(worldPos.x + direction * c.radius * .9, worldPos.y + c.bottom + c.max * c.fill, worldPos.z, n, c.color, direction, false);
  }
  function sparkleAt(x, y, z, n = 15) {
    createParticles(x, y, z, n, Math.random() > .5 ? M.particleGold : M.particleMint, 0, true);
  }
  function animateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
      p.vy -= (p.magical ? 3.1 : 5.9) * dt;
      p.mesh.rotation.x += dt * 4; p.mesh.rotation.z += dt * 5;
      p.mesh.scale.setScalar(p.size * clamp(p.life / (p.magical ? .65 : .48), 0, 1));
      if (p.life <= 0 || p.mesh.position.y < -.15) { scene.remove(p.mesh); particles.splice(i, 1); }
    }
  }

  // Sound remains silent until the first press. All media is saved locally beside this page.
  const music = new Audio('./assets/generate_music-1.mp3');
  music.loop = true; music.preload = 'auto'; music.volume = .25;
  let musicTarget = .29, audioUnlocked = false, audioContext = null;
  const soundPaths = { clink: './assets/generate_sfx-1.mp3', bump: './assets/generate_sfx-2.mp3', perfect: './assets/generate_sfx-3.mp3' };
  const soundPools = {};
  for (const name of Object.keys(soundPaths)) {
    soundPools[name] = { next: 0, pool: Array.from({ length: 3 }, () => {
      const a = new Audio(soundPaths[name]); a.preload = 'auto'; return a;
    }) };
  }
  function enableAudio() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audioContext = new AC(); } catch (_) { /* MP3 still works. */ } }
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    music.play().catch(() => {});
  }
  function sound(name, volume = .5) {
    if (!audioUnlocked) return;
    const item = soundPools[name]; if (!item) return;
    const a = item.pool[item.next++ % item.pool.length];
    try { a.pause(); a.currentTime = 0; a.volume = volume; a.play().catch(() => {}); } catch (_) { /* Audio is optional. */ }
  }
  function note(freq, duration = .13, volume = .026, delay = 0) {
    if (!audioContext) return;
    const start = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.07, start + duration);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(start); osc.stop(start + duration + .02);
  }

  function showCallout(main, sub, kind) {
    ui.callout.className = 'callout'; ui.calloutMain.textContent = main; ui.calloutSub.textContent = sub;
    void ui.callout.offsetWidth;
    ui.callout.classList.add('show'); if (kind) ui.callout.classList.add(kind);
    clearTimeout(calloutTimeout); calloutTimeout = setTimeout(() => { ui.callout.classList.remove('show'); }, 1450);
  }
  function haptic(pattern) {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* Optional. */ }
  }
  function impact(e) {
    e.hit = true;
    const gripStrength = state.held ? clamp((state.grip - .025) / .28, 0, 1) : 0;
    const heldFor = state.t - state.braceAt;
    const perfect = gripStrength > .75 && heldFor >= .065 && heldFor <= .78;
    const reduction = perfect ? .9 : .77 * gripStrength;
    const force = e.power * (1 - reduction);
    cups.forEach((c) => {
      const outside = 1 + e.side * c.x * .31;
      c.vx += e.side * 6.4 * force * c.stability * outside;
      c.vz += (1.2 + (e.i % 3) * .15) * force * (e.i % 2 ? -1 : 1);
      if (gripStrength < .2) c.fill = Math.max(0, c.fill - .008 * e.power);
      else if (gripStrength > .48 && !perfect) { c.fill = Math.max(0, c.fill - .0048 * e.power); splashCup(c, 2, e.side); }
    });
    rollVelocity += e.side * force * .76; pitchVelocity += force * (e.i % 2 ? -.19 : .19);
    state.shake = Math.max(state.shake, perfect ? .26 : gripStrength > .5 ? .43 : .95);
    state.flash = perfect ? .14 : gripStrength > .5 ? .095 : .18;
    ui.flash.style.backgroundColor = perfect ? '#80ffcc' : gripStrength > .5 ? '#ffd18e' : '#ff677e';
    if (perfect) {
      haptic(12); state.perfects++; state.streak++; state.lastPerfect = state.t;
      state.grip = Math.min(1, state.grip + .115);
      showCallout(state.streak >= 3 ? 'WHAT A CATCH!' : 'PERFECT CATCH!', state.streak >= 2 ? `${state.streak} IN A ROW  ✦  GRIP RESTORED` : 'THE TAVERN APPROVES  ✦  GRIP RESTORED', '');
      sound('perfect', .42); note(523.25, .16, .025); note(783.99, .22, .019, .075);
      sparkleAt(e.side * .85, 1.65, heroZ - .65, 21);
    } else if (gripStrength > .48) {
      haptic(18); state.streak = 0;
      showCallout(['STEADY HANDS!', 'NICE SAVE!', 'HELD TOGETHER!'][e.i % 3], 'THE DRINKS LIVE TO SEE ANOTHER STEP', 'steady');
      sound('clink', .29); note(392, .09, .014);
      sparkleAt(e.side * .85, 1.58, heroZ - .56, 6);
    } else {
      haptic([26, 35, 15]); state.streak = 0;
      showCallout(state.held ? 'TIRED ARMS!' : ['OOF, AN ELBOW!', 'OH, BISCUITS!', 'MIND THE MEAD!'][e.i % 3], state.held ? 'LET GO TO GET YOUR GRIP BACK' : 'A LITTLE MORE ON THE FLOOR', 'bad');
      sound('bump', .49); note(164, .16, .028);
      cups.forEach(c => splashCup(c, 5, e.side));
    }
  }
  function updateEventPeople() {
    for (const e of events) {
      const d = e.t - state.t;
      const active = state.mode === 'play' && d < 4.25 && d > -.9;
      e.person.root.visible = active;
      if (!active) { e.marker.visible = e.markerCenter.visible = e.speech.visible = false; continue; }
      const x = e.side * clamp(.93 + d * 1.35, -1.1, 3.65);
      e.person.root.position.x = x; e.person.root.position.z = e.z;
      e.person.root.rotation.y = -e.side * .48 + Math.sin(globalTime * 3 + e.i) * .045;
      e.person.root.rotation.z = -e.side * (.035 + .12 * Math.exp(-d * d * 8));
      e.speech.visible = d < 1.75 && d > -.12;
      e.marker.visible = e.markerCenter.visible = d < 1.88 && d > -.27;
      if (e.marker.visible) {
        const proximity = clamp(1 - d / 1.88, 0, 1);
        e.marker.scale.setScalar(mix(1.34, .75, proximity));
        e.marker.material.opacity = .32 + proximity * .52 + Math.sin(globalTime * 15) * .07;
        e.markerCenter.material.opacity = .17 + proximity * .38;
      }
    }
  }
  function updateThreat() {
    const next = events.find(e => !e.hit && e.t - state.t < 1.88 && e.t - state.t > 0);
    if (!next) { ui.threat.classList.add('hidden'); return; }
    const d = next.t - state.t;
    ui.threat.classList.remove('hidden', 'left', 'right');
    ui.threat.classList.add(next.side < 0 ? 'left' : 'right');
    ui.threatName.textContent = personStyles[next.person.type].name;
    ui.threatArrow.textContent = next.side < 0 ? '←' : '→';
    ui.threatFill.style.transform = `scaleX(${clamp(1 - d / 1.88, 0, 1)})`;
  }
  function updateCupPhysics(dt) {
    const braced = state.held && state.grip > .045;
    for (let i = 0; i < cups.length; i++) {
      const c = cups[i];
      const walk = braced ? .25 : 1;
      const time = state.t;
      c.vx += (-18 * c.xSway - (braced ? 8.7 : 3.3) * c.vx + Math.sin(time * 9.3 + i * .71) * .42 * walk) * dt;
      c.vz += (-17 * c.zSway - (braced ? 8.5 : 3.4) * c.vz + Math.cos(time * 7.4 + i * 1.13) * .34 * walk) * dt;
      c.xSway = clamp(c.xSway + c.vx * dt, -2.5, 2.5);
      c.zSway = clamp(c.zSway + c.vz * dt, -2.5, 2.5);
      const magnitude = Math.hypot(c.xSway, c.zSway * .72);
      const threshold = c.type === 1 ? .385 : .425;
      if (magnitude > threshold && c.fill > 0) {
        c.fill = Math.max(0, c.fill - dt * .235 * Math.pow(magnitude - threshold, 1.16));
        if (Math.random() < dt * (7 + (magnitude - threshold) * 15)) splashCup(c, 1, Math.sign(c.xSway) || 1);
      }
    }
    rollVelocity += (-trayRoll * 20 - rollVelocity * (braced ? 8.4 : 5.7)) * dt;
    pitchVelocity += (-trayPitch * 18 - pitchVelocity * (braced ? 8.4 : 5.7)) * dt;
    trayRoll = clamp(trayRoll + rollVelocity * dt, -.22, .22);
    trayPitch = clamp(trayPitch + pitchVelocity * dt, -.15, .15);
  }
  function updateDrinksVisual() {
    const playing = state.mode === 'play';
    tray.position.y = 1.46 + (playing ? Math.sin(state.t * 10.2) * (state.held && state.grip > .06 ? .012 : .035) : Math.sin(globalTime * 2) * .011);
    const avgSway = cups.reduce((a, c) => a + c.xSway, 0) / 3;
    tray.rotation.z = (playing ? trayRoll - avgSway * .025 : Math.sin(globalTime * 1.5) * .012);
    tray.rotation.x = (playing ? trayPitch + Math.sin(state.t * 7) * .012 : Math.cos(globalTime * 1.3) * .011);
    for (let i = 0; i < cups.length; i++) {
      const c = cups[i];
      const f = c.fill;
      const liquidHeight = .018 + c.max * f;
      c.liquid.visible = c.surface.visible = c.foam.visible = f > .006;
      c.liquid.scale.y = liquidHeight; c.liquid.position.y = c.bottom + liquidHeight * .5;
      c.surface.position.y = c.bottom + liquidHeight + .008;
      c.surface.rotation.set(-Math.PI / 2 + c.zSway * .14, 0, -c.xSway * .18);
      c.foam.position.y = c.bottom + liquidHeight + .014;
      c.foam.rotation.y = globalTime * .6 + i;
      for (let b = 0; b < c.bubbles.length; b++) {
        const bubble = c.bubbles[b];
        bubble.visible = f > .15;
        bubble.position.y = c.bottom + .04 + ((globalTime * (.28 + b * .055) + b * .27) % 1) * Math.max(.03, liquidHeight - .07);
      }
    }
  }
  function updateHud() {
    ui.clock.textContent = '0:' + String(Math.max(0, Math.ceil(DURATION - state.t))).padStart(2, '0');
    const progress = clamp(state.t / DURATION * 100, 0, 100);
    ui.route.style.width = progress + '%'; ui.marker.style.left = progress + '%';
    for (let i = 0; i < 3; i++) ui.minis[i].style.height = Math.round(cups[i].fill * 85 + 3) + '%';
    ui.grip.style.width = Math.round(state.grip * 100) + '%';
    ui.gripBar.classList.toggle('low', state.grip < .2);
    ui.gripStatus.textContent = state.held ? state.grip < .17 ? 'LET GO TO REST!' : 'BRACING...' : 'RECHARGING';
    ui.hud.classList.toggle('urgent', state.t >= 34);
    ui.hint.classList.toggle('hidden', state.t > 6.3);
    const showCombo = state.streak >= 2 && state.t - state.lastPerfect < 3.2;
    ui.combo.classList.toggle('hidden', !showCombo);
    if (showCombo) ui.comboNumber.textContent = '×' + state.streak;
    ui.flash.style.opacity = state.flash.toFixed(3);
    updateThreat();
  }
  function updateGame(dt) {
    state.t = Math.min(DURATION, state.t + dt);
    heroZ = -SPEED * state.t;
    state.grip = clamp(state.grip + dt * (state.held ? -.33 : .51), 0, 1);
    for (const e of events) if (!e.hit && state.t >= e.t) impact(e);
    updateCupPhysics(dt);
    updateEventPeople();
    state.shake *= Math.exp(-dt * 9);
    state.flash = Math.max(0, state.flash - dt * .82);
    updateHud();
    if (state.t >= DURATION) beginDelivery();
  }
  function beginDelivery() {
    state.mode = 'delivery'; deliveryDelay = 1.04;
    state.held = false; keyHeld = false; pointerHeld = false;
    ui.threat.classList.add('hidden'); ui.hint.classList.add('hidden');
    ui.combo.classList.add('hidden');
    musicTarget = .19;
    sound('clink', .57);
    if (cups.reduce((sum, c) => sum + c.fill, 0) / 3 > .46) {
      sparkleAt(0, 2.2, heroZ - 1.5, 38);
      note(392, .23, .028); note(493.88, .3, .022, .11); note(587.33, .39, .023, .22); note(783.99, .53, .018, .35);
    } else { note(293.66, .2, .02); note(246.94, .38, .016, .17); }
  }
  function showEnding() {
    const average = cups.reduce((sum, c) => sum + c.fill, 0) / 3;
    const score = Math.round(average * 100);
    const newBest = score > state.best;
    if (newBest) {
      state.best = score;
      try { localStorage.setItem('tipsy-griffin-best', String(score)); } catch (_) { /* Still playable. */ }
    }
    let title, kicker, description;
    if (score >= 99) {
      title = 'NOT. A. DROP.'; kicker = 'THE TAVERN HAS A NEW LEGEND';
      description = 'Even the chandelier stopped to applaud. Absolutely impeccable service.';
    } else if (score >= 82) {
      title = 'SERVICE WITH SWAGGER.'; kicker = 'THREE VERY HAPPY CUSTOMERS';
      description = 'The whole room raises a toast to your remarkably steady hands.';
    } else if (score >= 51) {
      title = 'A SPLASH OF GLORY.'; kicker = 'THE ORDER IS IN';
      description = 'A few drops for the floorboards. Plenty left for the heroes.';
    } else if (score >= 28) {
      title = 'MOSTLY DELIVERED.'; kicker = 'A NOBLE, STICKY EFFORT';
      description = 'The drinks had an adventure. The floorboards had a feast.';
    } else {
      title = 'THE FLOOR IS THIRSTY.'; kicker = 'AN UNFORGETTABLE DELIVERY';
      description = 'The good news: the tray made it. The other news is on your shoes.';
    }
    ui.endTitle.textContent = title; ui.endKicker.textContent = kicker;
    ui.endNumber.innerHTML = score + '<span>%</span>';
    ui.endDescription.textContent = description;
    ui.endCatches.textContent = `${state.perfects} perfect ${state.perfects === 1 ? 'catch' : 'catches'}`;
    ui.endBest.textContent = `${newBest ? '✦ NEW BEST' : 'BEST'} ${state.best}%`;
    ui.ending.classList.remove('hidden'); ui.hud.classList.add('hidden'); ui.bottom.classList.add('hidden');
    state.mode = 'end';
  }
  function startRound() {
    enableAudio();
    state.round++; state.mode = 'play'; state.t = 0; state.grip = 1;
    state.held = keyHeld || pointerHeld; state.braceAt = -99;
    state.perfects = 0; state.streak = 0; state.lastPerfect = -99; state.shake = 0; state.flash = 0;
    heroZ = 0; trayRoll = rollVelocity = trayPitch = pitchVelocity = 0;
    for (const c of cups) { c.fill = 1; c.xSway = c.zSway = c.vx = c.vz = 0; }
    for (const p of particles) scene.remove(p.mesh); particles = [];
    configureEvents();
    ui.intro.classList.add('hidden'); ui.ending.classList.add('hidden');
    ui.hud.classList.remove('hidden'); ui.bottom.classList.remove('hidden');
    ui.callout.className = 'callout'; ui.threat.classList.add('hidden');
    musicTarget = .29; sound('clink', .38); note(392, .15, .018); note(587.33, .18, .016, .075);
    updateHud();
  }
  function onPress() {
    if (state.mode === 'intro' || state.mode === 'end') { startRound(); return; }
    if (state.mode === 'play' && !state.held) { state.held = true; state.braceAt = state.t; }
  }
  function onRelease() {
    if (state.mode === 'play' && !keyHeld && !pointerHeld) state.held = false;
  }
  window.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat || keyHeld) return;
    keyHeld = true; onPress();
  });
  window.addEventListener('keyup', e => {
    if (e.code !== 'Space') return;
    e.preventDefault(); keyHeld = false; onRelease();
  });
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (pointerHeld) return;
    pointerHeld = true; onPress();
  }, { passive: false });
  window.addEventListener('pointerup', () => { pointerHeld = false; onRelease(); });
  window.addEventListener('pointercancel', () => { pointerHeld = false; onRelease(); });
  window.addEventListener('blur', () => { keyHeld = false; pointerHeld = false; onRelease(); });
  window.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    previousFrame = performance.now();
    if (document.hidden) { music.pause(); keyHeld = false; pointerHeld = false; onRelease(); }
    else if (audioUnlocked) music.play().catch(() => {});
  });

  function resize() {
    canvasWidth = Math.max(1, ui.world.clientWidth); canvasHeight = Math.max(1, ui.world.clientHeight);
    const aspect = canvasWidth / canvasHeight;
    camera.aspect = aspect; camera.fov = aspect < .76 ? 61 : aspect < 1.05 ? 57 : 51;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, canvasWidth < 700 ? 1.45 : 1.7));
    renderer.setSize(canvasWidth, canvasHeight, false);
  }
  function animateWorld(dt) {
    const t = globalTime;
    for (const chunk of sceneryChunks) chunk.visible = Math.abs(chunk.position.z - heroZ) < 65;
    goal.visible = Math.abs(GOAL_Z - heroZ) < 65;
    for (const light of lightSprites) {
      const s = light.base * (1 + Math.sin(t * 4 + light.phase) * .052);
      light.sprite.scale.set(s, s, 1);
    }
    for (const p of ambientPeople) {
      p.root.position.y = Math.sin(t * 2.2 + p.phase) * .031;
      p.head.rotation.y = Math.sin(t * 1.15 + p.phase) * .23;
      p.arms[0].rotation.x = Math.sin(t * 2.8 + p.phase) * .2;
      p.arms[1].rotation.x = Math.cos(t * 2.6 + p.phase) * .28;
    }
    for (const e of events) {
      if (!e.person.root.visible) continue;
      const p = e.person;
      p.root.position.y = Math.abs(Math.sin(t * 8.2 + p.phase)) * .065;
      p.legs[0].rotation.x = Math.sin(t * 8.2 + p.phase) * .52;
      p.legs[1].rotation.x = -p.legs[0].rotation.x;
      p.arms[0].rotation.x = -p.legs[0].rotation.x * .68;
      p.arms[1].rotation.x = p.legs[0].rotation.x * .68;
      p.head.rotation.z = Math.sin(t * 4.1 + p.phase) * .055;
    }
    animateParticles(dt);
    updateDrinksVisual();
    hero.position.z = heroZ;
    const aspect = canvasWidth / canvasHeight;
    const portrait = aspect < .9;
    const cameraDistance = portrait ? 5.34 : 4.04;
    const bob = state.mode === 'play' ? Math.sin(state.t * 10.2) * (state.held && state.grip > .05 ? .012 : .035) : Math.sin(globalTime * 1.18) * .019;
    const shake = state.shake;
    const cameraX = trayRoll * .22 + Math.sin(globalTime * .68) * .025 + (Math.random() - .5) * shake * .15;
    camera.position.set(cameraX, (portrait ? 3.37 : 3.13) + bob + (Math.random() - .5) * shake * .09, heroZ + cameraDistance + (Math.random() - .5) * shake * .045);
    camera.lookAt(cameraX * .12, portrait ? 1.74 : 1.7, heroZ - 4.1);
    directional.position.z = heroZ + 4; directional.target.position.z = heroZ - 4; directional.target.updateMatrixWorld();
    warmLight.position.z = heroZ - 1; coolLight.position.z = heroZ - 9;
    if (audioUnlocked && !music.paused) music.volume += (musicTarget - music.volume) * Math.min(1, dt * 2.5);
    ui.flash.style.opacity = state.flash.toFixed(3);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(.075, Math.max(0, (now - previousFrame) / 1000)); previousFrame = now;
    if (document.hidden) return;
    globalTime += dt;
    if (state.mode === 'play') updateGame(dt);
    else if (state.mode === 'delivery') {
      deliveryDelay -= dt; state.shake *= Math.exp(-dt * 9);
      state.flash = Math.max(0, state.flash - dt * .82);
      if (deliveryDelay <= 0) showEnding();
    } else if (state.mode === 'intro') {
      heroZ = 0;
      for (let i = 0; i < cups.length; i++) {
        cups[i].xSway = Math.sin(globalTime * 1.43 + i * 1.1) * .045;
        cups[i].zSway = Math.cos(globalTime * 1.2 + i * .7) * .035;
      }
    } else if (state.mode === 'end') {
      state.flash = Math.max(0, state.flash - dt * .82);
      trayRoll *= Math.exp(-dt * 2); trayPitch *= Math.exp(-dt * 2);
      for (const c of cups) { c.xSway *= Math.exp(-dt * 2.5); c.zSway *= Math.exp(-dt * 2.5); }
    }
    animateWorld(dt);
    renderer.render(scene, camera);
  }

  try {
    scene = new THREE.Scene(); scene.background = new THREE.Color('#261829');
    scene.fog = new THREE.FogExp2('#281b2d', .019);
    camera = new THREE.PerspectiveCamera(51, 1, .075, 110);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.53;
    ui.world.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#ffdbb5', '#302041', 2.1));
    directional = new THREE.DirectionalLight('#ffc482', 2.5);
    directional.position.set(-4, 8, 4); directional.target.position.set(0, 0, -4); scene.add(directional, directional.target);
    warmLight = new THREE.PointLight('#ff9268', 33, 16, 2);
    warmLight.position.set(-3.1, 3.3, -1); scene.add(warmLight);
    coolLight = new THREE.PointLight('#78efde', 27, 17, 2);
    coolLight.position.set(3.3, 3.7, -9); scene.add(coolLight);
    buildEnvironment(); makeTray(); buildEvents(); resize();
    window.addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(ui.world);
    requestAnimationFrame(frame);
  } catch (error) {
    console.error('Could not open the tavern:', error);
    ui.fallback.hidden = false;
  }
})();
