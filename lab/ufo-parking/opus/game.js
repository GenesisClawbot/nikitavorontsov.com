/* Saucer Parking — a tiny one-button Three.js game.
   Hold to thrust in the direction of the spinning arrow; release to drift and re-aim.
   Come to rest inside the glowing stall to park. 45 second rounds. */
(() => {
'use strict';
const T = window.THREE;
const errBox = document.getElementById('err');
function fail(msg) { errBox.style.display = 'flex'; errBox.textContent = msg; }
if (!T) { fail('Three.js failed to load (three.global.js missing).'); return; }

// ------------------------------------------------------------------ utils
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------------ constants
const LOT = { minX: -19, maxX: 19, minZ: -13, maxZ: 13 };
const LOT_W = LOT.maxX - LOT.minX, LOT_D = LOT.maxZ - LOT.minZ;
const ROWS = [-9.5, 0, 9.5];
const STALL_W = 3, STALL_D = 5, STALLS_PER_ROW = 10, STALL_X0 = -15;
const LANES = [-4.75, 4.75];
const UFO_R = 1.1, HOVER_Y = 1.05;
const THRUST = 13, DRAG = 1.25, MAX_SPEED = 9.5, REST = 0.55, ZONE_DRAG = 2.2;
const ROUND_TIME = 45;
const ZONE_X = 0.6, ZONE_Z = 1.3, PARK_SPEED = 1.8, PARK_TIME = 0.6;
const CAR_HX = 0.92, CAR_HZ = 1.97;
const LAMPS = [[-15.8, -9.5], [15.8, -9.5], [-15.8, 0], [15.8, 0], [-15.8, 9.5], [15.8, 9.5]];
const LAMP_R = 0.36;
const N_CARS = 20;
const ROT_START = 3.1, ROT_MAX = 5.2, ROT_STEP = 0.17;

// ------------------------------------------------------------------ renderer
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fail('WebGL is not available in this browser.');
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);

const scene = new T.Scene();
scene.background = new T.Color(0x0a0620);
scene.fog = new T.FogExp2(0x1a0f33, 0.012);
const camera = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 900);
camera.position.set(0, 14, 30);

// ------------------------------------------------------------------ texture helpers
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
const radialTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const shadowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const dotTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const vGradTex = canvasTex(8, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  gr.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const coneTex = canvasTex(8, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0.08)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// ------------------------------------------------------------------ environment (reflections)
function buildEnvMap() {
  const envScene = new T.Scene();
  const skyT = canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#262065');
    gr.addColorStop(0.42, '#5a2d8a');
    gr.addColorStop(0.5, '#ff7ac0');
    gr.addColorStop(0.55, '#2a1640');
    gr.addColorStop(1, '#08060e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  envScene.add(new T.Mesh(new T.SphereGeometry(40, 32, 16), new T.MeshBasicMaterial({ map: skyT, side: T.BackSide })));
  const panel = (x, y, z, w, h, r, gg, b) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(r, gg, b), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(0, 30, 0.1, 22, 22, 1.1, 1.1, 1.6);
  panel(26, 10, 10, 9, 3, 4, 2.6, 1.3);
  panel(-26, 10, -10, 9, 3, 4, 2.6, 1.3);
  panel(0, 8, -30, 18, 3, 3.2, 0.9, 2.6);
  panel(-12, 6, 28, 10, 2, 0.7, 2.6, 3.2);
  const pm = new T.PMREMGenerator(renderer);
  const rt = pm.fromScene(envScene, 0.02);
  pm.dispose();
  return rt.texture;
}
try {
  scene.environment = buildEnvMap();
  scene.environmentIntensity = 0.75;
} catch (e) { /* reflections are optional */ }

// ------------------------------------------------------------------ lights
scene.add(new T.HemisphereLight(0x7a86ff, 0x2a1830, 0.9));
const moonLight = new T.DirectionalLight(0xb8c4ff, 0.85);
moonLight.position.set(-30, 50, -20);
scene.add(moonLight);

// ------------------------------------------------------------------ sky, stars, moon, skyline
function buildSky() {
  const skyT = canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#05041a');
    gr.addColorStop(0.3, '#150c3a');
    gr.addColorStop(0.46, '#4a1f6e');
    gr.addColorStop(0.5, '#b0407e');
    gr.addColorStop(0.53, '#2a1238');
    gr.addColorStop(1, '#07050f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const sky = new T.Mesh(new T.SphereGeometry(450, 32, 16), new T.MeshBasicMaterial({ map: skyT, side: T.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  const n = 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * TAU, ph = Math.acos(rand(0.08, 1));
    const r = 400;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    const b = rand(0.4, 1), tint = Math.random();
    col[i * 3] = b * (tint > 0.8 ? 1 : 0.85); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (tint < 0.3 ? 1 : 0.95);
  }
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.BufferAttribute(pos, 3));
  sg.setAttribute('color', new T.BufferAttribute(col, 3));
  const stars = new T.Points(sg, new T.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }));
  scene.add(stars);

  const moonTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,250,235,1)');
    gr.addColorStop(0.33, 'rgba(255,245,225,1)');
    gr.addColorStop(0.36, 'rgba(210,190,255,0.35)');
    gr.addColorStop(1, 'rgba(120,80,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(200,190,210,0.35)';
    [[110, 110, 12], [150, 135, 9], [120, 150, 7], [140, 100, 6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
  });
  const moon = new T.Sprite(new T.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
  moon.position.set(-120, 110, -260);
  moon.scale.set(90, 90, 1);
  scene.add(moon);

  // skyline
  const winTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0b0a18'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? '#16162a' : v < 0.8 ? '#ffd27a' : v < 0.92 ? '#9fe7ff' : '#ff9ad8';
      g.fillRect(c * 32 + 7, r * 32 + 9, 18, 14);
    }
  });
  winTex.wrapS = winTex.wrapT = T.RepeatWrapping;
  const bMat = new T.MeshBasicMaterial({ map: winTex, color: 0x8f8ab8 });
  const roofMat = new T.MeshBasicMaterial({ color: 0xff3355 });
  for (let i = 0; i < 46; i++) {
    const a = rand(0, TAU), r = rand(60, 105);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = rand(7, 18), h = rand(10, 48) * (z < 0 ? 1.2 : 0.8), d = rand(7, 14);
    const geo = new T.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 7, uv.getY(k) * h / 9);
    const m = new T.Mesh(geo, bMat);
    m.position.set(x, h / 2 - 0.1, z);
    m.lookAt(0, h / 2, 0);
    scene.add(m);
    if (h > 34) {
      const bl = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), roofMat);
      bl.position.set(x, h + 0.6, z);
      scene.add(bl);
      blinkers.push(bl);
    }
  }
}
const blinkers = [];
buildSky();

// ------------------------------------------------------------------ parking lot surface
function makeLotTexture() {
  const W = 2048, H = Math.round(2048 * LOT_D / LOT_W);
  return canvasTex(W, H, (g) => {
    const sx = W / LOT_W, sz = H / LOT_D;
    const X = (x) => (x - LOT.minX) * sx, Z = (z) => (z - LOT.minZ) * sz;
    g.fillStyle = '#2b2a35'; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 26 - 13 + (Math.random() < 0.015 ? 22 : 0);
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = rand(40, 200);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.65;
      gr.addColorStop(0, dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // cracks
    g.strokeStyle = 'rgba(8,8,12,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 38; i++) {
      let x = Math.random() * W, y = Math.random() * H, a = Math.random() * TAU;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { a += rand(-0.8, 0.8); x += Math.cos(a) * rand(8, 30); y += Math.sin(a) * rand(8, 30); g.lineTo(x, y); }
      g.stroke();
    }
    // oil stains in stall middles
    for (const rz of ROWS) for (let i = 0; i < STALLS_PER_ROW; i++) {
      if (Math.random() < 0.5) continue;
      const x = X(STALL_X0 + STALL_W * (i + 0.5) + rand(-0.4, 0.4)), y = Z(rz + rand(-0.8, 0.8)), r = rand(18, 40);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(5,5,10,0.45)'); gr.addColorStop(1, 'rgba(5,5,10,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const line = (x1, z1, x2, z2, w, color) => {
      g.strokeStyle = color; g.lineWidth = w * sx; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke();
    };
    const white = 'rgba(236,234,226,0.88)';
    ROWS.forEach((rz, ri) => {
      for (let i = 0; i <= STALLS_PER_ROW; i++) {
        const x = STALL_X0 + i * STALL_W;
        line(x, rz - STALL_D / 2, x, rz + STALL_D / 2, 0.13, white);
      }
      if (ri === 0) line(STALL_X0 - 0.065, rz - STALL_D / 2, -STALL_X0 + 0.065, rz - STALL_D / 2, 0.13, white);
      if (ri === 2) line(STALL_X0 - 0.065, rz + STALL_D / 2, -STALL_X0 + 0.065, rz + STALL_D / 2, 0.13, white);
      if (ri === 1) line(STALL_X0, 0, -STALL_X0, 0, 0.05, 'rgba(236,234,226,0.25)');
    });
    // lane arrows
    const arrow = (x, z, dir) => {
      g.save(); g.translate(X(x), Z(z)); g.scale(dir * sx, sz);
      g.fillStyle = 'rgba(236,234,226,0.7)';
      g.beginPath();
      g.moveTo(-1.6, -0.17); g.lineTo(0.4, -0.17); g.lineTo(0.4, -0.55); g.lineTo(1.4, 0);
      g.lineTo(0.4, 0.55); g.lineTo(0.4, 0.17); g.lineTo(-1.6, 0.17); g.closePath(); g.fill();
      g.restore();
    };
    arrow(-8, LANES[0], 1); arrow(8, LANES[0], 1); arrow(8, LANES[1], -1); arrow(-8, LANES[1], -1);
    // lamp islands
    for (const [lx, lz] of LAMPS) {
      g.fillStyle = 'rgba(255,196,40,0.85)';
      g.beginPath(); g.arc(X(lx), Z(lz), 0.62 * sx, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,30,30,0.8)'; g.lineWidth = 0.1 * sx;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(X(lx + k * 0.25 - 0.4), Z(lz - 0.5)); g.lineTo(X(lx + k * 0.25 + 0.4), Z(lz + 0.5)); g.stroke(); }
    }
    // end lane paint
    g.fillStyle = 'rgba(236,234,226,0.5)';
    g.font = `900 ${Math.round(0.95 * sx)}px Trebuchet MS, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of [-1, 1]) {
      g.save(); g.translate(X(s * 17.5), Z(0)); g.rotate(s * Math.PI / 2);
      g.fillText('SAUCERS ONLY', 0, 0);
      g.restore();
    }
    // edge line
    g.strokeStyle = 'rgba(255,196,40,0.75)'; g.lineWidth = 0.14 * sx;
    g.strokeRect(X(LOT.minX + 0.35), Z(LOT.minZ + 0.35), (LOT_W - 0.7) * sx, (LOT_D - 0.7) * sz);
    // wear over the paint
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${40 + Math.random() * 10 | 0},${39 + Math.random() * 10 | 0},${48 + Math.random() * 10 | 0},${rand(0.3, 0.8).toFixed(2)})`;
      const s = rand(1, 4);
      g.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
  });
}

// ------------------------------------------------------------------ world
const cars = [];
const stalls = [];
ROWS.forEach((rz, ri) => { for (let i = 0; i < STALLS_PER_ROW; i++) stalls.push({ x: STALL_X0 + STALL_W * (i + 0.5), z: rz, row: ri, car: null }); });

const CAR_COLORS = [0xd62839, 0xeeeeee, 0x3a86ff, 0xffb703, 0x2a9d8f, 0x8338ec, 0xfb5607, 0x9aa5b1, 0x1a1c22, 0x06d6a0, 0xff70a6];
const carBodyMats = CAR_COLORS.map((c) => new T.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.3 }));
const glassMat = new T.MeshStandardMaterial({ color: 0x0c1422, metalness: 0.9, roughness: 0.08, flatShading: true });
const tireMat = new T.MeshStandardMaterial({ color: 0x121214, roughness: 0.9 });
const G_BODY = new T.BoxGeometry(1.8, 0.55, 3.9);
const G_CABIN = (() => { const g = new T.CylinderGeometry(0.72, 1, 0.5, 4, 1); g.rotateY(Math.PI / 4); g.scale(0.75 / 0.7071, 1, 1.0 / 0.7071); return g; })();
const G_ROOF = new T.BoxGeometry(1.1, 0.06, 1.46);
const G_WHEEL = (() => { const g = new T.CylinderGeometry(0.32, 0.32, 0.24, 14); g.rotateZ(Math.PI / 2); return g; })();
const G_LIGHT = new T.BoxGeometry(0.38, 0.14, 0.05);
const G_CARSHADOW = (() => { const g = new T.PlaneGeometry(2.6, 4.7); g.rotateX(-Math.PI / 2); return g; })();
const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 });

function buildCar(bodyMat) {
  const root = new T.Group(), tilt = new T.Group(), model = new T.Group();
  root.add(tilt); tilt.add(model);
  const body = new T.Mesh(G_BODY, bodyMat); body.position.y = 0.6; model.add(body);
  const cabin = new T.Mesh(G_CABIN, glassMat); cabin.position.set(0, 1.12, -0.2); model.add(cabin);
  const roof = new T.Mesh(G_ROOF, bodyMat); roof.position.set(0, 1.4, -0.2); model.add(roof);
  for (const sx of [-0.86, 0.86]) for (const sz of [-1.25, 1.25]) {
    const w = new T.Mesh(G_WHEEL, tireMat); w.position.set(sx, 0.32, sz); model.add(w);
  }
  const headMat = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1c4, emissiveIntensity: 0.25 });
  const tailMat = new T.MeshStandardMaterial({ color: 0x220808, emissive: 0xff2a2a, emissiveIntensity: 0.45 });
  for (const sx of [-0.6, 0.6]) {
    const h = new T.Mesh(G_LIGHT, headMat); h.position.set(sx, 0.68, 1.955); model.add(h);
    const t = new T.Mesh(G_LIGHT, tailMat); t.position.set(sx, 0.72, -1.955); model.add(t);
  }
  const shadow = new T.Mesh(G_CARSHADOW, shadowMat); shadow.position.y = 0.011; root.add(shadow);
  scene.add(root);
  return { root, tilt, model, body, roof, headMat, tailMat, x: 0, z: 0, hx: CAR_HX, hz: CAR_HZ, vx: 0,
    alarm: 0, jx: 0, jz: 0, jvx: 0, jvz: 0, lastSnd: -9, active: true };
}

function buildWorld() {
  const far = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ color: 0x0c0e16, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.06; scene.add(far);
  const apron = new T.Mesh(new T.PlaneGeometry(LOT_W + 8, LOT_D + 9), new T.MeshStandardMaterial({ color: 0x3b3a48, roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.03, -0.5); scene.add(apron);
  const lotTex = makeLotTexture();
  const lot = new T.Mesh(new T.PlaneGeometry(LOT_W, LOT_D), new T.MeshStandardMaterial({ map: lotTex, roughness: 0.86, metalness: 0, envMapIntensity: 0.4 }));
  lot.rotation.x = -Math.PI / 2; scene.add(lot);

  // roads for the patrol car
  const roadMat = new T.MeshStandardMaterial({ color: 0x1d1c24, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const r = new T.Mesh(new T.PlaneGeometry(6, 200), roadMat); r.rotation.x = -Math.PI / 2; r.position.set(s * 27, -0.02, 0); scene.add(r);
    for (const lz of LANES) {
      const c = new T.Mesh(new T.PlaneGeometry(5, 4.5), roadMat); c.rotation.x = -Math.PI / 2; c.position.set(s * 21.5, -0.015, lz); scene.add(c);
    }
  }

  // curbs (gaps where lanes exit)
  const curbMat = new T.MeshStandardMaterial({ color: 0x8c8a9c, roughness: 0.8 });
  const curb = (x, z, w, d) => { const m = new T.Mesh(new T.BoxGeometry(w, 0.18, d), curbMat); m.position.set(x, 0.09, z); scene.add(m); };
  curb(0, LOT.minZ - 0.15, LOT_W + 0.6, 0.3);
  curb(0, LOT.maxZ + 0.15, LOT_W + 0.6, 0.3);
  for (const s of [-1, 1]) { const x = s * (LOT.maxX + 0.15); curb(x, -10, 0.3, 6); curb(x, 0, 0.3, 5); curb(x, 10, 0.3, 6); }

  // hedges along the near edge (kept low so they never hide the lot)
  const hedgeMat = new T.MeshStandardMaterial({ color: 0x17392c, roughness: 0.9 });
  for (let x = -18; x <= 18; x += 2.4) {
    const h = new T.Mesh(new T.SphereGeometry(1, 8, 6), hedgeMat);
    h.scale.set(1.3, 0.45, 0.8); h.position.set(x + rand(-0.3, 0.3), 0.2, 14.6); scene.add(h);
  }
  // trees at the sides
  const leafMat = new T.MeshStandardMaterial({ color: 0x1b4a3c, roughness: 0.85, flatShading: true });
  const trunkMat = new T.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 });
  for (const s of [-1, 1]) for (const z of [-11.2, -8.6, 9.2, 11.8]) {
    const tr = new T.Mesh(new T.CylinderGeometry(0.14, 0.2, 1.2, 6), trunkMat); tr.position.set(s * 21.6, 0.6, z); scene.add(tr);
    const hgt = rand(2.6, 3.6);
    const cone = new T.Mesh(new T.ConeGeometry(1.3, hgt, 7), leafMat); cone.position.set(s * 21.6, 1.1 + hgt / 2, z); cone.rotation.y = rand(0, TAU); scene.add(cone);
  }

  // store
  const storeMat = new T.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.8 });
  const store = new T.Mesh(new T.BoxGeometry(30, 6.5, 8), storeMat); store.position.set(0, 3.25, -21); scene.add(store);
  const parapet = new T.Mesh(new T.BoxGeometry(30.4, 0.5, 8.4), new T.MeshStandardMaterial({ color: 0x3a3358, roughness: 0.7 }));
  parapet.position.set(0, 6.6, -21); scene.add(parapet);
  const facadeTex = canvasTex(1024, 222, (g, w, h) => {
    g.fillStyle = '#1b1530'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#100b20'; g.fillRect(0, 0, w, 78);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 60px Trebuchet MS, sans-serif';
    g.shadowColor = '#ff3fd0'; g.shadowBlur = 26; g.fillStyle = '#ffd6f6';
    g.fillText('GALAXY MART', w / 2, 42); g.fillText('GALAXY MART', w / 2, 42);
    g.font = '800 28px Trebuchet MS, sans-serif';
    g.shadowColor = '#3ff8ff'; g.fillStyle = '#d8feff';
    g.fillText('OPEN 24/7', 880, 42); g.fillText('PROBES · SNACKS', 150, 42);
    g.shadowBlur = 0;
    for (let i = 0; i < 7; i++) {
      const x0 = 18 + i * 142, y0 = 96, ww = 126, hh = 116;
      if (i === 3) { g.fillStyle = '#e8fbff'; g.fillRect(x0 + 18, y0, ww - 36, hh); g.fillStyle = '#7fd8f0'; g.fillRect(x0 + 60, y0 + 4, 4, hh - 4); continue; }
      const gr = g.createLinearGradient(0, y0, 0, y0 + hh);
      gr.addColorStop(0, '#c8f6ff'); gr.addColorStop(1, '#58a8d0');
      g.fillStyle = gr; g.fillRect(x0, y0, ww, hh);
      g.fillStyle = 'rgba(40,40,80,0.55)';
      for (let k = 0; k < 3; k++) g.fillRect(x0 + 8, y0 + 30 + k * 30, ww - 16, 8);
      g.fillStyle = 'rgba(255,120,200,0.5)';
      for (let k = 0; k < 6; k++) g.fillRect(x0 + 10 + Math.random() * (ww - 26), y0 + 18 + Math.floor(Math.random() * 3) * 30, 8, 12);
    }
  });
  const facade = new T.Mesh(new T.PlaneGeometry(30, 6.5), new T.MeshBasicMaterial({ map: facadeTex }));
  facade.position.set(0, 3.25, -16.98); scene.add(facade);
  const glowPool = new T.Mesh(new T.PlaneGeometry(30, 6), new T.MeshBasicMaterial({ map: radialTex, color: 0x4fb8ff, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }));
  glowPool.rotation.x = -Math.PI / 2; glowPool.position.set(0, 0.005, -15.5); scene.add(glowPool);

  // funny sign
  const signTex = canvasTex(320, 200, (g, w, h) => {
    g.fillStyle = '#1446c8'; roundRectPath(g, 4, 4, w - 8, h - 8, 18); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 6; roundRectPath(g, 14, 14, w - 28, h - 28, 12); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 40px Trebuchet MS, sans-serif'; g.fillText('UFO PARKING', w / 2, 62);
    g.font = '700 22px Trebuchet MS, sans-serif'; g.fillText('ALL OTHERS', w / 2, 112); g.fillText('WILL BE PROBED', w / 2, 142);
  });
  const signGroup = new T.Group();
  const post = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 2.6, 6), new T.MeshStandardMaterial({ color: 0x777788, metalness: 0.7, roughness: 0.4 }));
  post.position.y = 1.3; signGroup.add(post);
  const board = new T.Mesh(new T.PlaneGeometry(2.6, 1.62), new T.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, side: T.DoubleSide }));
  board.position.y = 2.9; signGroup.add(board);
  signGroup.position.set(-21.2, 0, 0.5); signGroup.rotation.y = 0.5; scene.add(signGroup);

  // lamps
  const poleMat = new T.MeshStandardMaterial({ color: 0x3a3a48, metalness: 0.7, roughness: 0.4 });
  const headMat = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 2.2 });
  const baseMat = new T.MeshStandardMaterial({ color: 0x9a98a8, roughness: 0.8 });
  const poolMat = new T.MeshBasicMaterial({ map: radialTex, color: 0xff9a45, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false });
  LAMPS.forEach(([x, z], i) => {
    const s = x > 0 ? -1 : 1;
    const base = new T.Mesh(new T.CylinderGeometry(0.3, 0.36, 0.4, 10), baseMat); base.position.set(x, 0.2, z); scene.add(base);
    const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.13, 5.6, 8), poleMat); pole.position.set(x, 2.9, z); scene.add(pole);
    const arm = new T.Mesh(new T.BoxGeometry(1.5, 0.1, 0.1), poleMat); arm.position.set(x + s * 0.7, 5.6, z); scene.add(arm);
    const head = new T.Mesh(new T.BoxGeometry(0.8, 0.16, 0.45), headMat); head.position.set(x + s * 1.3, 5.5, z); scene.add(head);
    const pool = new T.Mesh(new T.PlaneGeometry(11, 11), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x + s * 1.3, 0.008, z); scene.add(pool);
    if (i === 0 || i === 1 || i === 4 || i === 5) {
      const pl = new T.PointLight(0xffb36b, 34, 17, 2); pl.position.set(x + s * 1.3, 5.1, z); scene.add(pl);
    }
  });
}
buildWorld();

for (let i = 0; i < N_CARS; i++) cars.push(buildCar(pick(carBodyMats)));

function layoutCars() {
  for (const s of stalls) s.car = null;
  const idx = stalls.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  cars.forEach((c, i) => {
    const s = stalls[idx[i]];
    s.car = c;
    c.x = s.x + rand(-0.12, 0.12); c.z = s.z + rand(-0.15, 0.15);
    c.root.position.set(c.x, 0, c.z);
    c.model.rotation.y = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.03, 0.03);
    const m = pick(carBodyMats); c.body.material = m; c.roof.material = m;
    c.alarm = 0; c.jx = c.jz = c.jvx = c.jvz = 0;
  });
}
layoutCars();

// ------------------------------------------------------------------ patrol car
const patrol = (() => {
  const whiteMat = new T.MeshStandardMaterial({ color: 0xf2f2f5, metalness: 0.5, roughness: 0.3 });
  const c = buildCar(whiteMat);
  const stripe = new T.Mesh(new T.BoxGeometry(1.82, 0.14, 3.92), new T.MeshStandardMaterial({ color: 0x1030a0, metalness: 0.4, roughness: 0.4 }));
  stripe.position.y = 0.62; c.model.add(stripe);
  c.redMat = new T.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1030, emissiveIntensity: 3 });
  c.blueMat = new T.MeshStandardMaterial({ color: 0x000022, emissive: 0x2060ff, emissiveIntensity: 3 });
  const lb = new T.BoxGeometry(0.42, 0.14, 0.26);
  const r = new T.Mesh(lb, c.redMat); r.position.set(-0.24, 1.5, -0.2); c.model.add(r);
  const b = new T.Mesh(lb, c.blueMat); b.position.set(0.24, 1.5, -0.2); c.model.add(b);
  c.flashMat = new T.MeshBasicMaterial({ map: radialTex, color: 0xff1030, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
  const fl = new T.Mesh(new T.PlaneGeometry(7, 7), c.flashMat); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.02; c.root.add(fl);
  const beamMat = new T.MeshBasicMaterial({ map: vGradTex, color: 0xfff0c0, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false });
  const hb = new T.Mesh(new T.PlaneGeometry(2.4, 5), beamMat); hb.rotation.x = -Math.PI / 2; hb.position.set(0, 0.03, 4.4);
  c.model.add(hb);
  c.headMat.emissiveIntensity = 2.5;
  c.dir = 1; c.x = -40; c.z = LANES[0]; c.speed = 4.3; c.active = false; c.honkT = 0;
  c.hx = CAR_HZ; c.hz = CAR_HX;
  c.root.visible = false;
  return c;
})();

// ------------------------------------------------------------------ UFO
const ufo = {
  x: 0, z: LANES[1], y: HOVER_Y, vx: 0, vz: 0, ang: -Math.PI / 2, mode: 'fly', landT: 0,
  fromX: 0, fromZ: 0, fromY: 0, touched: false, spawned: false,
  tiltX: 0, tiltZ: 0, wx: 0, wz: 0, wvx: 0, wvz: 0, thrustAmt: 0, squash: 0, squashV: 0, jump: 0, inZone: false,
};
const ufoParts = (() => {
  const root = new T.Group(), tilt = new T.Group(), spinner = new T.Group();
  root.add(tilt); tilt.add(spinner);
  const metal = new T.MeshStandardMaterial({ color: 0xcad3e6, metalness: 0.88, roughness: 0.22, side: T.DoubleSide });
  const pts = [[0, -0.3], [0.35, -0.28], [0.7, -0.2], [1.0, -0.07], [1.15, 0.02], [1.12, 0.07], [0.95, 0.13], [0.6, 0.2], [0.3, 0.23], [0, 0.24]]
    .map((p) => new T.Vector2(p[0], p[1]));
  spinner.add(new T.Mesh(new T.LatheGeometry(pts, 56), metal));
  const band = new T.Mesh(new T.TorusGeometry(1.1, 0.055, 8, 56), new T.MeshStandardMaterial({ color: 0x2b2f45, metalness: 0.6, roughness: 0.35 }));
  band.rotation.x = Math.PI / 2; band.position.y = 0.03; spinner.add(band);
  const ring2 = new T.Mesh(new T.TorusGeometry(0.62, 0.025, 6, 40), new T.MeshStandardMaterial({ color: 0x1a1d2e, metalness: 0.5, roughness: 0.4 }));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.2; spinner.add(ring2);
  const rimColors = [0xff4fd8, 0x3ff8ff, 0xffe45e];
  const lights = [];
  const lg = new T.SphereGeometry(0.075, 10, 8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const m = new T.MeshStandardMaterial({ color: 0x000000, emissive: rimColors[i % 3], emissiveIntensity: 2 });
    const s = new T.Mesh(lg, m); s.position.set(Math.cos(a) * 1.13, 0.045, Math.sin(a) * 1.13); spinner.add(s);
    lights.push(m);
  }
  const domeMat = new T.MeshStandardMaterial({ color: 0x9fe8ff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.32, emissive: 0x0a3a50, emissiveIntensity: 0.7, depthWrite: false });
  const dome = new T.Mesh(new T.SphereGeometry(0.52, 32, 16, 0, TAU, 0, Math.PI / 2), domeMat);
  dome.position.y = 0.18; dome.renderOrder = 3; tilt.add(dome);
  // alien pilot
  const alien = new T.Group(); alien.position.y = 0.2; tilt.add(alien);
  const skin = new T.MeshStandardMaterial({ color: 0x7cff6b, roughness: 0.5, emissive: 0x1a5a10, emissiveIntensity: 0.6 });
  const head = new T.Mesh(new T.SphereGeometry(0.2, 20, 14), skin); head.scale.set(1, 1.1, 1); head.position.y = 0.2; alien.add(head);
  const torso = new T.Mesh(new T.SphereGeometry(0.14, 16, 10), skin); torso.scale.set(1, 0.8, 1); torso.position.y = 0.02; alien.add(torso);
  const eyeMat = new T.MeshStandardMaterial({ color: 0x050508, roughness: 0.1, metalness: 0.3 });
  const shineMat = new T.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), eyeMat);
    e.scale.set(0.55, 1.15, 0.9); e.position.set(0.155, 0.22, s * 0.085); e.rotation.x = s * 0.45; alien.add(e);
    const sh = new T.Mesh(new T.SphereGeometry(0.018, 6, 5), shineMat); sh.position.set(0.19, 0.255, s * 0.075); alien.add(sh);
  }
  const ant = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.12, 5), skin); ant.position.y = 0.43; alien.add(ant);
  const bobMat = new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xff4fd8, emissiveIntensity: 2.5 });
  const bob = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), bobMat); bob.position.y = 0.49; alien.add(bob);
  scene.add(root);

  // ground helpers (not tilted)
  const shadow = new T.Mesh(new T.PlaneGeometry(2.8, 2.8), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const poolMat = new T.MeshBasicMaterial({ map: radialTex, color: 0x3ff8e0, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false });
  const pool = new T.Mesh(new T.PlaneGeometry(5, 5), poolMat); pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const light = new T.PointLight(0x55ffee, 2.2, 7, 2); scene.add(light);
  const beamMat = new T.MeshBasicMaterial({ map: coneTex, color: 0x6bffd0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const beam = new T.Mesh(new T.ConeGeometry(1.05, 1, 32, 1, true), beamMat); scene.add(beam);
  return { root, tilt, spinner, lights, alien, shadow, pool, poolMat, light, beam, beamMat, domeMat };
})();

// ------------------------------------------------------------------ direction arrow + stop predictor
const arrow = (() => {
  const group = new T.Group(), pivot = new T.Group();
  group.add(pivot); scene.add(group);
  const trackMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false });
  const track = new T.Mesh(new T.RingGeometry(1.5, 1.55, 72), trackMat); track.rotation.x = -Math.PI / 2; track.renderOrder = 20; group.add(track);
  const sh = new T.Shape();
  sh.moveTo(0.42, 0); sh.lineTo(-0.22, 0.36); sh.lineTo(-0.06, 0); sh.lineTo(-0.22, -0.36); sh.closePath();
  const chevMat = new T.MeshBasicMaterial({ color: 0xfff36b, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const chev = new T.Mesh(new T.ShapeGeometry(sh), chevMat); chev.rotation.x = -Math.PI / 2; chev.renderOrder = 22;
  const chevHolder = new T.Group(); chevHolder.add(chev); chevHolder.position.x = 1.78; pivot.add(chevHolder);
  const glowMat = new T.MeshBasicMaterial({ map: radialTex, color: 0xffd23a, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthTest: false, depthWrite: false });
  const glow = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), glowMat); glow.rotation.x = -Math.PI / 2; glow.renderOrder = 21; chevHolder.add(glow);
  // exhaust flame behind the saucer
  const flameGeo = new T.PlaneGeometry(2.2, 1.3); flameGeo.rotateZ(Math.PI / 2); flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new T.MeshBasicMaterial({ map: vGradTex, color: 0x5ff8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const flame = new T.Mesh(flameGeo, flameMat); flame.position.x = -2.05; flame.renderOrder = 5; pivot.add(flame);
  // stop predictor
  const stopMat = new T.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const stopRing = new T.Mesh(new T.RingGeometry(0.95, 1.08, 48), stopMat); stopRing.rotation.x = -Math.PI / 2; stopRing.renderOrder = 15; scene.add(stopRing);
  const stopDot = new T.Mesh(new T.CircleGeometry(0.14, 16), stopMat); stopDot.rotation.x = -Math.PI / 2; stopDot.renderOrder = 15; scene.add(stopDot);
  const lineGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]);
  const lineMat = new T.LineDashedMaterial({ color: 0x7df9ff, dashSize: 0.35, gapSize: 0.28, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const line = new T.Line(lineGeo, lineMat); line.renderOrder = 15; line.frustumCulled = false; scene.add(line);
  return { group, pivot, trackMat, chev, chevHolder, chevMat, glowMat, flameMat, stopRing, stopDot, stopMat, line, lineGeo, lineMat, vis: 0, pop: 0, press: 0, stopVis: 0 };
})();

// ------------------------------------------------------------------ target spot
const target = (() => {
  const group = new T.Group(); scene.add(group);
  const spotTex = canvasTex(256, 440, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.1)'; roundRectPath(g, 14, 14, w - 28, h - 28, 26); g.fill();
    g.shadowColor = '#fff'; g.shadowBlur = 18;
    g.strokeStyle = '#fff'; g.lineWidth = 11; roundRectPath(g, 14, 14, w - 28, h - 28, 26); g.stroke();
    g.lineWidth = 4; g.globalAlpha = 0.5; roundRectPath(g, 36, 36, w - 72, h - 72, 16); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(w / 2, h / 2 - 20, 74, 22, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(w / 2, h / 2 - 30, 34, Math.PI, 0); g.fill();
    g.font = '900 46px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PARK', w / 2, h / 2 + 70);
  });
  const decalMat = new T.MeshBasicMaterial({ map: spotTex, color: 0x3dff9a, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const decalGeo = new T.PlaneGeometry(2.75, 4.7); decalGeo.rotateX(-Math.PI / 2);
  const decal = new T.Mesh(decalGeo, decalMat); decal.position.y = 0.02; group.add(decal);
  const beamMat = new T.MeshBasicMaterial({ map: vGradTex, color: 0x3dff9a, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const beam = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, 7, 32, 1, true), beamMat); beam.position.y = 3.5; group.add(beam);
  const holoMat = new T.MeshBasicMaterial({ color: 0x6bffb8, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false });
  const holo = new T.Mesh(new T.TorusGeometry(1.3, 0.035, 6, 56), holoMat); holo.rotation.x = Math.PI / 2; group.add(holo);
  const holo2 = new T.Mesh(new T.TorusGeometry(1.0, 0.025, 6, 48), holoMat); holo2.rotation.x = Math.PI / 2; group.add(holo2);
  const pTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#1e6bff'; roundRectPath(g, 8, 8, 112, 112, 24); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 7; roundRectPath(g, 16, 16, 96, 96, 18); g.stroke();
    g.fillStyle = '#fff'; g.font = '900 78px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('P', 64, 70);
  });
  const sign = new T.Sprite(new T.SpriteMaterial({ map: pTex, transparent: true, depthWrite: false }));
  sign.scale.set(1.1, 1.1, 1); group.add(sign);
  const cBgMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide });
  const cBgGeo = new T.RingGeometry(1.5, 1.72, 64); cBgGeo.rotateX(-Math.PI / 2);
  const cBg = new T.Mesh(cBgGeo, cBgMat); cBg.position.y = 0.035; group.add(cBg);
  const cGeo = new T.RingGeometry(1.5, 1.72, 64, 1, Math.PI / 2, -TAU); cGeo.rotateX(-Math.PI / 2);
  const cMat = new T.MeshBasicMaterial({ color: 0xb8ffd8, transparent: true, opacity: 0.95, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const cRing = new T.Mesh(cGeo, cMat); cRing.position.y = 0.04; group.add(cRing);
  cGeo.setDrawRange(0, 0);
  return { group, decal, decalMat, beam, beamMat, holo, holo2, holoMat, sign, cGeo, cBgMat,
    stall: null, x: 0, z: 0, charge: 0, born: 0, spawnT: 1 };
})();

// ------------------------------------------------------------------ shockwave rings
const shocks = [];
for (let i = 0; i < 4; i++) {
  const m = new T.MeshBasicMaterial({ color: 0x9dffd0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const g = new T.RingGeometry(0.85, 1, 56); g.rotateX(-Math.PI / 2);
  const mesh = new T.Mesh(g, m); mesh.visible = false; scene.add(mesh);
  shocks.push({ mesh, mat: m, t: 1, dur: 0.6, size: 5 });
}
let shockIdx = 0;
function shock(x, z, color, size = 5, dur = 0.6) {
  const s = shocks[shockIdx]; shockIdx = (shockIdx + 1) % shocks.length;
  s.t = 0; s.dur = dur; s.size = size; s.mesh.position.set(x, 0.05, z); s.mat.color.set(color); s.mesh.visible = true;
}
function updateShocks(dt) {
  for (const s of shocks) {
    if (!s.mesh.visible) continue;
    s.t += dt / s.dur;
    if (s.t >= 1) { s.mesh.visible = false; continue; }
    const e = 1 - Math.pow(1 - s.t, 3);
    s.mesh.scale.setScalar(0.6 + e * s.size);
    s.mat.opacity = (1 - s.t) * 0.9;
  }
}

// ------------------------------------------------------------------ particles
const P_MAX = 700;
const pPos = new Float32Array(P_MAX * 3), pCol = new Float32Array(P_MAX * 3);
const pGeo = new T.BufferGeometry();
pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3).setUsage(T.DynamicDrawUsage));
pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3).setUsage(T.DynamicDrawUsage));
const pMat = new T.PointsMaterial({ size: 0.38, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
const pts = new T.Points(pGeo, pMat); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
const parts = [];
for (let i = 0; i < P_MAX; i++) parts.push({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, grav: 0, drag: 0 });
let pIdx = 0;
function emit(x, y, z, vx, vy, vz, life, col, grav = 0, drag = 0) {
  const p = parts[pIdx]; pIdx = (pIdx + 1) % P_MAX;
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life;
  p.r = col.r; p.g = col.g; p.b = col.b; p.grav = grav; p.drag = drag;
}
function updateParticles(dt) {
  for (let i = 0; i < P_MAX; i++) {
    const p = parts[i], j = i * 3;
    if (p.life > 0) {
      p.life -= dt;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      const a = Math.max(0, p.life / p.max);
      const a2 = a * (2 - a);
      pPos[j] = p.x; pPos[j + 1] = p.y; pPos[j + 2] = p.z;
      pCol[j] = p.r * a2; pCol[j + 1] = p.g * a2; pCol[j + 2] = p.b * a2;
    } else {
      pPos[j + 1] = -99; pCol[j] = pCol[j + 1] = pCol[j + 2] = 0;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}
const C = (hex) => new T.Color(hex);
const COL_EXHAUST = [C(0x5ff8ff), C(0xff6ae0), C(0xa0fff0)];
const COL_SPARK = [C(0xffb347), C(0xffe28a), C(0xff6a3d)];
const COL_CONFETTI = [C(0xff4fd8), C(0x3ff8ff), C(0xffe45e), C(0x3dff9a), C(0x9d6bff), C(0xff7a3d)];
const COL_DUST = C(0x6a5a9a);
const COL_SPARKLE = C(0x3a8f88);

// ------------------------------------------------------------------ audio
const Sound = {
  ctx: null, out: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.out.connect(comp); comp.connect(c.destination);
    const len = Math.floor(c.sampleRate * 1.5), nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nb = nb;
    this.humF = c.createBiquadFilter(); this.humF.type = 'lowpass'; this.humF.frequency.value = 380; this.humF.Q.value = 5;
    this.humG = c.createGain(); this.humG.gain.value = 0;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 62;
    this.o2 = c.createOscillator(); this.o2.type = 'triangle'; this.o2.frequency.value = 124.5;
    const o2g = c.createGain(); o2g.gain.value = 0.5;
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 5.5;
    const lg = c.createGain(); lg.gain.value = 3;
    this.lfo.connect(lg); lg.connect(this.o1.frequency); lg.connect(this.o2.frequency);
    this.o1.connect(this.humF); this.o2.connect(o2g); o2g.connect(this.humF); this.humF.connect(this.humG); this.humG.connect(this.out);
    this.tn = c.createBufferSource(); this.tn.buffer = nb; this.tn.loop = true;
    this.tF = c.createBiquadFilter(); this.tF.type = 'bandpass'; this.tF.frequency.value = 700; this.tF.Q.value = 0.8;
    this.tG = c.createGain(); this.tG.gain.value = 0;
    this.tn.connect(this.tF); this.tF.connect(this.tG); this.tG.connect(this.out);
    this.co = c.createOscillator(); this.co.type = 'sine'; this.co.frequency.value = 300;
    this.cG = c.createGain(); this.cG.gain.value = 0;
    this.co.connect(this.cG); this.cG.connect(this.out);
    [this.o1, this.o2, this.lfo, this.tn, this.co].forEach((n) => n.start());
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  update(thrust, charge, level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.humG.gain.setTargetAtTime((0.045 + thrust * 0.05) * level, t, 0.08);
    this.humF.frequency.setTargetAtTime(380 + thrust * 900, t, 0.08);
    this.o1.frequency.setTargetAtTime(62 + thrust * 30, t, 0.1);
    this.o2.frequency.setTargetAtTime(124.5 + thrust * 60, t, 0.1);
    this.tG.gain.setTargetAtTime(thrust * 0.13 * level, t, 0.05);
    this.tF.frequency.setTargetAtTime(600 + thrust * 1000, t, 0.1);
    this.cG.gain.setTargetAtTime(charge > 0.01 ? 0.05 : 0, t, 0.03);
    this.co.frequency.setTargetAtTime(320 + charge * 700, t, 0.03);
  },
  env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  tone(freq, dur, type = 'sine', vol = 0.2, delay = 0, slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    this.env(g, t, vol, dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq, type = 'lowpass', delay = 0, q = 1, freqEnd = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nb;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain(); this.env(g, t, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05);
  },
  bump(k) { k = clamp(k / 5, 0.15, 1); this.noise(0.22, 0.5 * k, 520); this.tone(130, 0.26, 'sine', 0.6 * k, 0, 40); },
  scrape() { this.noise(0.12, 0.08, 2400, 'bandpass', 0, 3); },
  honk() { for (const d of [0, 0.24]) { this.tone(349, 0.18, 'square', 0.05, d); this.tone(440, 0.18, 'square', 0.045, d); } },
  alarm() { for (let i = 0; i < 4; i++) this.tone(i % 2 ? 900 : 700, 0.16, 'square', 0.03, 0.5 + i * 0.18); },
  clang() { this.tone(820, 0.5, 'triangle', 0.12); this.tone(1235, 0.4, 'sine', 0.07); this.tone(2100, 0.2, 'sine', 0.04); },
  wall(k) { k = clamp(k / 6, 0.1, 1); this.tone(95, 0.2, 'sine', 0.4 * k, 0, 45); this.noise(0.12, 0.2 * k, 380); },
  press() { this.noise(0.2, 0.1, 350, 'bandpass', 0, 1.2, 1600); },
  park(combo) {
    const base = 523.25 * Math.pow(2, ((combo - 1) * 2) / 12);
    [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.3, 'triangle', 0.15, i * 0.055));
    this.tone(base * 4, 0.5, 'sine', 0.05, 0.22);
  },
  thump() { this.tone(95, 0.22, 'sine', 0.45, 0, 42); this.noise(0.25, 0.14, 900); },
  spawn() { this.tone(660, 0.12, 'sine', 0.07); this.tone(990, 0.18, 'sine', 0.07, 0.07); },
  whoosh() { this.noise(0.45, 0.1, 300, 'bandpass', 0, 1.5, 2200); },
  tick(hi) { this.tone(hi ? 1500 : 1050, 0.06, 'square', 0.045); },
  start() { this.tone(220, 0.45, 'sawtooth', 0.05, 0, 880); this.tone(440, 0.45, 'triangle', 0.08, 0.05, 1320); },
  end() { [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.38, 'triangle', 0.14, i * 0.13)); this.tone(196, 0.9, 'sine', 0.12, 0.52); },
  siren() { this.tone(560, 0.3, 'sawtooth', 0.035, 0, 980); this.tone(980, 0.3, 'sawtooth', 0.035, 0.32, 560); },
  setMuted(m) { this.muted = m; if (this.ctx) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02); },
};

const Media = {
  music: null, voices: {}, ready: false,
  init() {
    if (this.ready) return;
    this.ready = true;
    try {
      this.music = new Audio('assets/generate_music-1.mp3');
      this.music.loop = true; this.music.volume = 0.3; this.music.preload = 'auto';
      this.voices.nice = new Audio('assets/generate_voice-1.mp3');
      this.voices.paint = new Audio('assets/generate_voice-2.mp3');
      for (const k in this.voices) { this.voices[k].preload = 'auto'; this.voices[k].volume = 0.95; }
    } catch (e) { this.music = null; }
  },
  playMusic() {
    if (!this.music || Sound.muted) return;
    if (!this.music.paused) return;
    const p = this.music.play(); if (p && p.catch) p.catch(() => {});
  },
  musicVolume(v) { if (this.music) this.music.volume = v; },
  voice(name) {
    const v = this.voices[name];
    if (!v || Sound.muted) return;
    try { v.currentTime = 0; } catch (e) { /* ignore */ }
    const p = v.play(); if (p && p.catch) p.catch(() => {});
  },
  setMuted(m) {
    if (this.music) { this.music.muted = m; if (!m && state !== 'menu') this.playMusic(); }
    for (const k in this.voices) this.voices[k].muted = m;
  },
};

// ------------------------------------------------------------------ DOM / HUD
const $ = (id) => document.getElementById(id);
const el = {
  hud: $('hud'), score: $('score'), timer: $('timer'), parks: $('parks'), combo: $('combo'), banner: $('banner'),
  hint: $('hint'), off: $('off'), menu: $('menu'), over: $('over'), fx: $('fx'), mute: $('mute'),
  rank: $('rank'), finalScore: $('finalScore'), newBest: $('newBest'), stats: $('stats'), again: $('againBtn'), menuBest: $('menuBest'),
};
let best = 0;
try { best = parseInt(localStorage.getItem('saucer-parking-best') || '0', 10) || 0; } catch (e) { best = 0; }
function refreshMenuBest() { el.menuBest.textContent = best > 0 ? `BEST ${best}` : ''; }
refreshMenuBest();

function banner(text, cls = '') {
  el.banner.className = '';
  el.banner.textContent = text;
  void el.banner.offsetWidth;
  el.banner.className = 'show ' + cls;
}
const floats = [];
const _v = new T.Vector3();
function floatText(title, sub, x, y, z, cls) {
  const d = document.createElement('div');
  d.className = 'ftext ' + cls;
  const b = document.createElement('b'); b.textContent = title; d.appendChild(b);
  if (sub) { const s = document.createElement('span'); s.textContent = sub; d.appendChild(s); }
  el.fx.appendChild(d);
  floats.push({ d, x, y, z, t: 0, dur: 1.35 });
}
function updateFloats(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    if (f.t >= f.dur) { f.d.remove(); floats.splice(i, 1); continue; }
    const k = f.t / f.dur;
    _v.set(f.x, f.y + f.t * 1.4, f.z).project(camera);
    const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
    const sc = f.t < 0.12 ? 0.4 + (f.t / 0.12) * 0.85 : f.t < 0.22 ? 1.25 - ((f.t - 0.12) / 0.1) * 0.25 : 1;
    f.d.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
    f.d.style.opacity = (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3).toFixed(3);
  }
}
let hudCache = {};
function setText(node, key, val) { if (hudCache[key] !== val) { hudCache[key] = val; node.textContent = val; } }
function popScore() { el.score.classList.add('pop'); setTimeout(() => el.score.classList.remove('pop'), 130); }

// ------------------------------------------------------------------ game state
let state = 'menu';
let score = 0, parks = 0, combo = 0, dents = 0, timeLeft = ROUND_TIME, rotSpeed = ROT_START;
let clock = 0, playStart = 0, overT = 0, hitstop = 0, trauma = 0, bumpCd = 0, voiceCd = 0, lastTick = 99;
let held = false, needRelease = false, zoneAssist = false, emitAcc = 0, sparkleAcc = 0;
let parkX = 0, parkZ = 0, hintTimer = 0, newBestFlag = false, overShown = false;

function pickTarget(first) {
  const empties = stalls.filter((s) => !s.car && s !== target.stall);
  let cands = empties.filter((s) => {
    const d = Math.hypot(s.x - ufo.x, s.z - ufo.z);
    return d > 7 && d < (first ? 17 : 27);
  });
  if (!cands.length) cands = empties;
  const s = pick(cands);
  target.stall = s; target.x = s.x; target.z = s.z; target.charge = 0; target.born = clock; target.spawnT = 0;
  target.group.position.set(s.x, 0, s.z);
  shock(s.x, s.z, 0x3dff9a, 4, 0.7);
}

function startGame() {
  Sound.init(); Media.init();
  Media.musicVolume(0.3); Media.playMusic();
  state = 'play';
  score = 0; parks = 0; combo = 0; dents = 0; timeLeft = ROUND_TIME; rotSpeed = ROT_START; lastTick = 99;
  playStart = clock; overShown = false; newBestFlag = false;
  layoutCars();
  patrol.active = false; patrol.root.visible = false; patrol.x = -40;
  Object.assign(ufo, { x: 0, z: LANES[1], vx: 0, vz: 0, mode: 'fly', ang: -Math.PI / 2 });
  target.stall = null;
  pickTarget(true);
  el.menu.classList.add('hidden');
  el.over.classList.add('hidden');
  el.again.classList.remove('ready');
  el.hud.classList.add('on');
  el.hint.classList.add('on'); hintTimer = 0;
  el.timer.classList.remove('hurry');
  hudCache = {};
  banner('PARK IT!');
  Sound.start();
}

function endGame() {
  state = 'over'; overT = 0; needRelease = true;
  target.charge = 0;
  if (score > best) { best = score; newBestFlag = score > 0; try { localStorage.setItem('saucer-parking-best', String(best)); } catch (e) { /* ignore */ } }
  Sound.end();
  Media.musicVolume(0.14);
  banner("TIME'S UP!", 'warn');
  el.hint.classList.remove('on');
  const ranks = ['SPACE MENACE', 'LEARNER SAUCER', 'LEARNER SAUCER', 'SUNDAY DRIVER', 'SUNDAY DRIVER', 'VALET OF THE VOID', 'VALET OF THE VOID', 'PARKING ACE', 'PARKING ACE'];
  el.rank.textContent = parks >= ranks.length ? 'OVERLORD OF PARKING' : ranks[parks];
  el.finalScore.textContent = String(score);
  el.newBest.textContent = newBestFlag ? '★ NEW BEST ★' : `BEST ${best}`;
  el.stats.innerHTML = '';
  const lines = [`Parked <b>${parks}</b> time${parks === 1 ? '' : 's'}`, dents === 0 ? 'Zero dents. Spotless.' : `${dents} dent${dents === 1 ? '' : 's'} on other people's cars`];
  el.stats.innerHTML = lines.join('<br>');
  refreshMenuBest();
}

function doPark() {
  const ox = ufo.x - target.x, oz = ufo.z - target.z;
  const e = Math.min(1, Math.hypot(ox / ZONE_X, oz / ZONE_Z));
  const prec = Math.round(60 * (1 - e));
  const took = clock - target.born;
  const quick = Math.max(0, Math.round(60 - took * 6));
  combo = Math.min(5, combo + 1);
  const gained = (100 + prec + quick) * combo;
  score += gained; parks++;
  popScore();
  const label = e < 0.25 ? 'PERFECT!' : e < 0.55 ? 'GREAT!' : 'PARKED';
  floatText(label, `+${gained}${combo > 1 ? '  ×' + combo : ''}`, target.x, 2.6, target.z, e < 0.25 ? 'perfect' : 'good');
  parkX = target.x; parkZ = target.z;
  Object.assign(ufo, { mode: 'landing', landT: 0, fromX: ufo.x, fromZ: ufo.z, fromY: ufo.y, touched: false, spawned: false, vx: 0, vz: 0, jump: 1 });
  target.charge = 0;
  rotSpeed = Math.min(ROT_MAX, rotSpeed + ROT_STEP);
  hitstop = 0.07;
  trauma = Math.min(1, trauma + 0.18);
  Sound.park(combo);
  for (let i = 0; i < 80; i++) {
    const a = rand(0, TAU), sp = rand(1.5, 5);
    emit(ufo.x, ufo.y + 0.3, ufo.z, Math.cos(a) * sp, rand(4, 9), Math.sin(a) * sp, rand(0.9, 1.7), pick(COL_CONFETTI), 9, 1.2);
  }
  if (voiceCd <= 0 && (parks === 1 || label === 'PERFECT!' || parks % 4 === 0)) { Media.voice('nice'); voiceCd = 5; }
  if (parks === 2 && !patrol.active) {
    patrol.active = true; patrol.root.visible = true; patrol.dir = 1; patrol.x = -30; patrol.z = LANES[0];
    setTimeout(() => { if (state === 'play') { banner('SECURITY PATROL!', 'warn'); Sound.siren(); } }, 650);
  }
}

function touchdown() {
  shock(parkX, parkZ, 0x9dffd0, 5.5, 0.6);
  Sound.thump();
  ufo.squashV -= 3.2;
  trauma = Math.min(1, trauma + 0.12);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU, sp = rand(3, 6);
    emit(parkX + Math.cos(a) * 1.1, 0.15, parkZ + Math.sin(a) * 1.1, Math.cos(a) * sp, rand(0.2, 1), Math.sin(a) * sp, rand(0.4, 0.7), COL_DUST, 0, 3.5);
  }
}

// ------------------------------------------------------------------ collisions
const _hit = { nx: 0, nz: 0, impact: 0 };
function circleBox(cx, cz, hx, hz, bvx, bvz) {
  const dx = ufo.x - cx, dz = ufo.z - cz;
  const px = clamp(dx, -hx, hx), pz = clamp(dz, -hz, hz);
  let nx = dx - px, nz = dz - pz;
  const d2 = nx * nx + nz * nz;
  if (d2 >= UFO_R * UFO_R) return null;
  let d = Math.sqrt(d2), push;
  if (d < 1e-5) {
    const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
    if (ox < oz) { nx = Math.sign(dx) || 1; nz = 0; push = UFO_R + ox; } else { nx = 0; nz = Math.sign(dz) || 1; push = UFO_R + oz; }
  } else { nx /= d; nz /= d; push = UFO_R - d; }
  ufo.x += nx * push; ufo.z += nz * push;
  const rvx = ufo.vx - bvx, rvz = ufo.vz - bvz;
  const vn = rvx * nx + rvz * nz;
  let impact = 0;
  if (vn < 0) { ufo.vx -= (1 + REST) * vn * nx; ufo.vz -= (1 + REST) * vn * nz; impact = -vn; }
  _hit.nx = nx; _hit.nz = nz; _hit.impact = impact;
  return _hit;
}

function onCarHit(car, h) {
  const imp = h.impact;
  if (imp < 0.25) return;
  const cx = ufo.x - h.nx * UFO_R, cz = ufo.z - h.nz * UFO_R;
  const n = Math.min(26, 4 + Math.floor(imp * 3));
  for (let i = 0; i < n; i++) {
    emit(cx, rand(0.6, 1.1), cz, h.nx * rand(1, 4) + rand(-2.5, 2.5), rand(1.5, 5), h.nz * rand(1, 4) + rand(-2.5, 2.5), rand(0.3, 0.7), pick(COL_SPARK), 12, 0.5);
  }
  car.jvx -= h.nx * imp * 0.07; car.jvz -= h.nz * imp * 0.07;
  ufo.wvx += h.nx * imp * 0.09; ufo.wvz += h.nz * imp * 0.09;
  if (imp > 1.3 && state === 'play' && bumpCd <= 0) {
    bumpCd = 0.7; dents++;
    const lost = Math.min(score, 25);
    score -= lost;
    floatText('DENT!', combo > 1 ? `-${lost}  combo lost` : `-${lost}`, cx, 2.0, cz, 'bad');
    combo = 0;
    trauma = Math.min(1, trauma + 0.15 + imp * 0.06);
    hitstop = 0.05;
    car.alarm = 2.2;
    Sound.bump(imp); Sound.honk();
    if (car !== patrol) Sound.alarm(); else Sound.siren();
    if (voiceCd <= 0 && imp > 2.2 && Math.random() < 0.7) { Media.voice('paint'); voiceCd = 6; }
    car.lastSnd = clock;
  } else if (clock - car.lastSnd > 0.18) {
    car.lastSnd = clock;
    if (imp > 0.8) { Sound.bump(imp * 0.6); trauma = Math.min(1, trauma + 0.06); } else Sound.scrape();
  }
}

function collide() {
  for (const c of cars) {
    if (Math.abs(ufo.x - c.x) > 3.2 || Math.abs(ufo.z - c.z) > 3.2) continue;
    const h = circleBox(c.x, c.z, c.hx, c.hz, 0, 0);
    if (h) onCarHit(c, h);
  }
  if (patrol.active) {
    const h = circleBox(patrol.x, patrol.z, patrol.hx, patrol.hz, patrol.dir * patrol.speed, 0);
    if (h) onCarHit(patrol, h);
  }
  for (const [lx, lz] of LAMPS) {
    const dx = ufo.x - lx, dz = ufo.z - lz, rr = UFO_R + LAMP_R;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d;
      ufo.x = lx + nx * rr; ufo.z = lz + nz * rr;
      const vn = ufo.vx * nx + ufo.vz * nz;
      if (vn < 0) {
        ufo.vx -= (1 + REST) * vn * nx; ufo.vz -= (1 + REST) * vn * nz;
        if (-vn > 0.8) { Sound.clang(); trauma = Math.min(1, trauma + 0.1); ufo.wvx += nx * -vn * 0.08; ufo.wvz += nz * -vn * 0.08; }
      }
    }
  }
  const lim = [[LOT.minX + UFO_R, 1, 'x'], [LOT.maxX - UFO_R, -1, 'x'], [LOT.minZ + UFO_R, 1, 'z'], [LOT.maxZ - UFO_R, -1, 'z']];
  for (const [b, s, ax] of lim) {
    const p = ax === 'x' ? ufo.x : ufo.z;
    if ((p - b) * s < 0) {
      const vkey = ax === 'x' ? 'vx' : 'vz';
      if (ax === 'x') ufo.x = b; else ufo.z = b;
      const v = ufo[vkey] * s;
      if (v < 0) {
        ufo[vkey] = -ufo[vkey] * REST;
        if (-v > 1) {
          Sound.wall(-v); trauma = Math.min(1, trauma + 0.08);
          if (ax === 'x') ufo.wvx += s * -v * 0.06; else ufo.wvz += s * -v * 0.06;
          for (let i = 0; i < 8; i++) emit(ax === 'x' ? b - s * UFO_R : ufo.x + rand(-0.6, 0.6), 0.5, ax === 'z' ? b - s * UFO_R : ufo.z + rand(-0.6, 0.6), rand(-2, 2), rand(1, 3), rand(-2, 2), 0.4, COL_EXHAUST[0], 8, 1);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ updates
function updateUFO(dt, thrusting) {
  const u = ufo, P = ufoParts;
  const ca = Math.cos(u.ang), sa = Math.sin(u.ang);
  if (u.mode === 'fly') {
    if (thrusting) {
      u.vx += ca * THRUST * dt; u.vz += sa * THRUST * dt;
      u.thrustAmt = Math.min(1, u.thrustAmt + dt * 9);
      emitAcc += dt * 95;
      while (emitAcc > 1) {
        emitAcc -= 1;
        const side = rand(-0.5, 0.5), sp = rand(4, 7.5);
        emit(u.x - ca * 1.05 - sa * side, u.y + rand(-0.12, 0.12), u.z - sa * 1.05 + ca * side,
          -ca * sp + u.vx * 0.3 + rand(-0.8, 0.8), rand(-0.4, 0.6), -sa * sp + u.vz * 0.3 + rand(-0.8, 0.8), rand(0.25, 0.5), pick(COL_EXHAUST), 0, 2);
      }
    } else {
      u.ang += rotSpeed * dt;
      u.thrustAmt = Math.max(0, u.thrustAmt - dt * 5);
    }
    const drag = DRAG + (zoneAssist ? ZONE_DRAG : 0);
    const f = Math.exp(-drag * dt);
    u.vx *= f; u.vz *= f;
    const sp = Math.hypot(u.vx, u.vz);
    if (sp > MAX_SPEED) { u.vx *= MAX_SPEED / sp; u.vz *= MAX_SPEED / sp; }
    const steps = 3;
    for (let i = 0; i < steps; i++) { u.x += (u.vx * dt) / steps; u.z += (u.vz * dt) / steps; collide(); }
    u.y = damp(u.y, HOVER_Y + Math.sin(clock * 2.6) * 0.06, 5, dt);
  } else if (u.mode === 'landing') {
    u.landT += dt;
    const t = u.landT;
    const k = clamp(t / 0.32, 0, 1), e = 1 - Math.pow(1 - k, 3);
    u.x = lerp(u.fromX, parkX, e); u.z = lerp(u.fromZ, parkZ, e);
    if (t < 0.32) u.y = lerp(u.fromY, 0.5, e);
    else if (t < 0.6) { if (!u.touched) { u.touched = true; touchdown(); } u.y = 0.5; }
    else {
      if (!u.touched) { u.touched = true; touchdown(); }
      const k2 = clamp((t - 0.6) / 0.4, 0, 1);
      u.y = lerp(0.5, HOVER_Y, smooth(k2));
    }
    if (t >= 0.5 && !u.spawned) { u.spawned = true; if (state === 'play') { pickTarget(false); Sound.spawn(); } Sound.whoosh(); }
    if (t >= 0.85) u.mode = 'fly';
    u.ang += rotSpeed * dt;
    u.thrustAmt = Math.max(0, u.thrustAmt - dt * 5);
  }

  // idle sparkle under the saucer
  sparkleAcc += dt * 14;
  while (sparkleAcc > 1) {
    sparkleAcc -= 1;
    const a = rand(0, TAU), r = rand(0, 0.55);
    emit(u.x + Math.cos(a) * r, u.y - 0.3, u.z + Math.sin(a) * r, 0, -rand(1, 2), 0, rand(0.3, 0.5), COL_SPARKLE, 0, 0);
  }

  // tilt + wobble springs
  const tx = thrusting ? ca * 0.24 : u.vx * 0.02, tz = thrusting ? sa * 0.24 : u.vz * 0.02;
  u.tiltX = damp(u.tiltX, tx, 8, dt); u.tiltZ = damp(u.tiltZ, tz, 8, dt);
  u.wvx += (-70 * u.wx - 6 * u.wvx) * dt; u.wvz += (-70 * u.wz - 6 * u.wvz) * dt;
  u.wx += u.wvx * dt; u.wz += u.wvz * dt;
  u.squashV += (-120 * u.squash - 9 * u.squashV) * dt; u.squash += u.squashV * dt;
  const txx = u.tiltX + u.wx, tzz = u.tiltZ + u.wz;
  P.root.position.set(u.x, u.y, u.z);
  P.tilt.rotation.set(tzz, 0, -txx);
  const sq = clamp(u.squash, -0.4, 0.4);
  P.root.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
  P.spinner.rotation.y += dt * (1.3 + u.thrustAmt * 7);
  for (let i = 0; i < P.lights.length; i++) {
    const v = Math.max(0, Math.sin(clock * (7 + u.thrustAmt * 8) - i * 0.95));
    P.lights[i].emissiveIntensity = 0.5 + v * v * (2.2 + u.thrustAmt * 2);
  }
  u.jump = Math.max(0, u.jump - dt * 1.6);
  P.alien.rotation.y = -u.ang;
  P.alien.position.y = 0.2 + Math.abs(Math.sin(clock * 6)) * 0.012 + Math.sin((1 - u.jump) * Math.PI * 3) * u.jump * 0.06;

  const hgt = clamp((u.y - 0.5) / (HOVER_Y - 0.5), 0, 1.3);
  P.shadow.position.set(u.x + 0.15, 0.012, u.z + 0.15);
  P.shadow.scale.setScalar(0.9 + hgt * 0.2);
  P.shadow.material.opacity = 0.75 - hgt * 0.2;
  P.pool.position.set(u.x, 0.016, u.z);
  const ch = target.charge;
  P.poolMat.opacity = 0.28 + u.thrustAmt * 0.18 + ch * 0.3 + (u.mode === 'landing' ? 0.3 : 0);
  P.light.position.set(u.x, u.y - 0.2, u.z);
  P.light.intensity = 2 + u.thrustAmt * 1.5 + ch * 2;
  const beamOn = u.mode === 'landing' ? 0.75 : ch * 0.6;
  P.beamMat.opacity = damp(P.beamMat.opacity, beamOn, 12, dt);
  P.beam.visible = P.beamMat.opacity > 0.01;
  const bh = Math.max(0.1, u.y - 0.22);
  P.beam.position.set(u.x, bh / 2, u.z);
  P.beam.scale.set(1, bh, 1);
  P.beam.rotation.y += dt * 3;
}

function updateParking(dt, thrusting) {
  if (ufo.mode !== 'fly' || !target.stall) { zoneAssist = false; ufo.inZone = false; return; }
  const ox = ufo.x - target.x, oz = ufo.z - target.z;
  const inZone = Math.abs(ox) < ZONE_X && Math.abs(oz) < ZONE_Z;
  const sp = Math.hypot(ufo.vx, ufo.vz);
  zoneAssist = inZone && !thrusting;
  ufo.inZone = inZone;
  if (inZone && sp < PARK_SPEED) {
    target.charge += dt / PARK_TIME;
    if (target.charge >= 1) doPark();
  } else target.charge = Math.max(0, target.charge - dt * 3);
}

function updateTarget(dt) {
  const tg = target;
  if (!tg.stall) { tg.group.visible = false; return; }
  tg.group.visible = true;
  tg.spawnT = Math.min(1, tg.spawnT + dt / 0.55);
  const s = easeOutBack(tg.spawnT);
  tg.decal.scale.set(s, 1, s);
  const near = Math.hypot(ufo.x - tg.x, ufo.z - tg.z);
  const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
  tg.decalMat.opacity = 0.65 + pulse * 0.25 + tg.charge * 0.3;
  tg.beam.scale.set(s, tg.spawnT, s);
  tg.beam.position.y = 3.5 * tg.spawnT;
  tg.beamMat.opacity = (near < 3.2 ? 0.18 : 0.5) * (0.85 + pulse * 0.15);
  const hov = 2.3 + Math.sin(clock * 2.2) * 0.15;
  tg.holo.position.y = hov; tg.holo.rotation.z += dt * 1.4;
  tg.holo2.position.y = hov + 0.45 + Math.sin(clock * 2.2 + 1) * 0.1;
  tg.holo.scale.setScalar(s); tg.holo2.scale.setScalar(s);
  tg.holoMat.opacity = near < 3.2 ? 0.25 : 0.75;
  tg.sign.position.y = 3.6 + Math.sin(clock * 2.2 + 0.5) * 0.18;
  tg.sign.material.opacity = near < 3.2 ? 0.35 : 1;
  tg.sign.scale.set(1.1 * s, 1.1 * s, 1);
  const segs = Math.floor(clamp(tg.charge, 0, 1) * 64);
  tg.cGeo.setDrawRange(0, segs * 6);
  tg.cBgMat.opacity = ufo.inZone ? 0.3 : 0.1;
  const col = ufo.inZone ? 0x9dffc8 : 0x3dff9a;
  tg.decalMat.color.setHex(col);
}

function updateCars(dt) {
  const blink = Math.sin(clock * 22) > 0;
  for (const c of cars) updateCarFx(c, dt, blink);
  updateCarFx(patrol, dt, blink);
}
function updateCarFx(c, dt, blink) {
  c.jvx += (-90 * c.jx - 7 * c.jvx) * dt; c.jvz += (-90 * c.jz - 7 * c.jvz) * dt;
  c.jx += c.jvx * dt; c.jz += c.jvz * dt;
  c.tilt.rotation.set(clamp(c.jz, -0.25, 0.25), 0, clamp(-c.jx, -0.25, 0.25));
  if (c.alarm > 0) {
    c.alarm -= dt;
    const on = blink && c.alarm > 0;
    c.headMat.emissive.setHex(0xffa020); c.tailMat.emissive.setHex(0xffa020);
    c.headMat.emissiveIntensity = on ? 4 : 0.1; c.tailMat.emissiveIntensity = on ? 4 : 0.1;
    if (c.alarm <= 0) {
      c.headMat.emissive.setHex(0xfff1c4); c.tailMat.emissive.setHex(0xff2a2a);
      c.headMat.emissiveIntensity = c === patrol ? 2.5 : 0.25; c.tailMat.emissiveIntensity = 0.45;
    }
  }
}

function updatePatrol(dt) {
  const p = patrol;
  if (!p.active) return;
  p.x += p.dir * p.speed * dt;
  if (p.dir > 0 && p.x > 30) { p.dir = -1; p.z = LANES[1]; p.x = 30; }
  else if (p.dir < 0 && p.x < -30) { p.dir = 1; p.z = LANES[0]; p.x = -30; }
  p.root.position.set(p.x, 0, p.z);
  p.model.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const ph = Math.floor(clock * 7) % 2;
  p.redMat.emissiveIntensity = ph ? 4 : 0.3;
  p.blueMat.emissiveIntensity = ph ? 0.3 : 4;
  p.flashMat.color.setHex(ph ? 0xff1030 : 0x2060ff);
  p.flashMat.opacity = 0.45;
  p.honkT -= dt;
  const ahead = (ufo.x - p.x) * p.dir;
  if (state === 'play' && p.honkT <= 0 && ahead > 1.5 && ahead < 6 && Math.abs(ufo.z - p.z) < 2.2) { Sound.honk(); p.honkT = 2.5; }
}

function updateArrow(dt, thrusting) {
  const a = arrow;
  const show = ufo.mode === 'fly' && state !== 'over' ? 1 : 0;
  a.vis = damp(a.vis, show, 10, dt);
  a.group.position.set(ufo.x, ufo.y - 0.08, ufo.z);
  a.pivot.rotation.y = -ufo.ang;
  a.pop = damp(a.pop, thrusting ? 1 : 0, 16, dt);
  a.press = Math.max(0, a.press - dt * 3);
  const sc = 1 + a.pop * 0.3 + a.press;
  a.chevHolder.scale.setScalar(sc);
  a.chevHolder.position.x = 1.78 + a.pop * 0.3;
  a.chevMat.color.setRGB(1, lerp(0.95, 0.55, a.pop), lerp(0.42, 0.9, a.pop));
  a.chevMat.opacity = a.vis;
  a.glowMat.opacity = a.vis * (0.45 + a.pop * 0.4);
  a.trackMat.opacity = a.vis * (0.14 + a.pop * 0.1);
  a.flameMat.opacity = a.pop * 0.85 * a.vis * (0.8 + Math.random() * 0.2);
  a.group.visible = a.vis > 0.01;

  // stop predictor
  const sp = Math.hypot(ufo.vx, ufo.vz);
  const sx = clamp(ufo.x + ufo.vx / DRAG, LOT.minX + UFO_R, LOT.maxX - UFO_R);
  const sz = clamp(ufo.z + ufo.vz / DRAG, LOT.minZ + UFO_R, LOT.maxZ - UFO_R);
  const good = target.stall && Math.abs(sx - target.x) < ZONE_X && Math.abs(sz - target.z) < ZONE_Z;
  a.stopVis = damp(a.stopVis, sp > 0.7 && ufo.mode === 'fly' && state === 'play' ? 1 : 0, 8, dt);
  const vis = a.stopVis;
  a.stopRing.visible = a.stopDot.visible = a.line.visible = vis > 0.02;
  if (vis > 0.02) {
    a.stopRing.position.set(sx, 0.06, sz);
    a.stopDot.position.set(sx, 0.06, sz);
    a.stopRing.scale.setScalar(good ? 1 + Math.sin(clock * 14) * 0.06 : 1);
    a.stopMat.color.setHex(good ? 0x6bff9a : 0x7df9ff);
    a.lineMat.color.setHex(good ? 0x6bff9a : 0x7df9ff);
    a.stopMat.opacity = vis * (good ? 0.95 : 0.55);
    a.lineMat.opacity = vis * 0.5;
    const pa = a.lineGeo.attributes.position;
    pa.setXYZ(0, ufo.x, 0.06, ufo.z); pa.setXYZ(1, sx, 0.06, sz); pa.needsUpdate = true;
    a.lineGeo.computeBoundingSphere();
    a.line.computeLineDistances();
  }
}

// camera
const camPos = new T.Vector3(0, 14, 30), camLook = new T.Vector3(0, 0, 0);
const _tp = new T.Vector3(), _tl = new T.Vector3();
function updateCamera(rdt) {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.85;
  let k;
  if (state === 'menu') {
    const a = clock * 0.07 + 0.5;
    const R = portrait ? 46 : 31;
    _tp.set(Math.sin(a) * R, portrait ? 17 : 11, Math.cos(a) * R);
    _tl.set(0, 0.5, -2);
    k = 1.4;
  } else {
    let fx = ufo.x, fz = ufo.z;
    if (target.stall) { fx += (target.x - ufo.x) * 0.28; fz += (target.z - ufo.z) * 0.28; }
    fx += ufo.vx * 0.16; fz += ufo.vz * 0.16;
    const tanH = Math.tan((22.5 * Math.PI) / 180);
    let D;
    if (portrait) { fx = clamp(fx, -11, 11); fz = clamp(fz, -5, 5); D = Math.max(20, 17.5 / (2 * tanH * aspect)); }
    else { fx = clamp(fx, -9, 9); fz = clamp(fz, -6, 6); D = Math.max(19, 25 / (2 * tanH * aspect)); }
    let pitch = 52;
    if (state === 'over') { D *= 1.12; pitch = 44; }
    pitch = (pitch * Math.PI) / 180;
    const yaw = portrait ? Math.PI / 2 : 0;
    const hor = Math.cos(pitch) * D;
    _tp.set(fx + Math.sin(yaw) * hor, Math.sin(pitch) * D, fz + Math.cos(yaw) * hor);
    _tl.set(fx, 0, fz);
    k = state === 'play' ? Math.min(4, 1.3 + (clock - playStart) * 2.2) : 1.5;
  }
  camPos.x = damp(camPos.x, _tp.x, k, rdt); camPos.y = damp(camPos.y, _tp.y, k, rdt); camPos.z = damp(camPos.z, _tp.z, k, rdt);
  camLook.x = damp(camLook.x, _tl.x, k * 1.2, rdt); camLook.y = damp(camLook.y, _tl.y, k * 1.2, rdt); camLook.z = damp(camLook.z, _tl.z, k * 1.2, rdt);
  trauma = Math.max(0, trauma - rdt * 1.7);
  const s = trauma * trauma;
  camera.position.set(camPos.x + (Math.random() - 0.5) * s * 1.3, camPos.y + (Math.random() - 0.5) * s * 0.9, camPos.z + (Math.random() - 0.5) * s * 1.3);
  camera.lookAt(camLook);
}

function updateOffscreen() {
  if (state !== 'play' || !target.stall) { el.off.style.opacity = '0'; return; }
  _v.set(target.x, 0.5, target.z).project(camera);
  let x = _v.x, y = _v.y;
  const behind = _v.z > 1;
  if (behind) { x = -x; y = -y; }
  const inside = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.88;
  if (inside) { el.off.style.opacity = '0'; return; }
  const m = Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.8);
  const ex = x / m, ey = y / m;
  const w = window.innerWidth, h = window.innerHeight;
  const sx = (ex * 0.5 + 0.5) * w, sy = (-ey * 0.5 + 0.5) * h;
  const ang = Math.atan2(-y, x);
  el.off.style.opacity = '1';
  el.off.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${ang.toFixed(3)}rad) translate(-14px, -16px)`;
}

function updateHUD(dt) {
  if (state === 'menu') return;
  setText(el.score, 's', String(score));
  const tl = Math.max(0, timeLeft);
  setText(el.timer, 't', tl < 10 ? tl.toFixed(1) : String(Math.ceil(tl)));
  setText(el.parks, 'p', String(parks));
  setText(el.combo, 'c', combo > 1 ? `COMBO ×${combo}` : '');
  if (state === 'play') {
    hintTimer += dt;
    if ((parks >= 1 && hintTimer > 4) || hintTimer > 14) el.hint.classList.remove('on');
  }
  if (state === 'over' && !overShown && overT > 0.9) {
    overShown = true;
    el.over.classList.remove('hidden');
    el.hud.classList.remove('on');
  }
  if (state === 'over' && overT > 1.3) el.again.classList.add('ready');
}

// ------------------------------------------------------------------ input
const KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyX', 'KeyZ', 'KeyJ', 'KeyK', 'ShiftLeft', 'ShiftRight']);
const keysDown = new Set();
const pointers = new Set();
function isHeldNow() { return keysDown.size > 0 || pointers.size > 0; }
function press() { const was = held; held = true; if (!was) onPress(); }
function releaseCheck() { if (held && !isHeldNow()) { held = false; onRelease(); } }
function onPress() {
  Sound.init(); Media.init();
  if (state === 'menu') { startGame(); needRelease = true; }
  else if (state === 'over') { if (overT > 1.3) { startGame(); needRelease = true; } }
  else if (state === 'play' && !needRelease && ufo.mode === 'fly') { arrow.press = 0.35; Sound.press(); }
}
function onRelease() { needRelease = false; }
function toggleMute() {
  const m = !Sound.muted;
  Sound.setMuted(m); Media.setMuted(m);
  el.mute.classList.toggle('off', m);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { if (!e.repeat) toggleMute(); return; }
  if (!KEYS.has(e.code)) return;
  e.preventDefault();
  if (e.repeat) return;
  keysDown.add(e.code);
  press();
});
window.addEventListener('keyup', (e) => {
  if (!KEYS.has(e.code)) return;
  e.preventDefault();
  keysDown.delete(e.code);
  releaseCheck();
});
window.addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('#mute')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  pointers.add(e.pointerId);
  press();
}, { passive: false });
const pointerUp = (e) => {
  pointers.delete(e.pointerId);
  Sound.resume();
  if (state === 'play' && Media.music && Media.music.paused) Media.playMusic();
  releaseCheck();
};
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);
window.addEventListener('touchstart', (e) => { if (!(e.target && e.target.closest && e.target.closest('#mute'))) e.preventDefault(); }, { passive: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => { keysDown.clear(); pointers.clear(); releaseCheck(); });
el.mute.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
el.mute.addEventListener('click', (e) => { e.preventDefault(); Sound.init(); Media.init(); toggleMute(); el.mute.blur(); });
document.addEventListener('visibilitychange', () => {
  if (!Media.music) return;
  if (document.hidden) Media.music.pause();
  else if (state !== 'menu') Media.playMusic();
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ------------------------------------------------------------------ main loop
function update(dt, rdt) {
  clock += dt;
  bumpCd -= dt; voiceCd -= rdt;
  const thrusting = state === 'play' && ufo.mode === 'fly' && held && !needRelease;
  if (state === 'play') {
    timeLeft -= dt;
    const sec = Math.ceil(timeLeft);
    if (sec <= 5 && sec > 0 && sec !== lastTick) {
      lastTick = sec; Sound.tick(sec <= 3);
      el.timer.classList.add('hurry');
      el.timer.classList.remove('beat'); void el.timer.offsetWidth; el.timer.classList.add('beat');
    } else if (timeLeft < 10) el.timer.classList.add('hurry');
    if (timeLeft <= 0) { timeLeft = 0; endGame(); }
  } else if (state === 'over') overT += rdt;
  if (state === 'menu') {
    // gentle attract-mode drift
    ufo.vx += Math.cos(clock * 0.5) * 0.6 * dt;
    ufo.vz += Math.sin(clock * 0.7) * 0.2 * dt;
    if (!target.stall) pickTarget(true);
  }
  updateUFO(dt, thrusting);
  if (state === 'play') updateParking(dt, thrusting); else { zoneAssist = false; ufo.inZone = false; target.charge = Math.max(0, target.charge - dt * 3); }
  updateTarget(dt);
  updateCars(dt);
  updatePatrol(dt);
  updateArrow(dt, thrusting);
  updateParticles(dt);
  updateShocks(dt);
  for (let i = 0; i < blinkers.length; i++) blinkers[i].visible = Math.sin(clock * 3 + i * 1.7) > 0.2;
  updateCamera(rdt);
  updateFloats(rdt);
  updateOffscreen();
  updateHUD(rdt);
  Sound.update(ufo.thrustAmt, target.charge, state === 'play' ? 1 : 0.5);
}

// the patrol car cruises in attract mode for flavour
patrol.active = true; patrol.root.visible = true; patrol.x = -8;

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  let dt = rdt;
  if (hitstop > 0) { hitstop -= rdt; dt *= 0.15; }
  update(dt, rdt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// expose a tiny hook for automated smoke tests
window.__saucer = { get state() { return state; }, get score() { return score; }, get parks() { return parks; }, ufo, target, update };
})();
