(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas');
  const timerEl = $('timer');
  const timerBox = $('timerBox');
  const dotsEl = $('jobDots');
  const guide = $('guidance');
  const guideText = $('guideText');
  const guideDetail = $('guideDetail');
  const rangeText = $('rangeText');
  const meterFill = $('meterFill');
  const holdBtn = $('holdBtn');
  const toast = $('toast');
  const flash = $('flash');
  const overlay = $('overlay');
  const startBtn = $('startBtn');

  const TOTAL = 6;
  const ROUND_TIME = 52;
  const START_X = 4.92;
  const FLOOR_Y = 0.235;
  const LAND_Y = 0.77;
  const HIGH_Y = 2.82;
  const CRUISE = 2.72;
  const DRAG = 2.35;
  const DESCEND = 1.17;
  const bays = [1.78, -1.88, 2.03, -2.08, 1.44, -1.56];
  const radii = [0.94, 0.91, 0.88, 0.86, 0.83, 0.81];
  const goodColor = 0x68ffdf;
  const waitColor = 0xffbf7d;
  const TAU = Math.PI * 2;

  let state = 'intro';
  let stage = 0, parks = 0, perfects = 0, timeLeft = ROUND_TIME;
  let transitionTimer = 0, transitionKind = '';
  let toastTimer = 0, flashTimer = 0, shake = 0;
  let keyHeld = false, pointerHeld = false, pointerId = null, held = false;
  let startKeyLock = false, lastAligned = false;
  let t = 0, previousFrame = performance.now(), lastTick = 53, dustClock = 0;
  let sx = -START_X, sy = HIGH_Y, vx = CRUISE, direction = 1;
  let targetX = bays[0], radius = radii[0];
  let audioCtx = null, hum1 = null, hum2 = null, humGain = null;
  const effects = [];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1128);
  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 100);
  const cameraBase = new THREE.Vector3(0, 8.5, 13.1);
  camera.position.copy(cameraBase);
  camera.lookAt(0, 1.0, 0);

  scene.add(new THREE.HemisphereLight(0xb9deff, 0x273150, 2.05));
  const keyLight = new THREE.DirectionalLight(0xd2eeff, 2.2);
  keyLight.position.set(-3, 9, 7);
  scene.add(keyLight);
  const magentaLight = new THREE.PointLight(0x9c74ff, 28, 12, 2);
  magentaLight.position.set(5, 4, -3);
  scene.add(magentaLight);

  const mat = (color, emissive = 0x000000, intensity = 0) => new THREE.MeshStandardMaterial({color, roughness: 0.62, metalness: 0.38, emissive, emissiveIntensity: intensity});
  const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity === 1});
  const floorMat = mat(0x1d2d49);
  const darkMat = mat(0x101b33);
  const trimMat = mat(0x395674, 0x102a3d, 0.45);
  const tealMat = mat(0x72ffde, 0x38ebce, 1.75);
  const violetMat = mat(0xa589ff, 0x6c50f4, 1.25);
  const amberMat = mat(0xffcf91, 0xe88239, 1.65);

  function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cyl(parent, rt, rb, h, x, y, z, material, segments = 32) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function ring(parent, r, tube, y, color, opacity = 1) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 7, 72), basic(color, opacity));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }
  let seed = 73921;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

  // A tiny nocturnal city surrounds the rooftop, all built from geometry.
  const background = new THREE.Group();
  scene.add(background);
  const moonMat = new THREE.MeshBasicMaterial({color: 0xd2dafc});
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 24), moonMat);
  moon.position.set(-5.0, -4.35, -15.5);
  background.add(moon);
  const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 24), basic(0x7a8fea, 0.075));
  moonHalo.position.copy(moon.position);
  background.add(moonHalo);
  const moonCraterMat = basic(0xb5c0ec, 0.42);
  for (const [x, y, r] of [[-.35,.26,.19],[.38,-.23,.12],[.2,.47,.09]]) {
    const crater = new THREE.Mesh(new THREE.CircleGeometry(r, 24), moonCraterMat);
    crater.position.set(moon.position.x + x, moon.position.y + y, moon.position.z + 1.12);
    background.add(crater);
  }
  const starMaterials = [basic(0xb8dfff, .78), basic(0x779bd7, .7), basic(0xe4d9ff, .8)];
  for (let i = 0; i < 115; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(rand() < .08 ? .038 : .018, 5, 4), starMaterials[i % 3]);
    const starZ = -15 - rand() * 9;
    const screenY = -.2 + rand() * 5.0;
    star.position.set((rand() - .5) * 37, 1 + (screenY + .497 * starZ) / .868, starZ);
    background.add(star);
  }
  for (let i = 0; i < 41; i++) {
    const x = -18 + i * .91 + rand() * .3;
    const h = 1.2 + rand() * 3.4;
    const w = .5 + rand() * .45;
    const z = -5.7 - rand() * 2.2;
    const building = box(background, w, h, .55, x, h / 2 - 1.3, z, mat(i % 4 === 0 ? 0x273357 : 0x182746));
    if (rand() > .74) box(background, .08, .2, .08, x, h - .18, z, violetMat);
    if (i % 3 === 0) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          if (rand() > .34) box(background, .065, .10, .013, x + (col ? .15 : -.15), .18 + row * .38, z + .284, basic(rand() > .67 ? 0x9d83dc : 0x548cad, .8));
        }
      }
    }
    building.rotation.y = (rand() - .5) * .04;
  }

  // The landing deck.
  box(scene, 11.95, .36, 6.25, 0, -.035, 0, floorMat);
  box(scene, 11.8, .5, 6.08, 0, -.48, 0, darkMat);
  box(scene, 11.5, .12, 5.9, 0, -.78, 0, trimMat);
  for (const z of [-3.07, 3.07]) {
    box(scene, 11.95, .095, .065, 0, .18, z, z < 0 ? violetMat : tealMat);
    box(scene, 11.95, .065, .06, 0, -.28, z, trimMat);
  }
  for (const x of [-5.93, 5.93]) box(scene, .06, .12, 6.2, x, .17, 0, trimMat);
  for (let i = -5; i <= 5; i++) {
    box(scene, .018, .007, 5.92, i, .153, 0, basic(0x6b819e, .23));
  }
  for (let i = -2; i <= 2; i++) box(scene, 11.5, .007, .014, 0, .156, i, basic(0x68809c, .18));
  for (let i = -5; i <= 5; i++) {
    if (i < 5) {
      box(scene, .58, .013, .025, i + .5, .18, -1.5, basic(0x8eb1c9, .43));
      box(scene, .58, .013, .025, i + .5, .18, 1.52, basic(0x8eb1c9, .43));
    }
    if (i % 2 === 0) {
      box(scene, .11, .018, .32, i, .179, -2.62, tealMat);
      box(scene, .11, .018, .32, i, .179, 2.62, violetMat);
    }
  }
  for (const z of [-2.68, 2.68]) {
    box(scene, 11.0, .025, .025, 0, .64, z, trimMat);
    for (let i = -5; i <= 5; i += 1) box(scene, .035, .54, .035, i, .38, z, trimMat);
  }
  // Extra machinery and blinking corner beacons.
  const beacons = [];
  for (const x of [-5.38, 5.38]) for (const z of [-2.54, 2.54]) {
    cyl(scene, .13, .19, .42, x, .38, z, darkMat, 12);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.115, 12, 8), amberMat.clone());
    bulb.position.set(x, .67, z);
    scene.add(bulb);
    beacons.push(bulb);
  }
  for (const x of [-4.25, 4.25]) {
    box(scene, .85, .44, .64, x, .40, -2.26, darkMat);
    box(scene, .68, .08, .08, x, .69, -1.89, trimMat);
    for (let i = 0; i < 3; i++) box(scene, .12, .035, .015, x - .21 + .21 * i, .47, -1.925, tealMat);
  }
  const frontLight = new THREE.PointLight(0x5affe0, 13, 5.5, 2);
  frontLight.position.set(0, 1.8, 1);
  scene.add(frontLight);

  function makeGlowTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(125,255,227,.65)');
    gr.addColorStop(.3, 'rgba(74,247,211,.32)');
    gr.addColorStop(1, 'rgba(44,226,209,0)');
    ctx.fillStyle = gr; ctx.fillRect(0,0,128,128);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const glowTexture = makeGlowTexture();
  const pad = new THREE.Group();
  scene.add(pad);
  const padLight = new THREE.PointLight(0x4bffda, 17, 4.8, 2);
  padLight.position.set(0, 1.65, 0);
  pad.add(padLight);
  cyl(pad, 1.12, 1.15, .065, 0, .181, 0, mat(0x315573, 0x174a55, .48), 48);
  cyl(pad, 1.02, 1.04, .018, 0, .223, 0, mat(0x0b243d, 0x052535, .55), 48);
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.52,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  glowPlane.rotation.x = -Math.PI/2;
  glowPlane.position.y = .252;
  pad.add(glowPlane);
  const outerRing = ring(pad, 1.025, .026, .262, 0x49ebd0);
  const innerRing = ring(pad, .78, .024, .267, 0x82ffdc);
  const scanRing = ring(pad, .55, .011, .274, 0x9efde9, .62);
  const dots = [];
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    const dot = box(pad, .11, .025, .04, Math.sin(a) * .94, .273, Math.cos(a) * .94, i % 3 === 0 ? amberMat : tealMat);
    dot.rotation.y = a;
    dots.push(dot);
  }
  for (const sign of [-1, 1]) {
    box(pad, .21, .012, .025, sign * 1.33, .205, -.6, tealMat);
    box(pad, .21, .012, .025, sign * 1.33, .205, .6, tealMat);
    box(pad, .025, .012, 1.22, sign * 1.44, .205, 0, basic(0x69d5d2, .45));
  }
  const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .44), new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  labelPlane.rotation.x = -Math.PI/2;
  labelPlane.position.set(0, .285, .02);
  pad.add(labelPlane);
  const holoLabel = new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
  holoLabel.position.set(0, 1.2, -1.04);
  holoLabel.scale.set(1.7,.4,1);
  pad.add(holoLabel);
  function makeLabel(text, w = 256, h = 96, small = false) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (small) {
      ctx.fillStyle = 'rgba(9,37,55,.72)'; ctx.fillRect(5,9,w-10,h-18);
      ctx.strokeStyle = '#72ffdc'; ctx.lineWidth = 3; ctx.strokeRect(5,9,w-10,h-18);
      ctx.font = '900 43px Arial'; ctx.fillStyle = '#baffee'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,w/2,h/2+3);
    } else {
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 50px Arial';ctx.fillStyle='#a8ffe7';ctx.shadowColor='#45ffdf';ctx.shadowBlur=15;ctx.fillText(text,w/2,h/2);
    }
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }
  function updatePadLabel(num) {
    if (labelPlane.material.map) labelPlane.material.map.dispose();
    if (holoLabel.material.map) holoLabel.material.map.dispose();
    labelPlane.material.map = makeLabel(String(num).padStart(2,'0'),256,96,true);
    holoLabel.material.map = makeLabel('BAY ' + String(num).padStart(2,'0'),320,80,false);
    labelPlane.material.needsUpdate = true;
    holoLabel.material.needsUpdate = true;
  }

  const guideRing = new THREE.Group();
  scene.add(guideRing);
  const ghostMat = basic(waitColor, .85);
  const ghostTorus = new THREE.Mesh(new THREE.TorusGeometry(.25,.015,6,48), ghostMat);
  ghostTorus.rotation.x = Math.PI/2; ghostTorus.position.y=.304;
  guideRing.add(ghostTorus);
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const tick = box(guideRing,.115,.012,.018,Math.cos(a)*.37,.305,Math.sin(a)*.37,ghostMat);
    tick.rotation.y=-a;
  }
  const connectorGeom = new THREE.BufferGeometry();
  connectorGeom.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const connector = new THREE.Line(connectorGeom, new THREE.LineBasicMaterial({color:0x6fffe0,transparent:true,opacity:.24,depthWrite:false}));
  scene.add(connector);

  // Saucer: layered metal lathe, glass cockpit, illuminated ports.
  const ship = new THREE.Group();
  scene.add(ship);
  const hullPoints = [
    [0,-.21],[.29,-.20],[.47,-.15],[.64,-.065],[.72,.004],
    [.68,.054],[.49,.12],[.35,.145],[0,.15]
  ].map(([x,y]) => new THREE.Vector2(x,y));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(hullPoints,48), new THREE.MeshStandardMaterial({color:0xd6eaf5,metalness:.72,roughness:.26,emissive:0x294c65,emissiveIntensity:.22}));
  ship.add(hull);
  const underside = new THREE.Mesh(new THREE.SphereGeometry(.53,32,16), new THREE.MeshStandardMaterial({color:0x233e5c,metalness:.7,roughness:.36,emissive:0x11475c,emissiveIntensity:.42}));
  underside.scale.set(1,.25,1); underside.position.y=-.135; ship.add(underside);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.36,36,18),new THREE.MeshStandardMaterial({color:0x84d7e7,metalness:.34,roughness:.15,emissive:0x285f82,emissiveIntensity:.52}));
  dome.scale.set(1,.78,1); dome.position.y=.19; ship.add(dome);
  cyl(ship,.37,.39,.045,0,.11,0,trimMat,40);
  const shipRim = ring(ship,.69,.032,.012,0x8dffe6);
  const innerRim = ring(ship,.48,.013,-.115,0xffd596);
  const cockpitReflection = new THREE.Mesh(new THREE.SphereGeometry(.10,14,8),basic(0xe4fff7,.48));
  cockpitReflection.scale.set(1,.25,.4);cockpitReflection.position.set(-.14,.398,.12);ship.add(cockpitReflection);
  for (let i=0;i<10;i++) {
    const a=TAU*i/10;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.037,10,8),i%2===0 ? tealMat : amberMat);
    bulb.position.set(Math.cos(a)*.605,-.055,Math.sin(a)*.605);
    ship.add(bulb);
  }
  const engine = new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshBasicMaterial({color:0x90ffed,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
  engine.scale.y=.42;engine.position.y=-.23;ship.add(engine);
  const shipLight = new THREE.PointLight(0x7affdf,9,3.1,2);
  shipLight.position.y=-.12;ship.add(shipLight);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.7,40),new THREE.MeshBasicMaterial({color:0x020a1d,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.289;scene.add(shadow);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(.73,1,32,1,true),new THREE.MeshBasicMaterial({color:0x63ffdf,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  beam.renderOrder=3;scene.add(beam);
  const beamCore = new THREE.Mesh(new THREE.ConeGeometry(.35,1,24,1,true),new THREE.MeshBasicMaterial({color:0xc5fff1,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  beamCore.renderOrder=3;scene.add(beamCore);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w,h,false);
    const aspect = w / Math.max(1,h);
    const visibleWidth = Math.max(12.75,8.55*aspect);
    const visibleHeight = visibleWidth/aspect;
    camera.left=-visibleWidth/2;camera.right=visibleWidth/2;
    camera.top=visibleHeight/2;camera.bottom=-visibleHeight/2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize',resize);
  resize();

  function makeDots() {
    dotsEl.replaceChildren();
    for(let i=0;i<TOTAL;i++) {
      const dot=document.createElement('span');dot.className='job-dot';
      dot.setAttribute('aria-hidden','true');dotsEl.appendChild(dot);
    }
    updateDots();
  }
  function updateDots() {
    [...dotsEl.children].forEach((dot,i) => {
      dot.className = 'job-dot' + (i<parks?' done': i===stage && parks<TOTAL?' current':'');
    });
    dotsEl.setAttribute('aria-label',parks+' of '+TOTAL+' parking bays completed');
  }
  function displayTime() {
    const secs=Math.max(0,Math.ceil(timeLeft));
    timerEl.textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');
    timerBox.classList.toggle('danger',timeLeft<=10 && state!=='intro' && state!=='end');
  }
  function setPad(index) {
    targetX=bays[index];radius=radii[index];
    pad.position.x=targetX;
    updatePadLabel(index+1);
    frontLight.position.x=targetX;
  }
  function spawn(index) {
    direction=index%2===0?1:-1;
    sx=-direction*START_X;sy=HIGH_Y;vx=direction*CRUISE;
    setPad(index);
    keyHeld=false;pointerHeld=false;pointerId=null;setHeld(false);lastAligned=false;
    updateDots();
    if(index>0) announce('BAY '+String(index+1).padStart(2,'0')+' / 06',false,1.2);
  }
  function announce(text,bad=false,duration=1.3) {
    toast.textContent=text;
    toast.className='toast show'+(bad?' bad':'');
    toastTimer=duration;
  }
  function screenFlash(good=true) {
    flash.className=good?'good':'bad';
    flash.style.opacity=good?'.95':'.9';
    flashTimer=.28;
    shake=good?.10:.20;
  }
  function startGame() {
    if(state==='playing'||state==='transition')return;
    stage=0;parks=0;perfects=0;timeLeft=ROUND_TIME;lastTick=53;
    state='playing';transitionTimer=0;transitionKind='';
    spawn(0);displayTime();
    overlay.classList.add('hidden');
    startBtn.blur();
    announce('PARK THE FIRST BAY',false,1.7);
    unlockAudio();
    tone(520,.09,'sine',.065);
    tone(780,.16,'sine',.055,.10);
  }
  function finishGame(won) {
    if(state==='end')return;
    state='end';keyHeld=false;pointerHeld=false;pointerId=null;setHeld(false);
    guideText.textContent=won?'CONTRACT COMPLETE':'TIME IS UP';
    guideDetail.textContent=won?'All six bays are yours.':'Try another night shift.';
    $('overlayEyebrow').textContent=won?'CONTRACT COMPLETE · SECTOR 07':'CONTRACT EXPIRED · SECTOR 07';
    $('overlayTitle').innerHTML=won?'SHIFT<br><em>COMPLETE.</em>':'SHIFT<br><em>OVER.</em>';
    $('overlayDescription').innerHTML=won
      ? 'Six clean landings! You finished with <b>'+Math.ceil(timeLeft)+' seconds</b> to spare and <b>'+perfects+' perfect '+(perfects===1?'park':'parks')+'</b>. The city sleeps a little easier.'
      : 'You parked <b>'+parks+' of '+TOTAL+'</b> UFO bays. Every great pilot misses a rooftop sometimes. The night is ready for another run.';
    $('startLabel').textContent='PLAY AGAIN';
    overlay.classList.remove('hidden');
    if(won) {for(let i=0;i<3;i++) tone(500+i*180,.26,'sine',.07,i*.13);}
    else tone(230,.42,'triangle',.06);
  }

  function unlockAudio() {
    try {
      if(!audioCtx) {
        audioCtx=new (window.AudioContext||window.webkitAudioContext)();
        humGain=audioCtx.createGain();humGain.gain.value=.00001;humGain.connect(audioCtx.destination);
        hum1=audioCtx.createOscillator();hum1.type='sine';hum1.frequency.value=93;hum1.connect(humGain);hum1.start();
        hum2=audioCtx.createOscillator();hum2.type='triangle';hum2.frequency.value=139;hum2.connect(humGain);hum2.start();
      }
      if(audioCtx.state==='suspended')audioCtx.resume();
    } catch(e) {audioCtx=null;}
  }
  function tone(frequency,duration,type='sine',volume=.06,delay=0,endFrequency=null) {
    if(!audioCtx)return;
    try {
      const now=audioCtx.currentTime+delay;
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(frequency,now);
      if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(volume,now+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);
      osc.start(now);osc.stop(now+duration+.03);
    }catch(e) { /* Visual feedback remains available if audio fails. */ }
  }
  function setHeld(value) {
    if(held===value)return;
    held=value;
    holdBtn.classList.toggle('engaged',held);
    if(held && state==='playing'){
      tone(180,.16,'triangle',.022,0,110);
      if(navigator.vibrate)navigator.vibrate(12);
    }
  }
  function updateHold() {setHeld(state==='playing' && (keyHeld || pointerHeld));}
  startBtn.addEventListener('click',startGame);
  window.addEventListener('keydown',(e)=>{
    if(!['Space','Enter','ArrowDown'].includes(e.code))return;
    e.preventDefault();
    if(state==='intro'||state==='end'){if(!e.repeat){startKeyLock=true;startGame();}return;}
    if(state==='playing' && !startKeyLock){keyHeld=true;unlockAudio();updateHold();}
  });
  window.addEventListener('keyup',(e)=>{
    if(['Space','Enter','ArrowDown'].includes(e.code)){startKeyLock=false;keyHeld=false;updateHold();}
  });
  window.addEventListener('pointerdown',(e)=>{
    if(state!=='playing'||(e.target instanceof Element && e.target.closest('#overlay')))return;
    if(pointerId!==null)return;
    e.preventDefault();
    pointerId=e.pointerId;pointerHeld=true;
    unlockAudio();updateHold();
  },{passive:false});
  const releasePointer=(e)=>{
    if(pointerId!==e.pointerId)return;
    pointerId=null;pointerHeld=false;updateHold();
  };
  window.addEventListener('pointerup',releasePointer);
  window.addEventListener('pointercancel',releasePointer);
  window.addEventListener('blur',()=>{keyHeld=false;pointerHeld=false;pointerId=null;updateHold();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keyHeld=false;pointerHeld=false;pointerId=null;updateHold();}});

  function burst(x,y,z,success) {
    const color=success?0x8affdb:0xff8297;
    for(let i=0;i<23;i++){
      const a=rand()*TAU, speed=1.1+rand()*2.2;
      const p=new THREE.Mesh(new THREE.SphereGeometry(.026+rand()*.036,6,4),basic(i%4===0?0xffffff:color,.9));
      p.position.set(x,y,z);scene.add(p);
      effects.push({mesh:p,vx:Math.cos(a)*speed,vy:.5+rand()*2.15,vz:Math.sin(a)*speed,life:.65+rand()*.5,max:1.15,kind:'spark'});
    }
    const m=new THREE.Mesh(new THREE.TorusGeometry(.7,.028,6,60),basic(color,.88));
    m.rotation.x=Math.PI/2;m.position.set(x,FLOOR_Y+.1,z);scene.add(m);
    effects.push({mesh:m,life:.72,max:.72,kind:'wave'});
  }
  function dust() {
    const p=new THREE.Mesh(new THREE.SphereGeometry(.025+rand()*.025,6,4),basic(rand()>.5?0x80ffe3:0xe8fffc,.55));
    p.position.set(sx+(rand()-.5)*.3,sy-.30,.08+(rand()-.5)*.27);
    scene.add(p);
    effects.push({mesh:p,vx:(rand()-.5)*.65,vy:-.7-rand()*.65,vz:(rand()-.5)*.5,life:.35+rand()*.22,max:.57,kind:'spark'});
  }
  function updateEffects(dt) {
    for(let i=effects.length-1;i>=0;i--){
      const e=effects[i];e.life-=dt;
      if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);continue;}
      if(e.kind==='wave'){
        const progress=1-e.life/e.max;
        e.mesh.scale.setScalar(1+progress*2.4);
        e.mesh.material.opacity=(1-progress)*.85;
      } else {
        e.mesh.position.x+=e.vx*dt;e.mesh.position.y+=e.vy*dt;e.mesh.position.z+=e.vz*dt;
        e.vy-=2.9*dt;e.mesh.material.opacity=Math.min(.9,e.life/e.max);
      }
    }
  }
  function land() {
    if(state!=='playing')return;
    const error=Math.abs(sx-targetX);
    const inBay=error<=radius;
    const slow=Math.abs(vx)<.73;
    if(inBay&&slow){
      const perfect=error<.29;
      if(perfect)perfects++;
      parks++;
      updateDots();
      announce(perfect?'PERFECT PARK!':'NICELY PARKED!',false,1.15);
      screenFlash(true);burst(sx,.53,.07,true);
      tone(740,.16,'sine',.09);tone(930,.16,'sine',.07,.12);tone(1245,.32,'sine',.07,.23);
      if(navigator.vibrate)navigator.vibrate([16,45,22]);
      if(parks>=TOTAL){finishGame(true);return;}
      stage=parks;transitionKind='success';transitionTimer=1.5;state='transition';
    } else {
      announce(inBay?'TOO FAST — RETRY':'MISSED THE BAY',true,1.15);
      screenFlash(false);burst(sx,.47,.07,false);
      tone(280,.35,'sawtooth',.048,0,106);
      if(navigator.vibrate)navigator.vibrate([50,35,50]);
      timeLeft=Math.max(0,timeLeft-2);
      transitionKind='miss';transitionTimer=.95;state='transition';
    }
    keyHeld=false;pointerHeld=false;pointerId=null;setHeld(false);
  }

  function updateFlight(dt) {
    if(held){
      vx*=Math.exp(-DRAG*dt);
      sy-=DESCEND*dt;
      dustClock+=dt;
      if(dustClock>.085){dustClock=0;dust();}
    }else{
      vx+=(direction*CRUISE-vx)*Math.min(1,2.2*dt);
      sy=Math.min(HIGH_Y,sy+1.52*dt);
      dustClock=0;
    }
    sx+=vx*dt;
    if(sx>5.16){sx=5.16;direction=-1;vx=-Math.max(.5,Math.abs(vx)*.84);tone(410,.09,'sine',.025);}
    if(sx< -5.16){sx=-5.16;direction=1;vx=Math.max(.5,Math.abs(vx)*.84);tone(410,.09,'sine',.025);}
    if(sy<=LAND_Y){sy=LAND_Y;land();}
  }
  function updateGuidance() {
    if(state!=='playing'){
      guideRing.visible=false;connector.visible=false;
      if(state==='intro'){
        rangeText.textContent='STANDBY';guideText.textContent='AWAITING PILOT';guideDetail.textContent='Line up with the glowing bay';meterFill.style.width='0%';
      }
      return;
    }
    const fallTime=Math.max(0,(sy-LAND_Y)/DESCEND);
    const landingX=sx+vx*(1-Math.exp(-DRAG*fallTime))/DRAG;
    const distance=Math.abs(landingX-targetX);
    const aligned=distance<radius;
    if(aligned && !lastAligned && !held)tone(820,.085,'sine',.026);
    lastAligned=aligned;
    guideRing.visible=true;connector.visible=true;
    guideRing.position.set(Math.max(-5.4,Math.min(5.4,landingX)),0,.07);
    guideRing.scale.setScalar(aligned?1+Math.sin(t*10)*.09:1);
    ghostMat.color.setHex(aligned?goodColor:waitColor);
    connector.material.color.setHex(aligned?goodColor:waitColor);
    const pts=connectorGeom.attributes.position.array;
    pts[0]=Math.max(-5.4,Math.min(5.4,landingX));pts[1]=.31;pts[2]=.07;
    pts[3]=targetX;pts[4]=.31;pts[5]=.07;
    connectorGeom.attributes.position.needsUpdate=true;
    rangeText.textContent=aligned?'IN RANGE':distance.toFixed(1)+'m OFF';
    let title, detail;
    if(held){
      if(aligned){title='STAY ON TARGET';detail='Keep holding until touchdown';}
      else {title='RELEASE TO ABORT';detail='Climb, circle back and try again';}
    } else if(aligned){title='HOLD NOW!';detail='Your projected landing is in the bay';}
    else if(distance<radius+1){title='GET READY...';detail='Watch the small landing reticle';}
    else {title='GLIDE TO BAY';detail='Hold when the reticle turns green';}
    guideText.textContent=title;guideDetail.textContent=detail;
    guide.classList.toggle('off',!aligned);
    meterFill.style.width=(Math.max(0,Math.min(100,100-distance/3.6*100))).toFixed(1)+'%';
  }
  function updateWorld(dt) {
    const bob=state==='intro'?Math.sin(t*2.2)*.07:state==='end'?Math.sin(t*2.8)*.035:!held&&state==='playing'?Math.sin(t*5.5)*.025:0;
    if(state==='intro'){
      sx=-1.3+Math.sin(t*.55)*.45;sy=2.2;vx=1;
    }
    ship.position.set(sx,sy+bob,.07);
    ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,state==='playing'?(held?-.022*vx:.04*vx):0,.075);
    ship.rotation.x=Math.sin(t*2.4)*.018;
    shipRim.material.color.setHex(held?0xcaffef:0x8dffe6);
    engine.material.opacity=held?.95:.53+Math.sin(t*9)*.06;
    engine.scale.setScalar(held?1.22:1);
    engine.scale.y=held?.6:.42;
    shipLight.intensity=held?14:8;
    shadow.position.set(sx,.289,.07);
    const shadowScale=1+(sy-LAND_Y)*.31;
    shadow.scale.set(shadowScale,shadowScale,shadowScale);
    shadow.material.opacity=Math.max(.09,.43-(sy-LAND_Y)*.13);
    const height=Math.max(.1,sy-.28);
    beam.visible=held && (state==='playing'||state==='transition');
    beamCore.visible=beam.visible;
    for(const b of [beam,beamCore]){b.position.set(sx,(sy+.28)/2,.07);b.scale.set(1,height,1);}
    beam.material.opacity=.11+Math.sin(t*17)*.015;
    beamCore.material.opacity=.10+Math.sin(t*12)*.025;
    outerRing.material.opacity=.78+Math.sin(t*3.6)*.2;
    innerRing.material.opacity=.77+Math.sin(t*5.4)*.2;
    scanRing.scale.setScalar(.95+Math.sin(t*3.2)*.08);
    glowPlane.material.opacity=.43+Math.sin(t*3.7)*.1;
    padLight.intensity=14+Math.sin(t*4)*3;
    for(let i=0;i<beacons.length;i++)beacons[i].material.emissiveIntensity=(Math.sin(t*3.4+i*Math.PI*.62)>0 ? 2.3:.18);
    if(humGain&&audioCtx){
      const active=state==='playing'||state==='transition';
      humGain.gain.setTargetAtTime(active?(held?.024:.011):.00001,audioCtx.currentTime,.08);
      hum1.frequency.setTargetAtTime(held?78:100+Math.abs(vx)*2,audioCtx.currentTime,.08);
      hum2.frequency.setTargetAtTime(held?119:148,audioCtx.currentTime,.08);
    }
    if(shake>0){
      shake=Math.max(0,shake-dt);
      const amount=shake*.2;
      camera.position.set(cameraBase.x+(rand()-.5)*amount,cameraBase.y+(rand()-.5)*amount,cameraBase.z);
    } else camera.position.copy(cameraBase);
    camera.lookAt(0,1,0);
  }
  function frame(now) {
    const dt=Math.min(.045,Math.max(0,(now-previousFrame)/1000));
    previousFrame=now;t+=dt;
    if(state==='playing'||state==='transition'){
      timeLeft=Math.max(0,timeLeft-dt);
      if(Math.ceil(timeLeft)<lastTick){
        lastTick=Math.ceil(timeLeft);
        if(lastTick<=10&&lastTick>0)tone(650,lastTick<=3?.12:.065,'sine',.045);
      }
      displayTime();
      if(timeLeft<=0)finishGame(false);
      else if(state==='playing')updateFlight(dt);
      else {
        transitionTimer-=dt;
        if(transitionKind==='success')sy=Math.min(HIGH_Y,sy+dt*.55);
        if(transitionTimer<=0){state='playing';spawn(stage);}
      }
    }
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show');}
    if(flashTimer>0){flashTimer-=dt;if(flashTimer<=0)flash.style.opacity='0';}
    updateGuidance();updateWorld(dt);updateEffects(dt);
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  makeDots();setPad(0);displayTime();requestAnimationFrame(frame);
})();
