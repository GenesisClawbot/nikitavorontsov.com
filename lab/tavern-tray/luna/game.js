(() => {
  'use strict';

  const THREE = window.THREE;
  if (!THREE) {
    document.body.innerHTML = '<p style="padding:2rem;color:white;font:18px sans-serif">The local Three.js file could not be found.</p>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const hud = $('hud');
  const titleScreen = $('title-screen');
  const resultScreen = $('result-screen');
  const eventCue = $('event-cue');
  const bracePrompt = $('brace-prompt');
  const gripHud = $('grip-hud');
  const cueKicker = $('cue-kicker');
  const cueTitle = $('cue-title');
  const cueCopy = $('cue-copy');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.setClearColor(0x24181c, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x24181c);
  scene.fog = new THREE.Fog(0x24181c, 18, 42);

  const camera = new THREE.PerspectiveCamera(51, 1, 0.08, 90);
  camera.position.set(0, 1.62, 4.4);
  camera.lookAt(0, 1.54, -5.5);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(0xffd9a4, 0x28191c, 1.18);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xffdfa8, 2.05);
  keyLight.position.set(-4.5, 8, 5);
  scene.add(keyLight);
  const coolFill = new THREE.DirectionalLight(0x83b5bb, 0.48);
  coolFill.position.set(5, 3, -5);
  scene.add(coolFill);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const littleSphereGeo = new THREE.SphereGeometry(1, 7, 5);
  const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
  const unitThinCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const shadowGeo = new THREE.CircleGeometry(1, 18);
  const sparkGeo = new THREE.SphereGeometry(1, 6, 5);
  const mat = (color, roughness = 0.72, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const mats = {
    floor: mat(0x40302a, 0.92),
    floorLight: mat(0x604236, 0.84),
    floorDark: mat(0x281f20, 0.96),
    rail: mat(0x927049, 0.55, { metalness: 0.3 }),
    darkWood: mat(0x372423, 0.78),
    wood: mat(0x684433, 0.76),
    woodLight: mat(0x956447, 0.72),
    wall: [mat(0x68453b, 0.95), mat(0x72503e, 0.93), mat(0x60403b, 0.94)],
    beam: mat(0x382424, 0.83),
    trim: mat(0xc49354, 0.48, { metalness: 0.42 }),
    iron: mat(0x292c31, 0.39, { metalness: 0.74 }),
    brass: mat(0xd09c4c, 0.31, { metalness: 0.68 }),
    amberGlow: mat(0xffbb5d, 0.25, { emissive: 0xf07821, emissiveIntensity: 1.35 }),
    candle: mat(0xffd18b, 0.25, { emissive: 0xff922e, emissiveIntensity: 1.65 }),
    cream: mat(0xf8dfad, 0.83),
    shadow: new THREE.MeshBasicMaterial({ color: 0x120e12, transparent: true, opacity: 0.23, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xc9e5df, roughness: 0.13, metalness: 0.03, transparent: true, opacity: 0.29, side: THREE.DoubleSide, depthWrite: false }),
    glassEdge: mat(0xd7eee2, 0.18, { metalness: 0.16, emissive: 0x304044, emissiveIntensity: 0.28 }),
    goldSpark: mat(0xffdc89, 0.22, { emissive: 0xff9d35, emissiveIntensity: 1.9 }),
    greenSpark: mat(0x9ff3cf, 0.2, { emissive: 0x39c898, emissiveIntensity: 1.35 })
  };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);

  function mesh(parent, geometry, material, position, scale, rotation) {
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.set(position[0], position[1], position[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) m.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
    parent.add(m);
    return m;
  }
  function box(parent, material, position, scale, rotation) {
    return mesh(parent, boxGeo, material, position, scale, rotation);
  }
  function sphere(parent, material, position, scale, geometry = sphereGeo) {
    return mesh(parent, geometry, material, position, scale);
  }
  function cylinder(parent, material, position, radius, height, segments = 10, topRadius = radius, bottomRadius = radius) {
    if (topRadius === radius && bottomRadius === radius) {
      const geo = segments === 8 ? unitThinCylinderGeo : (segments === 10 ? unitCylinderGeo : new THREE.CylinderGeometry(1, 1, 1, segments, 1, false));
      return mesh(parent, geo, material, position, [radius, height, radius]);
    }
    const tapered = new THREE.CylinderGeometry(topRadius, bottomRadius, 1, segments, 1, false);
    return mesh(parent, tapered, material, position, [1, height, 1]);
  }
  function torus(parent, material, position, radius, tube, rotation = [Math.PI / 2, 0, 0], segments = 12) {
    const geo = new THREE.TorusGeometry(radius, tube, 6, segments);
    return mesh(parent, geo, material, position, [1, 1, 1], rotation);
  }

  // Long plank floor; the seams scroll underfoot while the rooms slip past on little set pieces.
  box(scene, mats.floor, [0, -0.17, -24], [9.4, 0.34, 60]);
  const floorSeams = [];
  for (let i = 0; i < 37; i++) {
    const seam = box(scene, i % 3 === 0 ? mats.floorLight : mats.floorDark, [0, 0.004, -49 + i * 1.5], [9.25, 0.009, i % 3 === 0 ? 0.035 : 0.022]);
    floorSeams.push(seam);
  }
  box(scene, mats.darkWood, [-1.67, 0.010, -23], [0.035, 0.012, 55]);
  box(scene, mats.darkWood, [1.67, 0.010, -23], [0.035, 0.012, 55]);

  const patrons = [];
  const lanterns = [];
  const sections = [];
  const signTextures = new Map();
  function signTexture(text, ink = '#423021') {
    const key = `${text}:${ink}`;
    if (signTextures.has(key)) return signTextures.get(key);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cda369'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#422e26'; ctx.fillRect(9, 9, 494, 238);
    ctx.fillStyle = '#dfbd7a'; ctx.fillRect(17, 17, 478, 222);
    ctx.strokeStyle = '#775139'; ctx.lineWidth = 4; ctx.strokeRect(29, 28, 454, 200);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText(text, 256, 123, 430);
    ctx.fillStyle = '#a7673d';
    ctx.beginPath(); ctx.arc(58, 128, 7, 0, Math.PI * 2); ctx.arc(454, 128, 7, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    signTextures.set(key, tex);
    return tex;
  }

  function addShadow(parent, x, z, sx = 0.6, sz = 0.36) {
    const m = mesh(parent, shadowGeo, mats.shadow, [x, 0.012, z], [sx, sz, 1], [-Math.PI / 2, 0, 0]);
    m.renderOrder = 1;
    return m;
  }

  const palettes = [
    { coat: 0x4b6572, trim: 0xc59c5b, skin: 0xc98968, hair: 0x3a2b2a, trouser: 0x37343a, hat: 0x35504f },
    { coat: 0x783c46, trim: 0xe0b66c, skin: 0xdfa57d, hair: 0x664330, trouser: 0x39282a, hat: 0x48364a },
    { coat: 0x536245, trim: 0xc6a261, skin: 0xb97c61, hair: 0x30251f, trouser: 0x3b3430, hat: 0x766041 },
    { coat: 0x5d496d, trim: 0xd8b373, skin: 0xe0b68f, hair: 0x4b352a, trouser: 0x332b3d, hat: 0x465367 },
    { coat: 0x9a633d, trim: 0xf0c274, skin: 0x9e634e, hair: 0x28202a, trouser: 0x3b3130, hat: 0x416464 },
    { coat: 0x3f6964, trim: 0xd7aa5e, skin: 0xdba183, hair: 0x45312e, trouser: 0x343643, hat: 0x794a40 }
  ];
  function createPatron(palette = palettes[0], side = 0, scale = 1) {
    const root = new THREE.Group();
    root.rotation.y = side * Math.PI / 2;
    root.scale.setScalar(scale);
    const body = new THREE.Group();
    root.add(body);
    const coat = mat(palette.coat, 0.88);
    const trim = mat(palette.trim, 0.5, { metalness: 0.18 });
    const skin = mat(palette.skin, 0.87);
    const hair = mat(palette.hair, 0.92);
    const trouser = mat(palette.trouser, 0.94);
    const hat = mat(palette.hat, 0.83);
    const boot = mat(0x292526, 0.88);

    cylinder(body, coat, [0, 1.06, 0], 0.31, 0.80, 8, 0.27, 0.34);
    box(body, trim, [0, 0.82, -0.291], [0.34, 0.11, 0.027]);
    box(body, mat(0x54382f, 0.85), [0, 1.12, -0.30], [0.31, 0.36, 0.025]);
    for (let i = 0; i < 3; i++) sphere(body, trim, [0, 1.23 - i * 0.11, -0.319], [0.026, 0.026, 0.013], littleSphereGeo);

    for (const legSide of [-1, 1]) {
      cylinder(body, trouser, [legSide * 0.14, 0.40, 0.015], 0.115, 0.55, 8, 0.105, 0.13);
      box(body, boot, [legSide * 0.15, 0.12, -0.045], [0.23, 0.19, 0.34]);
    }
    sphere(body, skin, [0, 1.68, -0.005], [0.245, 0.29, 0.235]);
    // Hair cap, brows, bead-bright eyes and a very earnest nose.
    sphere(body, hair, [0, 1.86, 0.015], [0.25, 0.14, 0.24]);
    sphere(body, skin, [0, 1.65, -0.228], [0.052, 0.055, 0.065], littleSphereGeo);
    for (const eyeSide of [-1, 1]) {
      sphere(body, mat(0xffe4c1, 0.48), [eyeSide * 0.083, 1.713, -0.205], [0.047, 0.052, 0.027], littleSphereGeo);
      sphere(body, mat(0x291f20, 0.45), [eyeSide * 0.084, 1.71, -0.229], [0.019, 0.026, 0.012], littleSphereGeo);
    }
    // Hats are delightfully unnecessary and therefore mandatory.
    cylinder(body, trim, [0, 1.97, 0], 0.28, 0.055, 9);
    const pointHat = Math.random() > 0.53;
    if (pointHat) {
      mesh(body, new THREE.ConeGeometry(0.20, 0.39, 6), hat, [0, 2.18, 0], [1, 1, 1], [0, 0, rand(-0.18, 0.18)]);
      sphere(body, trim, [rand(-0.08, 0.08), 2.36, -0.015], [0.055, 0.055, 0.055], littleSphereGeo);
    } else {
      sphere(body, hat, [0, 1.99, 0.015], [0.29, 0.12, 0.28]);
      cylinder(body, trim, [0, 2.02, 0], 0.25, 0.035, 9);
    }
    // A few faces have magnificent beards. All faces have a little self-confidence.
    if (Math.random() > 0.48) {
      const beard = mesh(body, new THREE.ConeGeometry(0.14, 0.24, 7), hair, [0, 1.49, -0.195], [1, 1, 0.60], [Math.PI, 0, 0]);
      beard.rotation.z = rand(-0.12, 0.12);
    }

    const arms = [];
    for (const armSide of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(armSide * 0.29, 1.34, 0.005);
      body.add(arm);
      const upper = mesh(arm, new THREE.CylinderGeometry(0.105, 0.13, 0.48, 7), coat, [0, -0.23, 0], [1, 1, 1], [0, 0, armSide * -0.14]);
      cylinder(arm, trim, [0, -0.075, 0], 0.137, 0.09, 8);
      sphere(arm, skin, [armSide * -0.02, -0.50, -0.005], [0.115, 0.12, 0.12], littleSphereGeo);
      arms.push(arm);
      if (armSide === 1 && Math.random() > 0.30) {
        const cup = cylinder(arm, mats.brass, [0.07, -0.43, -0.10], 0.075, 0.14, 8, 0.09, 0.06);
        torus(arm, mats.cream, [0.07, -0.35, -0.10], 0.082, 0.012);
      }
    }
    const shadow = addShadow(root, 0, 0, 0.48, 0.30);
    return { root, body, arms, shadow, phase: rand(0, Math.PI * 2), lively: rand(0.75, 1.35) };
  }

  function makeSign(parent, side, z, text) {
    const group = new THREE.Group();
    group.position.set(side * 3.82, 3.05, z);
    group.rotation.y = -side * Math.PI / 2;
    parent.add(group);
    box(group, mats.darkWood, [0, 0, 0], [1.13, 0.64, 0.10]);
    const faceMat = new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.8, metalness: 0.04, side: THREE.DoubleSide });
    mesh(group, new THREE.PlaneGeometry(1.02, 0.51), faceMat, [0, 0, 0.057]);
    for (const x of [-0.46, 0.46]) sphere(group, mats.brass, [x, 0, 0.065], [0.024, 0.024, 0.018], littleSphereGeo);
    return group;
  }

  function createLantern(parent, x, y, z, lit) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    cylinder(g, mats.iron, [0, 0.22, 0], 0.025, 0.50, 6);
    cylinder(g, mats.brass, [0, -0.06, 0], 0.22, 0.075, 6, 0.16, 0.20);
    box(g, mats.iron, [0, -0.32, 0], [0.33, 0.46, 0.29]);
    const glow = box(g, mats.amberGlow, [0, -0.32, 0.153], [0.19, 0.30, 0.02]);
    glow.material = new THREE.MeshStandardMaterial({ color: 0xffcc72, emissive: 0xff861c, emissiveIntensity: 1.75, roughness: 0.3 });
    cylinder(g, mats.brass, [0, -0.56, 0], 0.20, 0.055, 6, 0.16, 0.16);
    sphere(g, mats.candle, [0, -0.32, 0], [0.095, 0.14, 0.095], littleSphereGeo);
    for (const xoff of [-0.18, 0.18]) box(g, mats.brass, [xoff, -0.32, 0], [0.035, 0.46, 0.035]);
    let light = null;
    if (lit) {
      light = new THREE.PointLight(0xffaa5b, 4.3, 9.5, 2);
      light.position.set(x, y - 0.4, z);
      parent.add(light);
    }
    lanterns.push({ glow, light, phase: rand(0, Math.PI * 2), power: lit ? 4.3 : 0 });
  }

  function createTable(parent, side, z, index) {
    const x = side * 2.76;
    const topColor = [mats.woodLight, mats.wood, mats.darkWood][index % 3];
    const table = new THREE.Group();
    table.position.set(x, 0, z);
    parent.add(table);
    cylinder(table, mats.beam, [0, 0.47, 0], 0.105, 0.87, 9, 0.11, 0.15);
    cylinder(table, mats.darkWood, [0, 0.91, 0], 0.57, 0.13, 12, 0.57, 0.55);
    cylinder(table, topColor, [0, 0.989, 0], 0.55, 0.04, 12, 0.55, 0.55);
    cylinder(table, mats.trim, [0, 1.016, 0], 0.16, 0.016, 10, 0.16, 0.16);
    cylinder(table, mats.darkWood, [0, 0.065, 0], 0.30, 0.12, 10, 0.35, 0.25);
    // One tiny bottle and a candle: the tavern's ambitious centerpiece.
    cylinder(table, index % 2 ? mat(0x47644c, 0.45) : mat(0x874b46, 0.44), [0.17, 1.18, 0.10], 0.095, 0.30, 8, 0.065, 0.11);
    cylinder(table, mats.darkWood, [0.17, 1.34, 0.10], 0.038, 0.09, 7);
    const candle = cylinder(table, mats.cream, [-0.20, 1.12, -0.12], 0.045, 0.17, 7);
    sphere(table, mats.candle, [-0.20, 1.23, -0.12], [0.06, 0.09, 0.06], littleSphereGeo);
    table.userData.candle = candle;
    addShadow(parent, x, z, 0.72, 0.60);

    const stool = new THREE.Group();
    stool.position.set(x - side * 0.74, 0, z + 0.30);
    parent.add(stool);
    cylinder(stool, mats.beam, [0, 0.35, 0], 0.055, 0.66, 8);
    cylinder(stool, mats.wood, [0, 0.70, 0], 0.25, 0.11, 9);
    cylinder(stool, mats.darkWood, [0, 0.09, 0], 0.17, 0.07, 8);
    return table;
  }

  function createUprightKeg(parent, side, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(side * 3.38, 0.38 * scale, z);
    g.scale.setScalar(scale);
    parent.add(g);
    cylinder(g, mats.wood, [0, 0, 0], 0.38, 0.70, 10, 0.34, 0.36);
    for (const y of [-0.22, 0.20]) torus(g, mats.iron, [0, y, 0], 0.37, 0.035, [Math.PI / 2, 0, 0], 10);
    cylinder(g, mats.woodLight, [0, 0.36, 0], 0.33, 0.045, 9);
    sphere(g, mats.brass, [0, 0.02, 0.374], [0.10, 0.10, 0.03], littleSphereGeo);
    addShadow(parent, side * 3.38, z, 0.43, 0.36);
    return g;
  }

  const signWords = ['NO PIXIES', 'GOOD SOUP', 'MIND THE ELF', 'LAST ALE', 'NO DUELS', 'WARM ROOMS'];
  for (let i = 0; i < 5; i++) {
    const root = new THREE.Group();
    root.position.z = -4 - i * 10;
    scene.add(root);
    const wallMat = mats.wall[i % mats.wall.length];
    for (const side of [-1, 1]) {
      box(root, wallMat, [side * 4.34, 1.86, 0], [0.38, 3.95, 10.4]);
      box(root, mats.beam, [side * 4.12, 1.86, 0], [0.10, 4.08, 10.25]);
      for (const z of [-4.75, 0, 4.75]) {
        box(root, mats.wood, [side * 3.79, 2.22, z], [0.32, 4.55, 0.34]);
        box(root, mats.trim, [side * 3.59, 2.25, z], [0.045, 4.24, 0.045]);
      }
      box(root, mats.woodLight, [side * 3.92, 0.55, 0], [0.22, 0.16, 10.1]);
    }
    for (const z of [-4.76, -0.01, 4.74]) {
      box(root, mats.beam, [0, 4.12, z], [8.3, 0.36, 0.46]);
      box(root, mats.woodLight, [0, 4.31, z], [8.0, 0.07, 0.11]);
    }
    // Rafters disappear into the smoke rather than making a closed, gloomy ceiling.
    for (const side of [-1, 1]) {
      const rafter = box(root, mats.darkWood, [side * 2.65, 4.58, -2.45], [0.17, 0.15, 5.0], [0, 0, side * 0.075]);
      rafter.material = mats.beam;
    }
    createTable(root, -1, -2.25, i);
    createTable(root, 1, 1.75, i + 1);
    const p1 = createPatron(palettes[(i * 2) % palettes.length], -1, 0.91 + (i % 3) * 0.035);
    p1.root.position.set(-2.18 - (i % 2) * 0.10, 0, 0.3);
    root.add(p1.root); patrons.push(p1);
    const p2 = createPatron(palettes[(i * 2 + 3) % palettes.length], 1, 0.89 + ((i + 1) % 3) * 0.04);
    p2.root.position.set(2.20 + (i % 2) * 0.09, 0, -2.5);
    root.add(p2.root); patrons.push(p2);
    if (i % 2 === 1) {
      const p3 = createPatron(palettes[(i + 2) % palettes.length], i % 2 ? -1 : 1, 0.79);
      p3.root.position.set(-2.67, 0, 3.25);
      root.add(p3.root); patrons.push(p3);
    }
    makeSign(root, -1, -3.1, signWords[(i * 2) % signWords.length]);
    makeSign(root, 1, 2.75, signWords[(i * 2 + 1) % signWords.length]);
    createLantern(root, 0, 4.14, -1.15, i % 2 === 0);
    if (i % 2 === 0) createLantern(root, -2.55, 3.6, 3.25, false);
    if (i === 1 || i === 3) createUprightKeg(root, 1, -4.0, 0.9);
    sections.push(root);
  }

  // A warm, slightly mysterious delivery door that comes into view on the last stretch.
  const exitGroup = new THREE.Group();
  exitGroup.visible = false;
  scene.add(exitGroup);
  box(exitGroup, mats.darkWood, [0, 1.8, 0], [3.25, 3.65, 0.42]);
  box(exitGroup, mats.wood, [0, 1.67, 0.23], [2.78, 3.20, 0.08]);
  for (const x of [-0.69, 0.69]) box(exitGroup, mats.beam, [x, 1.63, 0.29], [1.18, 3.00, 0.06]);
  box(exitGroup, mats.trim, [0, 1.62, 0.34], [0.055, 2.95, 0.035]);
  const doorMat = new THREE.MeshStandardMaterial({ map: signTexture('DELIVER', '#3b2c22'), roughness: 0.72, metalness: 0.04 });
  box(exitGroup, mats.iron, [0, 3.25, 0.16], [2.05, 0.62, 0.18]);
  mesh(exitGroup, new THREE.PlaneGeometry(1.90, 0.49), doorMat, [0, 3.25, 0.264]);
  const arch = mesh(exitGroup, new THREE.TorusGeometry(1.60, 0.10, 8, 22, Math.PI), mats.beam, [0, 3.37, -0.02]);
  arch.rotation.z = 0;
  cylinder(exitGroup, mats.brass, [1.08, 1.62, 0.38], 0.075, 0.21, 8);
  sphere(exitGroup, mats.candle, [-1.20, 3.3, 0.31], [0.09, 0.13, 0.09], littleSphereGeo);
  sphere(exitGroup, mats.candle, [1.20, 3.3, 0.31], [0.09, 0.13, 0.09], littleSphereGeo);
  const exitLight = new THREE.PointLight(0xffc36d, 0, 13, 2);
  exitLight.position.set(0, 2.8, -0.4);
  exitGroup.add(exitLight);

  // Four highly avoidable, highly impolite members of the service staff.
  const hazardKeg = new THREE.Group();
  scene.add(hazardKeg);
  const rollingWood = cylinder(hazardKeg, mats.woodLight, [0, 0.53, 0], 0.42, 0.93, 10, 0.40, 0.40);
  rollingWood.rotation.z = Math.PI / 2;
  for (const x of [-0.30, 0.30]) {
    const hoop = torus(hazardKeg, mats.iron, [x, 0.53, 0], 0.417, 0.034, [0, Math.PI / 2, 0], 12);
    hoop.rotation.y = Math.PI / 2;
  }
  for (let i = 0; i < 5; i++) {
    const badge = sphere(hazardKeg, i % 2 ? mats.wood : mats.trim, [0, 0.53 + Math.sin(i * Math.PI * 2 / 5) * 0.28, Math.cos(i * Math.PI * 2 / 5) * 0.405], [0.055, 0.055, 0.022], littleSphereGeo);
    badge.rotation.x = i * 0.6;
  }
  hazardKeg.visible = false;
  addShadow(scene, 0, -9, 0.65, 0.46);

  const dancerData = createPatron({ coat: 0x9d573f, trim: 0xf3cf7c, skin: 0xc37e5f, hair: 0x362524, trouser: 0x4d3432, hat: 0x49615a }, 0, 1.14);
  const hazardDancer = dancerData.root;
  scene.add(hazardDancer);
  hazardDancer.visible = false;

  const floorHazard = new THREE.Group();
  scene.add(floorHazard);
  const puddleMaterial = new THREE.MeshStandardMaterial({ color: 0x2b9287, emissive: 0x0e4847, emissiveIntensity: 0.52, roughness: 0.20, metalness: 0.32, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const puddle = mesh(floorHazard, new THREE.CircleGeometry(0.74, 24), puddleMaterial, [0, 0.035, 0], [1.35, 0.58, 1], [-Math.PI / 2, 0, 0]);
  const puddleRing = torus(floorHazard, mats.greenSpark, [0, 0.045, 0], 0.43, 0.018, [0, 0, 0], 20);
  puddleRing.rotation.x = Math.PI / 2;
  box(floorHazard, mats.woodLight, [-0.35, 0.045, -0.30], [1.05, 0.08, 0.18], [0, 0.04, 0.10]);
  box(floorHazard, mats.wood, [0.54, 0.045, 0.27], [0.86, 0.09, 0.17], [0, -0.08, -0.11]);
  for (const x of [-0.82, 0.82]) sphere(floorHazard, mats.goldSpark, [x, 0.075, rand(-0.38, 0.38)], [0.048, 0.028, 0.045], littleSphereGeo);
  floorHazard.visible = false;

  const roastPivot = new THREE.Group();
  scene.add(roastPivot);
  cylinder(roastPivot, mats.iron, [0, -0.45, 0], 0.022, 0.95, 6);
  cylinder(roastPivot, mats.brass, [0, -0.92, 0], 0.13, 0.08, 8);
  cylinder(roastPivot, mats.darkWood, [0, -1.36, 0], 0.52, 0.10, 12, 0.52, 0.58);
  cylinder(roastPivot, mats.trim, [0, -1.42, 0], 0.43, 0.018, 12);
  box(roastPivot, mats.wood, [0.63, -1.34, 0], [0.60, 0.10, 0.12]);
  sphere(roastPivot, mat(0xad4f2f, 0.45, { emissive: 0x552112, emissiveIntensity: 0.15 }), [-0.06, -1.10, 0], [0.29, 0.28, 0.32]);
  for (const x of [-0.16, 0.06]) cylinder(roastPivot, mats.cream, [x, -1.39, 0.04], 0.034, 0.20, 6);
  roastPivot.visible = false;

  // The tray is camera-relative; all three little drinks visibly slosh with it.
  const trayRoot = new THREE.Group();
  camera.add(trayRoot);
  const trayShape = new THREE.Shape();
  const tw = 1.82, td = 0.94, cr = 0.13;
  trayShape.moveTo(-tw / 2 + cr, -td / 2);
  trayShape.lineTo(tw / 2 - cr, -td / 2);
  trayShape.absarc(tw / 2 - cr, -td / 2 + cr, cr, -Math.PI / 2, 0, false);
  trayShape.lineTo(tw / 2, td / 2 - cr);
  trayShape.absarc(tw / 2 - cr, td / 2 - cr, cr, 0, Math.PI / 2, false);
  trayShape.lineTo(-tw / 2 + cr, td / 2);
  trayShape.absarc(-tw / 2 + cr, td / 2 - cr, cr, Math.PI / 2, Math.PI, false);
  trayShape.lineTo(-tw / 2, -td / 2 + cr);
  trayShape.absarc(-tw / 2 + cr, -td / 2 + cr, cr, Math.PI, Math.PI * 1.5, false);
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, { depth: 0.085, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.018, bevelThickness: 0.014 });
  trayGeo.translate(0, 0, -0.0425);
  const trayPlate = mesh(trayRoot, trayGeo, mats.darkWood, [0, -0.025, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const topShape = new THREE.Shape();
  topShape.moveTo(-tw / 2 + cr, -td / 2 + 0.035);
  topShape.lineTo(tw / 2 - cr, -td / 2 + 0.035);
  topShape.absarc(tw / 2 - cr, -td / 2 + cr, cr - 0.025, -Math.PI / 2, 0, false);
  topShape.lineTo(tw / 2 - 0.035, td / 2 - cr);
  topShape.absarc(tw / 2 - cr, td / 2 - cr, cr - 0.025, 0, Math.PI / 2, false);
  topShape.lineTo(-tw / 2 + cr, td / 2 - 0.035);
  topShape.absarc(-tw / 2 + cr, td / 2 - cr, cr - 0.025, Math.PI / 2, Math.PI, false);
  topShape.lineTo(-tw / 2 + 0.035, -td / 2 + cr);
  topShape.absarc(-tw / 2 + cr, -td / 2 + cr, cr - 0.025, Math.PI, Math.PI * 1.5, false);
  const topGeo = new THREE.ExtrudeGeometry(topShape, { depth: 0.018, bevelEnabled: false, steps: 1 });
  topGeo.translate(0, 0, -0.009);
  mesh(trayRoot, topGeo, mats.woodLight, [0, 0.018, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  // Raised lips, brass corners, and a little inlaid goose-track.
  box(trayRoot, mats.wood, [0, 0.061, -0.438], [1.70, 0.10, 0.075]);
  box(trayRoot, mats.wood, [0, 0.061, 0.438], [1.70, 0.10, 0.075]);
  box(trayRoot, mats.wood, [-0.868, 0.061, 0], [0.075, 0.10, 0.82]);
  box(trayRoot, mats.wood, [0.868, 0.061, 0], [0.075, 0.10, 0.82]);
  for (const x of [-0.76, 0.76]) for (const z of [-0.37, 0.37]) sphere(trayRoot, mats.brass, [x, 0.118, z], [0.038, 0.018, 0.038], littleSphereGeo);
  for (const z of [-0.29, 0.29]) box(trayRoot, mats.rail, [0, 0.030, z], [1.43, 0.009, 0.012]);
  const centerSeal = sphere(trayRoot, mats.brass, [0, 0.032, 0.15], [0.074, 0.014, 0.074], littleSphereGeo);
  centerSeal.material = mats.trim;

  const sleeveMaterial = mat(0x4c353a, 0.83);
  const cuffMaterial = mat(0xb7864f, 0.54, { metalness: 0.15 });
  const skinArmMaterial = mat(0xc68c68, 0.82);
  for (const side of [-1, 1]) {
    const from = new THREE.Vector3(side * 0.49, -0.03, 0.20);
    const to = new THREE.Vector3(side * 0.78, -0.80, 0.36);
    const direction = new THREE.Vector3().subVectors(to, from);
    const sleeve = mesh(trayRoot, new THREE.CylinderGeometry(0.115, 0.17, direction.length(), 9), sleeveMaterial, [(from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2]);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    const cuff = cylinder(trayRoot, cuffMaterial, [from.x, from.y, from.z], 0.17, 0.11, 9);
    cuff.quaternion.copy(sleeve.quaternion);
    const hand = sphere(trayRoot, skinArmMaterial, [from.x * 0.8, from.y - 0.04, from.z - 0.01], [0.15, 0.13, 0.14]);
    hand.rotation.z = side * 0.20;
  }

  const liquidMats = [
    mat(0xffbd3f, 0.22, { emissive: 0xa54608, emissiveIntensity: 0.22 }),
    mat(0xef527a, 0.20, { emissive: 0x6f1036, emissiveIntensity: 0.25 }),
    mat(0x58ddba, 0.20, { emissive: 0x087a6c, emissiveIntensity: 0.35 })
  ];
  const sparkleMats = [mats.goldSpark, mats.cream, mats.greenSpark];
  const drinks = [];
  function createDrink(index, x) {
    const root = new THREE.Group();
    root.position.set(x, 0.10, 0);
    trayRoot.add(root);
    const contents = new THREE.Group();
    root.add(contents);
    const glassHeight = 0.53;
    const glassColor = mats.glass;
    const ring = (y, radius, tube = 0.014) => torus(root, mats.glassEdge, [0, y, 0], radius, tube);

    cylinder(root, mats.glassEdge, [0, 0.045, 0], 0.155, 0.060, 12, 0.16, 0.16);
    let fillBase = 0.078;
    let maxHeight = 0.32;
    let liquidRadius = 0.135;
    if (index === 0) {
      const vessel = mesh(root, new THREE.CylinderGeometry(0.175, 0.155, 1, 12, 1, true), glassColor, [0, 0.292, 0]);
      vessel.scale.y = 0.47;
      cylinder(root, mats.brass, [0, 0.125, 0], 0.163, 0.033, 12, 0.163, 0.163);
      ring(0.525, 0.173, 0.016);
      const handle = torus(root, mats.brass, [0.201, 0.31, 0], 0.125, 0.032, [0, 0, 0], 14);
      handle.scale.set(0.89, 1, 1);
      box(root, mats.brass, [0.171, 0.31, 0.005], [0.07, 0.065, 0.075]);
      maxHeight = 0.335; liquidRadius = 0.145; fillBase = 0.087;
    } else if (index === 1) {
      const profile = [
        new THREE.Vector2(0.052, 0.20), new THREE.Vector2(0.10, 0.23), new THREE.Vector2(0.15, 0.28),
        new THREE.Vector2(0.187, 0.37), new THREE.Vector2(0.19, 0.45), new THREE.Vector2(0.165, 0.49), new THREE.Vector2(0.16, 0.50)
      ];
      const bowl = mesh(root, new THREE.LatheGeometry(profile, 12), glassColor, [0, 0, 0]);
      cylinder(root, mats.brass, [0, 0.19, 0], 0.062, 0.035, 8);
      cylinder(root, glassColor, [0, 0.257, 0], 0.043, 0.13, 9, 0.038, 0.048);
      cylinder(root, mats.glassEdge, [0, 0.102, 0], 0.143, 0.050, 10, 0.145, 0.15);
      ring(0.497, 0.165, 0.013);
      fillBase = 0.275; maxHeight = 0.165; liquidRadius = 0.135;
    } else {
      sphere(root, glassColor, [0, 0.285, 0], [0.192, 0.245, 0.175]);
      cylinder(root, glassColor, [0, 0.485, 0], 0.089, 0.15, 10, 0.078, 0.105);
      ring(0.556, 0.083, 0.014);
      cylinder(root, mats.brass, [0, 0.112, 0], 0.153, 0.035, 10, 0.16, 0.16);
      fillBase = 0.105; maxHeight = 0.285; liquidRadius = 0.132;
      for (let b = 0; b < 4; b++) {
        const bubble = sphere(root, mats.cream, [((b % 2) - 0.5) * 0.10, 0.18 + b * 0.067, 0.13], [0.022, 0.022, 0.012], littleSphereGeo);
        bubble.material = new THREE.MeshStandardMaterial({ color: 0xc5ffe9, emissive: 0x4effd1, emissiveIntensity: 0.75, transparent: true, opacity: 0.82 });
        bubble.userData.index = b;
        root.userData.bubbles = root.userData.bubbles || [];
        root.userData.bubbles.push(bubble);
      }
    }
    // Two tiny white glints make the glass read even in the candle haze.
    for (const y of [0.25, 0.36]) {
      const glint = box(root, mats.cream, [-0.10, y, 0.15], [0.018, 0.072, 0.009], [0, 0, 0.15]);
      glint.material = new THREE.MeshBasicMaterial({ color: 0xeaffef, transparent: true, opacity: 0.56 });
    }
    const liquid = mesh(contents, new THREE.CylinderGeometry(1, 1, 1, 12), liquidMats[index], [0, fillBase + maxHeight * 0.5, 0], [liquidRadius, maxHeight, liquidRadius]);
    liquid.material.side = THREE.DoubleSide;
    drinks.push({ root, contents, liquid, fillBase, maxHeight, liquidRadius, amount: 1, risk: 0, index });
  }
  createDrink(0, -0.55);
  createDrink(1, 0);
  createDrink(2, 0.55);

  const impactWindow = 0.78;
  const warningLead = 1.32;
  const roundDuration = 45.5;
  const eventDescriptions = [
    { name: 'ROLLING KEG!', type: 0, setup: 'INCOMING, INCOMING!', wait: 'Wait for the thump… now!', side: -1, pitch: 1 },
    { name: 'THE BARDIC DUEL!', type: 1, setup: 'TWO SWORDS, NO BALANCE.', wait: 'Wait for the thump… now!', side: 1, pitch: -1 },
    { name: 'SQUEAKING PLANK!', type: 2, setup: 'THE FLOOR HAS OPINIONS.', wait: 'Wait for the thump… now!', side: -1, pitch: -1 },
    { name: 'SWINGING ROAST!', type: 3, setup: 'FRESH OUT OF THE RAFTER.', wait: 'Wait for the thump… now!', side: 1, pitch: 1 },
    { name: 'ROLLING KEG!', type: 0, setup: 'THE BARREL KNOWS YOUR NAME.', wait: 'Wait for the thump… now!', side: 1, pitch: -1 },
    { name: 'THE BARDIC DUEL!', type: 1, setup: 'THEY HAVE FOUND A FIDDLE.', wait: 'Wait for the thump… now!', side: -1, pitch: 1 },
    { name: 'SQUEAKING PLANK!', type: 2, setup: 'SOMEONE SPILLED ON THE FLOOR.', wait: 'Wait for the thump… now!', side: 1, pitch: 1 },
    { name: 'SWINGING ROAST!', type: 3, setup: 'A VERY LOW-FLYING SUPPER.', wait: 'Wait for the thump… now!', side: -1, pitch: -1 }
  ];
  const eventTimes = [3.55, 8.88, 14.21, 19.54, 24.87, 30.20, 35.53, 40.86];
  let events = [];
  let pipNodes = [];
  for (let i = 0; i < 8; i++) {
    const pip = document.createElement('i');
    pip.className = 'route-pip';
    $('route-pips').appendChild(pip);
    pipNodes.push(pip);
  }
  function newRunEvents() {
    return eventDescriptions.map((def, i) => ({ ...def, time: eventTimes[i], index: i, force: 1.47 + i * 0.105, started: false, resolved: false, quality: 0, outcome: '', initialHold: false }));
  }
  events = newRunEvents();

  const splashParticles = [];
  function emitParticles(x, y, z, amount, good = false, side = 0) {
    const count = good ? 9 : 7;
    for (let i = 0; i < count; i++) {
      const material = good ? sparkleMats[i % sparkleMats.length] : liquidMats[amount.index];
      const bit = mesh(trayRoot, sparkGeo, material, [x, y, z], [1, 1, 1]);
      const spread = good ? 0.7 : 1.0;
      const size = good ? rand(0.022, 0.048) : rand(0.026, 0.057);
      bit.scale.setScalar(size);
      splashParticles.push({
        mesh: bit,
        vx: (Math.random() - 0.5) * spread * 2 + side * 0.28,
        vy: good ? rand(0.55, 1.6) : rand(0.4, 1.8),
        vz: (Math.random() - 0.5) * 0.72,
        life: good ? rand(0.35, 0.67) : rand(0.34, 0.58),
        maxLife: good ? 0.67 : 0.58,
        size
      });
    }
  }
  const sfxBrace = new Audio('./assets/generate_sfx-1.mp3');
  const sfxSpill = new Audio('./assets/generate_sfx-2.mp3');
  const music = new Audio('./assets/generate_music-1.mp3');
  music.loop = true;
  music.volume = 0.23;
  sfxBrace.volume = 0.54;
  sfxSpill.volume = 0.46;
  let soundEnabled = true;
  let audioStarted = false;
  function playSfx(audio, volume) {
    if (!soundEnabled) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const play = audio.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    } catch (_) { /* Local audio can be unavailable in a quiet browser profile. */ }
  }
  function beginAudio() {
    if (!soundEnabled || audioStarted) return;
    audioStarted = true;
    try {
      const promise = music.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => { audioStarted = false; });
    } catch (_) { audioStarted = false; }
  }

  let state = 'title';
  let gameTime = 0;
  let worldTime = 0;
  let grip = 0;
  let tipScore = 0;
  let combo = 0;
  let roll = 0;
  let pitch = 0;
  let rollVel = 0;
  let pitchVel = 0;
  let cameraJolt = 0;
  let previousHeld = false;
  let pointerIds = new Set();
  let spaceHeld = false;
  let cueMode = '';
  let runSpillCount = 0;
  let lastHudStamp = -1;
  let runStartedAt = 0;
  let exitVisible = false;
  let bestPour = 0;
  try { bestPour = Number(localStorage.getItem('holdYourAleBest') || 0) || 0; } catch (_) { bestPour = 0; }

  const holdIsDown = () => spaceHeld || pointerIds.size > 0;
  function updateDrinkVisual(drink) {
    const amount = clamp(drink.amount, 0, 1);
    const h = Math.max(0.001, drink.maxHeight * amount);
    drink.liquid.position.y = drink.fillBase + h * 0.5;
    drink.liquid.scale.set(drink.liquidRadius, h, drink.liquidRadius);
    drink.contents.quaternion.copy(trayRoot.quaternion).invert();
    const bubbles = drink.root.userData.bubbles || [];
    for (const [i, bubble] of bubbles.entries()) {
      const y = 0.17 + i * 0.067 + Math.sin(worldTime * 2.4 + i * 1.7) * 0.025;
      bubble.visible = drink.amount > 0.11 && y < drink.fillBase + drink.maxHeight * amount + 0.03;
      bubble.position.y = y;
    }
  }
  function updateHud() {
    $('route-fill').style.width = `${clamp(gameTime / roundDuration, 0, 1) * 100}%`;
    const done = events.filter(e => e.resolved).length;
    $('route-count').textContent = `${done} / 8 THUMPS`;
    $('tip-count').innerHTML = `${Math.floor(tipScore)} <small>cp</small>`;
    pipNodes.forEach((node, i) => {
      node.classList.toggle('done', events[i].resolved && events[i].quality >= 0.48);
      node.classList.toggle('spill', events[i].resolved && events[i].quality < 0.48);
    });
    const minis = $('drink-readout').querySelectorAll('.mini-pour');
    drinks.forEach((drink, i) => {
      minis[i].classList.toggle('empty', drink.amount <= 0.02);
      minis[i].querySelector('i').style.height = `${Math.max(0, drink.amount) * 78}%`;
      minis[i].setAttribute('aria-label', `${Math.round(drink.amount * 100)} percent of drink ${i + 1} remains`);
    });
    const tired = grip > 0.68;
    gripHud.classList.toggle('tired', tired);
    $('grip-fill').style.width = `${grip * 100}%`;
    $('grip-word').textContent = grip < 0.20 ? 'RESTED' : grip < 0.48 ? 'WARMING' : grip < 0.76 ? 'TIRED' : 'NEED A BREATHER';
    bracePrompt.classList.toggle('bracing', holdIsDown());
  }
  function setCue(mode, kicker, title, copy) {
    if (cueMode === mode && cueTitle.textContent === title && cueCopy.textContent === copy) return;
    cueMode = mode;
    eventCue.className = `event-cue active ${mode}`;
    cueKicker.textContent = kicker;
    cueTitle.textContent = title;
    cueCopy.textContent = copy;
  }
  function hideCue() {
    if (!cueMode && !eventCue.classList.contains('active')) return;
    cueMode = '';
    eventCue.className = 'event-cue';
  }

  function spillDrink(index, loss, side) {
    const drink = drinks[index];
    if (!drink || drink.amount <= 0.005) return;
    const old = drink.amount;
    drink.amount = Math.max(0, drink.amount - loss);
    const y = 0.10 + drink.fillBase + drink.maxHeight * old;
    emitParticles(drink.root.position.x, y, 0.10, drink, false, side);
    runSpillCount++;
    playSfx(sfxSpill, 0.38);
    updateDrinkVisual(drink);
  }
  function celebrateBrace() {
    emitParticles(0, 0.54, 0.02, drinks[0], true, 0);
    emitParticles(-0.43, 0.46, 0.03, drinks[1], true, -1);
  }
  function gripQuality() {
    return clamp(1 - grip * 0.94, 0.08, 1);
  }
  function registerLateBrace(event) {
    if (!event || event.resolved || !event.started) return;
    const elapsed = clamp((gameTime - event.time) / impactWindow, 0, 1);
    const timing = 1 - elapsed * 0.31;
    const quality = gripQuality() * timing;
    if (quality > event.quality) event.quality = quality;
    event.initialHold = true;
    rollVel *= 0.48;
    pitchVel *= 0.48;
    cameraJolt = Math.max(cameraJolt, 0.052);
    emitParticles(0, 0.42, 0.03, drinks[0], true, event.side);
  }
  function finishEvent(event) {
    if (event.resolved) return;
    event.resolved = true;
    const q = event.quality;
    if (q >= 0.72) {
      combo++;
      tipScore += 7 + Math.min(combo, 5) * 2;
      event.outcome = 'clean';
      playSfx(sfxBrace, 0.50);
      celebrateBrace();
    } else if (q >= 0.46) {
      combo = 0;
      tipScore += 2;
      event.outcome = 'partial';
      spillDrink((event.index + 1) % 3, 0.075, event.side);
    } else {
      combo = 0;
      event.outcome = 'spill';
      const target = (event.index * 2 + 1) % 3;
      spillDrink(target, 0.19 + event.index * 0.006, event.side);
    }
    const pip = pipNodes[event.index];
    pip.classList.add(event.quality >= 0.48 ? 'done' : 'spill');
    updateHud();
  }
  function beginImpact(event) {
    event.started = true;
    event.initialHold = holdIsDown();
    if (event.initialHold) event.quality = gripQuality();
    const brace = event.initialHold ? event.quality : 0;
    const force = event.force * (1 - brace * 0.75);
    rollVel += event.side * force;
    pitchVel += event.pitch * force * 0.48;
    cameraJolt = Math.max(cameraJolt, event.initialHold ? 0.044 : 0.135);
    if (event.initialHold) emitParticles(0.12 * event.side, 0.38, 0.06, drinks[0], true, event.side);
  }

  function resetSceneCues() {
    hideCue();
    hazardKeg.visible = false;
    hazardDancer.visible = false;
    floorHazard.visible = false;
    roastPivot.visible = false;
  }
  function startGame() {
    if (state === 'playing') return;
    state = 'playing';
    gameTime = 0;
    grip = 0;
    tipScore = 0;
    combo = 0;
    runSpillCount = 0;
    roll = 0; pitch = 0; rollVel = 0; pitchVel = 0;
    cameraJolt = 0;
    previousHeld = false;
    pointerIds.clear();
    spaceHeld = false;
    events = newRunEvents();
    drinks.forEach(d => { d.amount = 1; d.risk = 0; updateDrinkVisual(d); });
    pipNodes.forEach(n => n.className = 'route-pip');
    $('route-fill').style.width = '0%';
    $('route-count').textContent = '0 / 8 THUMPS';
    $('tip-count').innerHTML = '0 <small>cp</small>';
    $('grip-fill').style.width = '0%';
    $('grip-word').textContent = 'RESTED';
    $('result-screen').classList.add('hidden');
    titleScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    gripHud.classList.remove('hidden');
    bracePrompt.classList.remove('hidden');
    resetSceneCues();
    exitVisible = false;
    exitGroup.visible = false;
    runStartedAt = performance.now();
    beginAudio();
    updateHud();
  }

  function endGame(emptied = false) {
    if (state !== 'playing') return;
    state = 'result';
    spaceHeld = false;
    pointerIds.clear();
    hud.classList.add('hidden');
    gripHud.classList.add('hidden');
    bracePrompt.classList.add('hidden');
    resetSceneCues();
    const average = drinks.reduce((sum, d) => sum + d.amount, 0) / drinks.length;
    const percent = Math.round(average * 100);
    let medal = 'F';
    let title = 'THE FLOOR WAS THIRSTY.';
    let copy = 'The mop would like to discuss your technique.';
    let kicker = 'DELIVERY ACCEPTED (MOSTLY)';
    if (average >= 0.96) { medal = 'A+'; title = 'THREE INTACT. HOW?'; copy = 'The Goosekeeper has started a rumor about you.'; kicker = 'A LEGENDARY DELIVERY'; }
    else if (average >= 0.84) { medal = 'A'; title = 'A NEAR-PERFECT POUR.'; copy = 'One little drip. The floor will recover.'; kicker = 'DELIVERY ACCEPTED'; }
    else if (average >= 0.64) { medal = 'B'; title = 'THE LANDLORD APPROVES.'; copy = 'Most of it is in the glasses. The important part.'; kicker = 'DELIVERY ACCEPTED'; }
    else if (average >= 0.40) { medal = 'C'; title = 'MOSTLY STILL IN THE GLASS.'; copy = 'You are invited back. The tray is not.'; kicker = 'DELIVERY ACCEPTED (ISH)'; }
    else if (average >= 0.16) { medal = 'D'; title = 'A VERY WET ARRIVAL.'; copy = 'Somehow, the three guests are still smiling.'; kicker = 'THE MOP GETS A TIP'; }
    if (emptied) { medal = 'F'; title = 'THREE PINTS. ONE FLOOR.'; copy = 'The band has changed its last song to a mop waltz.'; kicker = 'AN EXPENSIVE SHORTCUT'; }
    $('result-kicker').innerHTML = `<span>✦</span> ${kicker} <span>✦</span>`;
    $('result-medal').textContent = medal;
    $('result-title').textContent = title;
    $('result-copy').textContent = copy;
    $('result-tip').innerHTML = `${Math.floor(tipScore)} <small>copper</small>`;
    drinks.forEach((drink, i) => { $(`result-fill-${i}`).style.height = `${Math.max(0, drink.amount) * 100}%`; });
    if (percent > bestPour) {
      bestPour = percent;
      try { localStorage.setItem('holdYourAleBest', String(bestPour)); } catch (_) { /* best-effort local score */ }
    }
    $('best-line').textContent = `BEST SHIFT · ${bestPour}%`;
    resultScreen.classList.remove('hidden');
  }

  function updateCue() {
    if (state !== 'playing') { hideCue(); return; }
    const active = events.find(e => e.started && !e.resolved && gameTime <= e.time + impactWindow);
    if (active) {
      setCue('impact', 'RIGHT THIS INSTANT', 'THUMP! BRACE!', 'Hold Space or the screen. Let go when the tray settles.');
      return;
    }
    const after = [...events].reverse().find(e => e.resolved && gameTime < e.time + impactWindow + 1.15);
    if (after) {
      if (after.outcome === 'clean') setCue('good', 'BEAUTIFULLY DONE', 'A CLEAN CATCH!', 'That one stays in the glass. Rest those arms.');
      else if (after.outcome === 'partial') setCue('good', 'CLOSE SHAVE', 'A NOBLE SAVE!', 'A little slosh. You can still turn this around.');
      else setCue('spill', 'THE FLOOR SAYS THANKS', 'DOWN THE APRON!', 'Give your arms a rest before the next one.');
      return;
    }
    const next = events.find(e => !e.started && gameTime >= e.time - warningLead);
    if (next) {
      setCue('incoming', next.setup, next.name, 'Let it get close. The brace is only for the THUMP.');
      return;
    }
    hideCue();
  }

  const clock = new THREE.Clock();
  let lastFrame = performance.now();
  let activeEventIndex = -1;
  function updateGame(dt, held, justPressed) {
    if (state !== 'playing') return;
    gameTime += dt;
    grip = clamp(grip + (held ? 0.64 : -0.72) * dt, 0, 1);
    for (const event of events) {
      if (!event.started && gameTime >= event.time) beginImpact(event);
      if (justPressed && event.started && !event.resolved && gameTime <= event.time + impactWindow) registerLateBrace(event);
      if (event.started && !event.resolved && gameTime >= event.time + impactWindow) finishEvent(event);
    }
    if (gameTime > roundDuration - 5 && !exitVisible) {
      exitVisible = true;
      exitGroup.visible = true;
    }
    if (exitVisible) {
      const approach = clamp((gameTime - (roundDuration - 5)) / 5, 0, 1);
      exitGroup.position.set(0, 0, -23 + approach * 17.5);
      exitLight.intensity = 0.25 + approach * 3.5;
    }
    updateCue();
    const allEmpty = drinks.every(d => d.amount <= 0.008);
    if (allEmpty) { endGame(true); return; }
    if (gameTime >= roundDuration) { gameTime = roundDuration; endGame(false); }
  }

  function updateHazards() {
    const e = state === 'playing' ? events.find(event => gameTime >= event.time - warningLead && gameTime <= event.time + impactWindow + 0.15) : null;
    hazardKeg.visible = !!e && e.type === 0;
    hazardDancer.visible = !!e && e.type === 1;
    floorHazard.visible = !!e && e.type === 2;
    roastPivot.visible = !!e && e.type === 3;
    if (!e) return;
    const t0 = e.time - warningLead;
    const p = clamp((gameTime - t0) / (warningLead + impactWindow + 0.12), 0, 1);
    const ease = p * p * (3 - 2 * p);
    if (e.type === 0) {
      hazardKeg.position.set(-4.7 + ease * 7.4, 0, -8.2 + ease * 4.1);
      hazardKeg.rotation.set(0.10, 0.12 * Math.sin(worldTime * 3), p * 5.3);
      hazardKeg.scale.setScalar(0.86 + ease * 0.24);
    } else if (e.type === 1) {
      hazardDancer.position.set(Math.sin(p * Math.PI * 2.4) * 0.88, Math.abs(Math.sin(worldTime * 6.5)) * 0.20, -8.1 + ease * 3.8);
      hazardDancer.rotation.y = Math.sin(worldTime * 3.3) * 0.44;
      dancerData.arms[0].rotation.z = Math.sin(worldTime * 8) * 0.62 - 0.12;
      dancerData.arms[1].rotation.z = -Math.sin(worldTime * 8 + 0.7) * 0.65 + 0.12;
    } else if (e.type === 2) {
      floorHazard.position.set(0, 0, -7.8 + ease * 3.8);
      puddle.scale.set(1.15 + Math.sin(worldTime * 5) * 0.10, 0.51 + Math.sin(worldTime * 4) * 0.07, 1);
      puddleMaterial.opacity = 0.66 + 0.16 * (0.5 + 0.5 * Math.sin(worldTime * 6));
      puddleRing.scale.setScalar(0.85 + 0.18 * Math.sin(worldTime * 4.1));
    } else {
      roastPivot.position.set(0, 4.03, -7.7 + ease * 3.2);
      roastPivot.rotation.z = Math.sin(p * Math.PI * 3.1) * 0.58;
      roastPivot.rotation.x = Math.sin(worldTime * 4.4) * 0.12;
    }
  }

  function updateParticles(dt) {
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.life -= dt;
      p.vy -= 3.9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const f = clamp(p.life / p.maxLife, 0, 1);
      p.mesh.scale.setScalar(p.size * (0.50 + f * 0.72));
      if (p.life <= 0) {
        trayRoot.remove(p.mesh);
        splashParticles.splice(i, 1);
      }
    }
  }

  function updateTray(dt, held) {
    const stiffness = held ? 15.5 : 11.2;
    const damping = held ? 6.1 : 4.1;
    rollVel += (-roll * stiffness - rollVel * damping + (state === 'playing' ? Math.sin(gameTime * 2.2) * 0.022 : Math.sin(worldTime * 0.9) * 0.025)) * dt;
    pitchVel += (-pitch * stiffness - pitchVel * damping + (state === 'playing' ? Math.sin(gameTime * 1.7 + 1.2) * 0.016 : Math.cos(worldTime * 0.75) * 0.016)) * dt;
    roll += rollVel * dt;
    pitch += pitchVel * dt;
    if (Math.abs(roll) > 0.78) { roll = Math.sign(roll) * 0.78; rollVel *= -0.24; }
    if (Math.abs(pitch) > 0.62) { pitch = Math.sign(pitch) * 0.62; pitchVel *= -0.22; }

    const aspect = camera.aspect || 1;
    const trayDepth = 1.72 + Math.max(0, 1.02 - aspect) * 0.72;
    const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * trayDepth * aspect;
    const trayScale = clamp(visibleWidth / 1.82 * 0.93, 0.43, 1);
    trayRoot.scale.setScalar(trayScale);
    trayRoot.position.set(0, -0.55, -trayDepth);
    trayRoot.rotation.order = 'XYZ';
    trayRoot.rotation.set(-0.04 + pitch, 0, roll);
    const bob = Math.sin(worldTime * 3.15) * 0.008;
    trayRoot.position.y += bob;
    cameraJolt = Math.max(0, cameraJolt - dt * 0.95);
    camera.position.x = Math.sin(worldTime * 54) * cameraJolt * 0.24;
    camera.position.y = 1.62 + Math.sin(worldTime * 2.9) * 0.012 + Math.sin(worldTime * 46) * cameraJolt * 0.34;
    camera.rotation.z = Math.sin(worldTime * 39) * cameraJolt * 0.016;

    // Liquid tries to stay level in the glasses. The clear bowls lean with the board; the pour doesn't.
    for (const drink of drinks) {
      updateDrinkVisual(drink);
      const xSide = Math.sign(drink.root.position.x);
      const cupTip = Math.abs(pitch * 0.74 + roll * xSide * 0.34) + Math.abs(roll) * 0.20 + (Math.abs(rollVel) + Math.abs(pitchVel)) * 0.038;
      if (cupTip > 0.295 && drink.amount > 0.03) {
        drink.risk += (cupTip - 0.295) * dt * 1.12;
        if (drink.risk > 0.42) {
          drink.risk = 0;
          spillDrink(drink.index, 0.035, xSide || 1);
        }
      } else {
        drink.risk = Math.max(0, drink.risk - dt * 0.32);
      }
    }
    updateParticles(dt);
  }

  function updateEnvironment(dt) {
    const speed = state === 'playing' ? 1.12 + Math.min(gameTime / roundDuration, 1) * 0.50 : 0.26;
    for (const section of sections) {
      section.position.z += speed * dt;
      if (section.position.z > 6.8) section.position.z -= 50;
    }
    for (const seam of floorSeams) {
      seam.position.z += speed * dt;
      if (seam.position.z > 6.3) seam.position.z -= 55.5;
    }
    for (const patron of patrons) {
      const phase = worldTime * patron.lively + patron.phase;
      patron.root.position.y = Math.sin(phase * 1.8) * 0.024;
      patron.body.rotation.z = Math.sin(phase * 1.15) * 0.035;
      patron.body.rotation.x = Math.sin(phase * 0.82 + 0.9) * 0.022;
      patron.arms[0].rotation.z = Math.sin(phase * 1.45) * 0.28 - 0.12;
      patron.arms[1].rotation.z = Math.cos(phase * 1.22 + 0.6) * 0.26 + 0.11;
    }
    for (const lamp of lanterns) {
      const flicker = 0.94 + Math.sin(worldTime * 4.8 + lamp.phase) * 0.035 + Math.sin(worldTime * 13 + lamp.phase * 2) * 0.018;
      lamp.glow.material.emissiveIntensity = 1.55 * flicker;
      if (lamp.light) lamp.light.intensity = lamp.power * flicker;
    }
    updateHazards();
  }

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  $('start-button').addEventListener('click', startGame);
  $('again-button').addEventListener('click', startGame);
  $('sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('sound-toggle').textContent = soundEnabled ? '♫' : '♪';
    $('sound-toggle').setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Turn sound on');
    $('sound-toggle').title = soundEnabled ? 'Mute sound' : 'Turn sound on';
    music.muted = !soundEnabled;
    sfxBrace.muted = !soundEnabled;
    sfxSpill.muted = !soundEnabled;
    if (soundEnabled) beginAudio();
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
    if (event.target && event.target.closest && event.target.closest('button')) return;
    if (state === 'title' || state === 'result') {
      startGame();
      return;
    }
    if (state === 'playing') {
      pointerIds.add(event.pointerId);
      if (event.cancelable) event.preventDefault();
    }
  }, { passive: false });
  const releasePointer = (event) => { if (event && event.pointerId !== undefined) pointerIds.delete(event.pointerId); };
  window.addEventListener('pointerup', releasePointer, { passive: true });
  window.addEventListener('pointercancel', releasePointer, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat) return;
    if (state === 'title' || state === 'result') {
      startGame();
      return;
    }
    if (state === 'playing') spaceHeld = true;
  });
  window.addEventListener('keyup', (event) => { if (event.code === 'Space') { event.preventDefault(); spaceHeld = false; } });
  window.addEventListener('blur', () => { spaceHeld = false; pointerIds.clear(); });
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    worldTime += dt;
    const held = holdIsDown();
    const justPressed = held && !previousHeld;
    updateGame(dt, held, justPressed);
    updateEnvironment(dt);
    updateTray(dt, held);
    if (state === 'playing') {
      // HUD work is deliberately throttled; the simulated tray still updates every frame.
      const stamp = Math.floor(gameTime * 12);
      if (stamp !== lastHudStamp) { lastHudStamp = stamp; updateHud(); }
    }
    renderer.render(scene, camera);
    previousHeld = held;
  }
  requestAnimationFrame(frame);
})();
