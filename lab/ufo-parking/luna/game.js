(() => {
  'use strict';

  const THREE = window.THREE;
  const canvas = document.getElementById('scene');
  const gameEl = document.getElementById('game');
  const clockEl = document.getElementById('clock');
  const timeFillEl = document.getElementById('time-fill');
  const dockCountEl = document.getElementById('dock-count');
  const scoreEl = document.getElementById('score');
  const vectorEl = document.getElementById('vector-readout');
  const lockFillEl = document.getElementById('lock-fill');
  const beamStateEl = document.getElementById('beam-state');
  const altitudeEl = document.getElementById('altitude');
  const toastEl = document.getElementById('toast');
  const introEl = document.getElementById('intro-screen');
  const resultEl = document.getElementById('result-screen');
  const liftButton = document.getElementById('lift-button');
  const buttonLabel = document.getElementById('button-label');
  const buttonHint = document.getElementById('button-hint');

  if (!THREE) {
    toastEl.textContent = 'THREE.JS COULD NOT START — PLEASE RELOAD';
    toastEl.classList.add('visible', 'warning');
    return;
  }

  const ROUND_LENGTH = 45;
  const CONTACT_Y = 0.18;
  const VIEW_HEIGHT = 14.2;
  const padXs = [-6, -3, 0, 3, 6];
  const route = [3, 0, 4, 1, 3, 2, 0, 4, 1, 3, 0, 2, 4, 1, 0, 3, 2, 4];
  let phase = 'ready';
  let held = false;
  let timeLeft = ROUND_LENGTH;
  let totalDocked = 0;
  let totalScore = 0;
  let streak = 0;
  let misses = 0;
  let targetIndex = route[0];
  let pauseLeft = 0;
  let gameTime = 0;
  let toastUntil = 0;
  let toastWarning = false;
  let playerX = 0;
  let playerY = 4.7;
  let velocityX = 0;
  let velocityY = 0;
  let sceneScaleX = 1;
  let previousFrame = performance.now();
  let displayClock = '';
  let displayScore = '';
  let displayDocked = '';
  let lastHudUpdate = 0;
  let audioContext = null;
  let engineGain = null;
  let engineOsc = null;
  const clamp = THREE.MathUtils.clamp;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08131f);
  const camera = new THREE.OrthographicCamera(-10, 10, 7.1, -7.1, 0.1, 100);
  camera.position.set(0, 11.2, 27);
  camera.lookAt(0, 4.05, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.HemisphereLight(0x9bcbd2, 0x111b28, 1.45));
  const keyLight = new THREE.DirectionalLight(0xd2f6ef, 2.2);
  keyLight.position.set(-5, 12, 9);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -13;
  keyLight.shadow.camera.right = 13;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);
  const coolFill = new THREE.PointLight(0x60d9e7, 45, 22, 2);
  coolFill.position.set(1, 6, 6);
  scene.add(coolFill);
  const warmFill = new THREE.PointLight(0xffa784, 28, 18, 2);
  warmFill.position.set(-8, 4, -1);
  scene.add(warmFill);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, ...extra });
  const addMesh = (parent, geometry, material, position, castShadow = false, receiveShadow = false) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    return mesh;
  };
  const seeded = (seed) => () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const random = seeded(7441);

  // A deep starfield and distant rust-pink moon establish the tiny orbital world.
  {
    const positions = [];
    const colors = [];
    for (let i = 0; i < 260; i++) {
      positions.push((random() - 0.5) * 42, -1 + random() * 20, -13 - random() * 17);
      const c = new THREE.Color().setHSL(0.46 + random() * 0.14, 0.32 + random() * 0.34, 0.46 + random() * 0.43);
      colors.push(c.r, c.g, c.b);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: 0.075, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.83, depthWrite: false }));
    scene.add(stars);

    const planet = new THREE.Group();
    planet.position.set(-7.8, 8.45, -11.5);
    const globe = addMesh(planet, new THREE.SphereGeometry(1.45, 36, 28), mat(0x653d57, { roughness: 0.94, metalness: 0.08, emissive: 0x35172e, emissiveIntensity: 0.64 }));
    globe.scale.set(1, 0.88, 0.86);
    const blush = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.035, 8, 80), new THREE.MeshBasicMaterial({ color: 0xe693a8, transparent: true, opacity: 0.42 }));
    blush.rotation.set(0.5, -0.24, 0.22);
    planet.add(blush);
    scene.add(planet);
    const orbitDot = addMesh(scene, new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffbb8d }), [-4.4, 9.3, -9.8]);
    orbitDot.material.toneMapped = false;
  }

  // The horizon is an art-directed little orbital depot rather than a blank plane.
  {
    addMesh(world, new THREE.BoxGeometry(34, 0.38, 10), mat(0x101f2b, { metalness: 0.62, roughness: 0.48 }), [0, -0.78, 0.6], true, true);
    addMesh(world, new THREE.BoxGeometry(34, 0.055, 0.12), new THREE.MeshBasicMaterial({ color: 0x286b6d }), [0, -0.57, 4.7]);
    const floorMarks = mat(0x203342, { emissive: 0x10272f, emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.47 });
    for (let i = -8; i <= 8; i++) {
      addMesh(world, new THREE.BoxGeometry(0.04, 0.014, 8.8), floorMarks, [i * 1.95, -0.57, 0.55]);
    }
    for (let i = -15; i <= 15; i++) {
      if (i % 2 === 0) addMesh(world, new THREE.BoxGeometry(1.1, 0.012, 0.04), floorMarks, [i * 1.04, -0.56, 3.55]);
    }

    const buildingDark = [0x112432, 0x142835, 0x172936].map((c) => mat(c, { metalness: 0.38, roughness: 0.69 }));
    const windowMats = [new THREE.MeshBasicMaterial({ color: 0x55c5bb }), new THREE.MeshBasicMaterial({ color: 0xd99474 }), new THREE.MeshBasicMaterial({ color: 0x568da9 })];
    for (let i = 0; i < 17; i++) {
      const width = 0.8 + random() * 1.05;
      const height = 0.8 + random() * 2.5;
      const x = -15.2 + i * 1.9 + (random() - 0.5) * 0.45;
      const z = -5.5 - random() * 1.5;
      const building = addMesh(world, new THREE.BoxGeometry(width, height, 0.8 + random() * 0.5), buildingDark[i % buildingDark.length], [x, -0.52 + height / 2, z], true);
      building.rotation.y = (random() - 0.5) * 0.12;
      const faceZ = z + 0.42;
      const rows = Math.floor(height / 0.48);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 2; col++) {
          if (random() > 0.28) {
            const w = 0.075 + random() * 0.07;
            const pane = addMesh(world, new THREE.BoxGeometry(w, 0.12 + random() * 0.1, 0.025), windowMats[Math.floor(random() * windowMats.length)], [x - width * 0.24 + col * width * 0.46, -0.34 + row * 0.46, faceZ]);
            pane.material.transparent = true;
            pane.material.opacity = 0.48 + random() * 0.35;
          }
        }
      }
    }
  }

  const pads = [];
  const padBaseMaterial = mat(0x223b49, { metalness: 0.7, roughness: 0.37 });
  const padTopMaterial = mat(0x152b37, { metalness: 0.63, roughness: 0.42, emissive: 0x092128, emissiveIntensity: 0.3 });
  const trimInactiveMaterial = new THREE.MeshStandardMaterial({ color: 0x315361, metalness: 0.56, roughness: 0.34, emissive: 0x155563, emissiveIntensity: 0.33 });
  const signalMaterials = [];
  const ringMaterials = [];
  const padGeom = new THREE.CylinderGeometry(1.1, 1.32, 0.32, 40, 1);
  const padTopGeom = new THREE.CylinderGeometry(0.91, 0.98, 0.055, 40, 1);
  const stemGeom = new THREE.CylinderGeometry(0.18, 0.26, 0.56, 16);
  const trimGeom = new THREE.TorusGeometry(1.0, 0.035, 8, 56);
  const signalGeom = new THREE.TorusGeometry(0.67, 0.022, 8, 56);
  const targetGeom = new THREE.TorusGeometry(1.23, 0.025, 8, 64);
  const guideGeom = new THREE.SphereGeometry(0.075, 12, 10);
  const centerGeom = new THREE.CylinderGeometry(0.16, 0.2, 0.026, 24);
  for (let i = 0; i < padXs.length; i++) {
    const group = new THREE.Group();
    group.position.set(padXs[i], 0, 0.35);
    world.add(group);
    const stem = addMesh(group, stemGeom, padBaseMaterial, [0, -0.43, 0], true, true);
    const base = addMesh(group, padGeom, padBaseMaterial, [0, -0.18, 0], true, true);
    const top = addMesh(group, padTopGeom, padTopMaterial, [0, -0.018, 0], false, true);
    const lowerTrim = addMesh(group, trimGeom, trimInactiveMaterial, [0, -0.31, 0]);
    lowerTrim.rotation.x = Math.PI / 2;
    const signalMat = new THREE.MeshStandardMaterial({ color: 0x68efcc, metalness: 0.35, roughness: 0.26, emissive: 0x3aefc3, emissiveIntensity: 0.2 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ceccc, transparent: true, opacity: 0.16, depthWrite: false });
    signalMaterials.push(signalMat);
    ringMaterials.push(ringMat);
    const signal = addMesh(group, signalGeom, signalMat, [0, 0.027, 0]);
    const halo = addMesh(group, targetGeom, ringMat, [0, 0.045, 0]);
    const inner = addMesh(group, centerGeom, signalMat, [0, 0.018, 0]);
    for (let j = 0; j < 6; j++) {
      const angle = j / 6 * Math.PI * 2;
      const marker = addMesh(group, guideGeom, signalMat, [Math.cos(angle) * 0.79, 0.04, Math.sin(angle) * 0.79]);
      marker.scale.set(1.05, 0.52, 1.05);
      const tick = addMesh(group, new THREE.BoxGeometry(0.21, 0.028, 0.055), signalMat, [Math.cos(angle) * 0.98, 0.018, Math.sin(angle) * 0.98]);
      tick.rotation.y = -angle;
    }
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x48eaca, transparent: true, opacity: 0.23, depthWrite: false });
    const beacon = addMesh(group, new THREE.CylinderGeometry(0.012, 0.14, 1.65, 16, 1, true), beaconMaterial, [0, 0.92, 0]);
    beacon.visible = false;
    pads.push({ group, base, top, signal, halo, inner, beacon, signalMaterial: signalMat, ringMaterial: ringMat, flash: 0 });
  }

  // The saucer is all local geometry: a lathed hull, glass canopy, engine halo and tractor beam.
  const ship = new THREE.Group();
  ship.position.set(playerX, playerY, 0.25);
  world.add(ship);
  const saucerPoints = [
    new THREE.Vector2(0.0, -0.13), new THREE.Vector2(0.4, -0.14), new THREE.Vector2(0.84, -0.09),
    new THREE.Vector2(1.18, -0.015), new THREE.Vector2(1.29, 0.04), new THREE.Vector2(1.08, 0.105),
    new THREE.Vector2(0.72, 0.16), new THREE.Vector2(0.38, 0.17), new THREE.Vector2(0, 0.17)
  ];
  const hullMaterial = mat(0xa6c4c9, { metalness: 0.82, roughness: 0.24, emissive: 0x1d3439, emissiveIntensity: 0.28 });
  const hull = addMesh(ship, new THREE.LatheGeometry(saucerPoints, 56), hullMaterial, [0, 0, 0], true, true);
  hull.castShadow = true;
  const rim = addMesh(ship, new THREE.TorusGeometry(0.89, 0.07, 10, 56), mat(0x496c75, { metalness: 0.83, roughness: 0.24, emissive: 0x17454b, emissiveIntensity: 0.45 }), [0, -0.035, 0]);
  rim.rotation.x = Math.PI / 2;
  const domeMaterial = new THREE.MeshPhysicalMaterial({ color: 0x71dbdf, metalness: 0.27, roughness: 0.12, transmission: 0.08, transparent: true, opacity: 0.86, emissive: 0x155966, emissiveIntensity: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const dome = addMesh(ship, new THREE.SphereGeometry(0.63, 36, 22, 0, Math.PI * 2, 0, Math.PI / 2), domeMaterial, [0, 0.105, 0], true);
  dome.scale.set(1.0, 0.9, 0.82);
  const canopyLine = addMesh(ship, new THREE.TorusGeometry(0.625, 0.035, 8, 56), mat(0x438c91, { metalness: 0.7, roughness: 0.2, emissive: 0x36c9c1, emissiveIntensity: 0.58 }), [0, 0.105, 0]);
  canopyLine.rotation.x = Math.PI / 2;
  const engineRing = addMesh(ship, new THREE.TorusGeometry(0.53, 0.043, 8, 48), new THREE.MeshBasicMaterial({ color: 0x77ffdb, transparent: true, opacity: 0.78 }), [0, -0.14, 0]);
  engineRing.rotation.x = Math.PI / 2;
  const engineLens = addMesh(ship, new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshBasicMaterial({ color: 0x70f6d6, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false }), [0, -0.17, 0]);
  engineLens.scale.set(1, 0.22, 0.72);
  const lampColors = [0x71f4cf, 0xffc27f, 0x8dbbff, 0xff9d9b, 0x71f4cf, 0xffc27f, 0x8dbbff, 0xff9d9b];
  const lamps = [];
  for (let i = 0; i < lampColors.length; i++) {
    const a = i / lampColors.length * Math.PI * 2;
    const lampMat = new THREE.MeshBasicMaterial({ color: lampColors[i] });
    const lamp = addMesh(ship, new THREE.SphereGeometry(0.073, 12, 10), lampMat, [Math.cos(a) * 1.09, 0.035, Math.sin(a) * 0.87]);
    lamp.material.toneMapped = false;
    lamps.push(lamp);
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x55ebd5, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = addMesh(ship, new THREE.CylinderGeometry(0.035, 0.86, 1, 24, 1, true), beamMat, [0, -0.2, 0.12]);
  const beamFootMat = new THREE.MeshBasicMaterial({ color: 0x80ffe2, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamFoot = addMesh(ship, new THREE.TorusGeometry(0.72, 0.028, 8, 40), beamFootMat, [0, -0.5, 0.12]);
  beamFoot.rotation.x = Math.PI / 2;
  const shipLight = new THREE.PointLight(0x63f1d2, 1.3, 5, 2);
  shipLight.position.set(0, -0.2, 0.3);
  ship.add(shipLight);

  // A tiny, allocation-free particle pool makes touchdowns and near-misses pop.
  const particleCount = 92;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particleVels = Array.from({ length: particleCount }, () => new THREE.Vector3());
  const particleLife = new Float32Array(particleCount);
  const particleLifeMax = new Float32Array(particleCount);
  const particleBaseColors = Array.from({ length: particleCount }, () => new THREE.Color(0x73f4d0));
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3 + 1] = -100;
    particleColors[i * 3] = 0;
    particleColors[i * 3 + 1] = 0;
    particleColors[i * 3 + 2] = 0;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  const particleCloud = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ size: 0.15, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending }));
  particleCloud.frustumCulled = false;
  world.add(particleCloud);
  let particleCursor = 0;

  function emitBurst(x, y, amount, warm = false) {
    for (let n = 0; n < amount; n++) {
      const i = particleCursor++ % particleCount;
      const angle = random() * Math.PI * 2;
      const speed = 1.05 + random() * (warm ? 2.2 : 3.15);
      particleVels[i].set(Math.cos(angle) * speed, (0.35 + random() * 2.8) * (random() > 0.58 ? 1 : -0.2), (random() - 0.5) * 1.1);
      particleLifeMax[i] = 0.42 + random() * 0.5;
      particleLife[i] = particleLifeMax[i];
      particlePositions[i * 3] = x + (random() - 0.5) * 0.55;
      particlePositions[i * 3 + 1] = y + (random() - 0.5) * 0.25;
      particlePositions[i * 3 + 2] = 0.45 + (random() - 0.5) * 0.6;
      const color = particleBaseColors[i];
      color.setHex(warm ? (random() > 0.45 ? 0xffb078 : 0xffdf9d) : (random() > 0.48 ? 0x73f4d0 : 0xa2caff));
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      try {
        audioContext = new AudioCtor();
        engineOsc = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        engineGain = audioContext.createGain();
        filter.type = 'lowpass';
        filter.frequency.value = 360;
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 71;
        engineGain.gain.value = 0;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(audioContext.destination);
        engineOsc.start();
      } catch (_) { audioContext = null; }
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  }

  function setEngine() {
    if (engineGain && audioContext) {
      engineGain.gain.cancelScheduledValues(audioContext.currentTime);
      engineGain.gain.setTargetAtTime(phase === 'playing' && held ? 0.025 : 0.001, audioContext.currentTime, 0.09);
    }
  }

  function chirp(frequency, duration = 0.13, type = 'sine', volume = 0.07, glide = 1.35) {
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * glide), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch (_) { /* Audio is a tiny optional flourish. */ }
  }

  function showToast(text, duration = 1.25, warning = false) {
    toastEl.textContent = text;
    toastWarning = warning;
    toastEl.classList.toggle('warning', warning);
    toastEl.classList.add('visible');
    toastUntil = gameTime + duration;
  }

  function setHeld(value) {
    const next = Boolean(value && phase === 'playing');
    if (next === held) return;
    held = next;
    liftButton.classList.toggle('pressed', held);
    liftButton.setAttribute('aria-pressed', String(held));
    if (phase === 'playing') {
      beamStateEl.textContent = held ? 'BEAM ENGAGED' : 'COASTING IN';
      buttonLabel.textContent = held ? 'BEAM ENGAGED' : 'HOLD TO LIFT';
      buttonHint.textContent = held ? 'ALIGNING YOUR DOCK VECTOR' : 'RELEASE TO DRIFT DOWN';
    }
    setEngine();
  }

  function updatePads(dt) {
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const active = i === targetIndex && phase === 'playing';
      const t = gameTime * 2.2 + i * 0.83;
      pad.signal.rotation.y += dt * (active ? 0.85 : 0.24);
      pad.signal.scale.setScalar(active ? 1 + Math.sin(t) * 0.07 : 0.94);
      pad.halo.rotation.y -= dt * (active ? 0.18 : 0.06);
      pad.flash = Math.max(0, pad.flash - dt * 1.9);
      pad.signalMaterial.emissiveIntensity = active ? 1.15 + (Math.sin(t) + 1) * 0.34 + pad.flash * 1.6 : 0.18 + pad.flash;
      pad.signalMaterial.color.setHex(active ? 0x79ffda : 0x456473);
      pad.ringMaterial.opacity = active ? 0.22 + (Math.sin(t) + 1) * 0.12 : 0.045;
      pad.beacon.visible = active;
      if (active) {
        pad.beacon.material.opacity = 0.075 + (Math.sin(t * 1.7) + 1) * 0.025;
        pad.beacon.scale.y = 0.84 + (Math.sin(t * 1.7) + 1) * 0.08;
      }
      pad.top.material = padTopMaterial;
    }
  }

  function setTarget(index) {
    targetIndex = ((index % padXs.length) + padXs.length) % padXs.length;
  }

  function startRun() {
    if (phase === 'playing') return;
    ensureAudio();
    phase = 'playing';
    held = false;
    timeLeft = ROUND_LENGTH;
    totalDocked = 0;
    totalScore = 0;
    streak = 0;
    misses = 0;
    pauseLeft = 0;
    targetIndex = route[0];
    playerX = 0;
    playerY = 4.7;
    velocityX = 0;
    velocityY = 0;
    ship.position.set(playerX, playerY, 0.25);
    introEl.hidden = true;
    resultEl.hidden = true;
    dockCountEl.textContent = '00';
    scoreEl.textContent = '0000';
    clockEl.textContent = '00:45';
    timeFillEl.style.transform = 'scaleX(1)';
    beamStateEl.textContent = 'BEAM ENGAGED';
    altitudeEl.textContent = '4.7';
    buttonLabel.textContent = 'BEAM ENGAGED';
    buttonHint.textContent = 'ALIGNING YOUR DOCK VECTOR';
    liftButton.focus({ preventScroll: true });
    held = true;
    liftButton.classList.add('pressed');
    liftButton.setAttribute('aria-pressed', 'true');
    setEngine();
    chirp(460, 0.22, 'sine', 0.055, 1.55);
    showToast('FLIGHT WINDOW OPEN · FIND THE GLOWING DOCK', 2.4);
  }

  function land() {
    const absXSpeed = Math.abs(velocityX);
    const soft = velocityY > -3.35 && absXSpeed < 0.72;
    const base = soft ? 150 : 90;
    const bonus = Math.min(Math.max(0, streak) * 25, 125);
    const earned = base + bonus;
    totalDocked++;
    streak++;
    totalScore += earned;
    playerY = CONTACT_Y;
    velocityX = 0;
    velocityY = 0;
    pauseLeft = 0.8;
    pads[targetIndex].flash = 1;
    emitBurst(playerX, 0.34, 34, false);
    const oldTarget = targetIndex;
    setTarget(route[totalDocked % route.length]);
    const line = soft ? (streak > 1 ? `SILKY DOCK · ${earned} PTS · STREAK ×${streak}` : `SILKY DOCK · ${earned} POINTS`) : `DOCKED! · ${earned} POINTS · STEADY ON THE NEXT ONE`;
    showToast(line, 1.65);
    chirp(soft ? 610 : 490, 0.25, 'sine', 0.085, 1.58);
    if (soft) window.setTimeout(() => chirp(880, 0.19, 'sine', 0.045, 1.12), 105);
    if (navigator.vibrate) navigator.vibrate(soft ? [18, 28, 38] : 18);
    updateHud(true);
    // Make sure the old landing pad's glow receives a quick, visible flash.
    pads[oldTarget].flash = 1.2;
  }

  function bounce() {
    streak = 0;
    misses++;
    playerY = CONTACT_Y;
    velocityY = 3.25;
    velocityX *= 0.38;
    emitBurst(playerX, 0.3, 17, true);
    pads[targetIndex].flash = 0.75;
    showToast(misses % 3 === 0 ? 'SOFT BUMP · NO HURRY, TRY AGAIN' : 'A LITTLE OFF-CENTER · TRY ANOTHER APPROACH', 1.4, true);
    chirp(230, 0.16, 'triangle', 0.045, 0.68);
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function finishRun() {
    if (phase !== 'playing') return;
    phase = 'over';
    timeLeft = 0;
    held = false;
    liftButton.classList.remove('pressed');
    liftButton.setAttribute('aria-pressed', 'false');
    setEngine();
    beamStateEl.textContent = 'FLIGHT COMPLETE';
    buttonLabel.textContent = 'HOLD FOR ANOTHER FLIGHT';
    buttonHint.textContent = '45 SECONDS · A FRESH PARKING RUN';
    const title = totalDocked >= 5 ? 'ORBITAL ACE.' : totalDocked >= 3 ? 'PARKED BEAUTIFULLY.' : totalDocked >= 1 ? 'NICE AND EASY.' : 'GOOD FIRST FLIGHT.';
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-copy').textContent = totalDocked >= 3
      ? 'A whole lot of saucer, parked in very little space.'
      : totalDocked > 0 ? 'Your little saucer is already finding its feet.' : 'The docks will still be here. Give the beam another go.';
    document.getElementById('result-docks').textContent = String(totalDocked);
    document.getElementById('result-points').textContent = String(totalScore);
    introEl.hidden = true;
    resultEl.hidden = false;
    showToast('FLIGHT WINDOW CLOSED · BEAUTIFULLY DONE', 2.2);
    chirp(520, 0.31, 'sine', 0.06, 1.2);
    updateHud(true);
  }

  function updateHud(force = false) {
    if (!force && gameTime - lastHudUpdate < 0.075) return;
    lastHudUpdate = gameTime;
    const seconds = phase === 'ready' ? ROUND_LENGTH : Math.ceil(timeLeft);
    const shownTime = `00:${String(Math.max(0, seconds)).padStart(2, '0')}`;
    if (shownTime !== displayClock) {
      displayClock = shownTime;
      clockEl.textContent = shownTime;
      clockEl.classList.toggle('is-low', phase === 'playing' && timeLeft <= 10);
    }
    const scoreText = String(totalScore).padStart(4, '0');
    if (scoreText !== displayScore) { displayScore = scoreText; scoreEl.textContent = scoreText; }
    const docksText = String(totalDocked).padStart(2, '0');
    if (docksText !== displayDocked) { displayDocked = docksText; dockCountEl.textContent = docksText; }
    timeFillEl.style.transform = `scaleX(${phase === 'playing' ? clamp(timeLeft / ROUND_LENGTH, 0, 1) : phase === 'ready' ? 1 : 0})`;
    const error = Math.abs(padXs[targetIndex] - playerX);
    vectorEl.textContent = phase === 'ready' ? 'READY' : `${error.toFixed(1)}u`;
    lockFillEl.style.width = phase === 'ready' ? '12%' : `${clamp((1 - error / 5.5) * 100, 5, 100)}%`;
    altitudeEl.textContent = phase === 'ready' ? '—' : Math.max(0, playerY).toFixed(1);
  }

  function update(dt) {
    gameTime += dt;
    for (let i = 0; i < particleCount; i++) {
      if (particleLife[i] <= 0) continue;
      particleLife[i] -= dt;
      const fade = Math.max(0, particleLife[i] / particleLifeMax[i]);
      const p = particleVels[i];
      particlePositions[i * 3] += p.x * dt;
      particlePositions[i * 3 + 1] += p.y * dt;
      particlePositions[i * 3 + 2] += p.z * dt;
      p.y -= 4.2 * dt;
      const j = i * 3;
      particleColors[j] = particleBaseColors[i].r * fade;
      particleColors[j + 1] = particleBaseColors[i].g * fade;
      particleColors[j + 2] = particleBaseColors[i].b * fade;
      if (particleLife[i] <= 0) particlePositions[j + 1] = -100;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;

    if (phase === 'playing') {
      timeLeft = Math.max(0, timeLeft - dt);
      if (pauseLeft > 0) {
        pauseLeft = Math.max(0, pauseLeft - dt);
        playerY = CONTACT_Y;
        velocityX = 0;
        velocityY = 0;
        if (pauseLeft === 0 && held) velocityY = 1.0;
      } else {
        const targetX = padXs[targetIndex];
        const error = targetX - playerX;
        const wind = Math.sin(gameTime * 1.45 + playerY * 0.27) * 0.24 + Math.sin(gameTime * 0.63) * 0.14;
        const accelX = held ? error * 4.7 - velocityX * 3.25 + wind : error * 0.25 - velocityX * 1.12 + wind * 0.55;
        velocityX = clamp(velocityX + clamp(accelX, -8, 8) * dt, -5.3, 5.3);
        playerX += velocityX * dt;
        if (playerX < -7.55 || playerX > 7.55) {
          playerX = clamp(playerX, -7.55, 7.55);
          velocityX *= -0.35;
        }
        velocityY = clamp(velocityY + (held ? 7.4 : -9.2) * dt, -5.35, 5.1);
        playerY += velocityY * dt;
        if (playerY > 10.65) {
          playerY = 10.65;
          velocityY = Math.min(velocityY, 1.1);
        }
        if (playerY <= CONTACT_Y && velocityY < 0) {
          playerY = CONTACT_Y;
          const positionOkay = Math.abs(playerX - targetX) < 0.78;
          const motionOkay = Math.abs(velocityX) < 1.45 && velocityY > -5.3;
          if (positionOkay && motionOkay) land();
          else bounce();
        }
      }
      if (timeLeft <= 0) finishRun();
    }

    ship.position.x = playerX;
    ship.position.y = playerY;
    ship.rotation.z = clamp(-velocityX * 0.023, -0.13, 0.13);
    ship.rotation.x = Math.sin(gameTime * 1.25) * 0.012 + (held ? -0.018 : 0.008);
    const beamLength = Math.max(0.24, playerY - 0.22);
    beam.scale.y = beamLength;
    beam.position.y = -0.19 - beamLength / 2;
    beam.visible = phase === 'playing' && held && playerY > 0.55;
    beam.material.opacity = 0.09 + Math.min(playerY * 0.006, 0.065);
    beamFoot.position.y = -0.19 - beamLength;
    beamFoot.scale.setScalar(0.83 + Math.sin(gameTime * 4) * 0.04);
    beamFoot.visible = beam.visible && playerY > 1.25;
    engineRing.material.opacity = held ? 0.98 : 0.48 + Math.sin(gameTime * 4.4) * 0.13;
    engineLens.material.opacity = held ? 0.54 : 0.24;
    shipLight.intensity = held ? 2.5 : 0.8;
    for (let i = 0; i < lamps.length; i++) lamps[i].scale.setScalar(0.9 + (Math.sin(gameTime * 4.5 + i * 0.7) + 1) * 0.13);
    world.scale.x = sceneScaleX;
    updatePads(dt);
    updateHud();
    if (toastEl.classList.contains('visible') && gameTime > toastUntil) toastEl.classList.remove('visible');
  }

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const aspect = width / height;
    camera.left = -VIEW_HEIGHT * aspect * 0.5;
    camera.right = VIEW_HEIGHT * aspect * 0.5;
    camera.top = VIEW_HEIGHT * 0.5;
    camera.bottom = -VIEW_HEIGHT * 0.5;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    sceneScaleX = clamp((VIEW_HEIGHT * aspect) / 17.5, 0.47, 1.36);
    world.scale.x = sceneScaleX;
  }

  function pressStart(event) {
    if (event && event.button !== undefined && event.button !== 0) return;
    if (event) event.preventDefault();
    ensureAudio();
    if (phase !== 'playing') startRun();
    setHeld(true);
    if (event && event.pointerId !== undefined && liftButton.setPointerCapture) {
      try { liftButton.setPointerCapture(event.pointerId); } catch (_) { /* Some browsers capture on the button automatically. */ }
    }
  }

  function pressEnd() {
    setHeld(false);
  }

  liftButton.addEventListener('pointerdown', pressStart);
  window.addEventListener('pointerup', pressEnd);
  window.addEventListener('pointercancel', pressEnd);
  liftButton.addEventListener('lostpointercapture', pressEnd);
  liftButton.addEventListener('click', () => {
    // Keeps the same one-button control usable by assistive click activation.
    if (phase !== 'playing') {
      startRun();
      setHeld(true);
      window.setTimeout(() => setHeld(false), 180);
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      if (!event.repeat) pressStart();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      pressEnd();
    }
  });
  window.addEventListener('blur', pressEnd);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pressEnd(); });
  window.addEventListener('resize', resize);
  resize();
  updateHud(true);

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.04, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    update(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();
