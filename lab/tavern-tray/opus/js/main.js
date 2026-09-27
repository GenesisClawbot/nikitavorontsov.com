/* Tipsy Tray — game controller: boot, input, state machine, camera, scoring */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx, C = TT.chars, D = TT.drinks, F = TT.fx, A = TT.audio, U = TT.ui, P = TT.PHYS;

  var TIME_LIMIT = 60, PR = 0.33, NEAR = 0.45;
  var renderer, scene, camera, path, goblin, ghost, ghostTray, tray, blobMesh, hazards, crowd;
  var _f = {}, _f2 = {}, _f3 = {};
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _shake = { x: 0, y: 0, z: 0 };
  var PALM = new THREE.Vector3(0.14, 0.79, 0.06);
  var ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  var g = (TT.game = {
    mode: 'boot', t: 0, time: 0, hold: false, holdT: 0,
    player: TT.newPlayerState(), cups: [], timeLeft: TIME_LIMIT, timeLimit: TIME_LIMIT, runTime: 0,
    bonusTips: 0, shaves: 0, bumps: 0, progress: 0, ghostProgress: null, stepPhase: 0,
    aF: 0, aL: 0, timeScale: 1, hitStop: 0, slowmo: 0, acc: 0, camH: Math.PI, rounds: 0,
    playerPos: { x: 0, z: 0 }, hurry: false, nearCD: {}, panic: 0, lastSplash: 0, rec: [], recT: 0,
    ghostData: null, best: 0, seen: {}, firstRun: true
  });

  // ---------------------------------------------------------------- boot
  function boot() {
    var canvas = document.getElementById('scene');
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      document.getElementById('nogl').style.display = 'flex';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping !== undefined ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    TT.reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2b170e);
    scene.fog = new THREE.Fog(0x2b170e, 17, 58);
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 150);

    scene.add(new THREE.HemisphereLight(0xffd6a8, 0x4a2a3a, 1.75));
    var sun = new THREE.DirectionalLight(0xffe0b8, 2.1);
    sun.position.set(-6, 14, 8);
    scene.add(sun);

    TT.world.build(scene);
    path = TT.world.path; hazards = TT.world.hazards; crowd = TT.world.crowd;
    F.init(scene, camera);

    goblin = C.makeGoblin(false);
    scene.add(goblin.root);
    tray = D.makeTray();
    scene.add(tray.group);
    tray.bounceY = 0; tray.bounceV = 0;
    g.cups = tray.cups;
    ghost = C.makeGoblin(true);
    ghost.root.visible = false;
    scene.add(ghost.root);
    ghostTray = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.47, 0.05, 28), C.ghostMat());
    ghostTray.visible = false;
    scene.add(ghostTray);

    // dynamic blob shadows
    var n = crowd.people.length + 10;
    blobMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), TT.world.blobMat, n);
    blobMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    blobMesh.frustumCulled = false;
    blobMesh.renderOrder = -1;
    scene.add(blobMesh);

    for (var i = 0; i < crowd.people.length; i++) {
      var p = crowd.people[i];
      if (p.ambient) p.lookTarget = g.playerPos;
    }
    for (var c = 0; c < TT.world.customers.length; c++) TT.world.customers[c].p.lookTarget = g.playerPos;
    TT.world.barkeep.lookTarget = g.playerPos;

    U.init();
    A.muted = TT.storage.get('tt_muted', false);
    A.preload();
    updateMuteIcon();
    g.best = TT.storage.get('tt_best', 0);
    g.ghostData = TT.storage.get('tt_ghost', null);
    g.seen = TT.storage.get('tt_seen', {});
    g.firstRun = !g.seen.walk;

    bindInput(canvas);
    window.addEventListener('resize', onResize);
    onResize();
    resetRound();
    g.mode = 'title'; g.t = 0;
    U.show('title');
    renderer.compile(scene, camera);
    document.body.classList.add('ready');
    var last = performance.now();
    var loop = function (now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden) return;
      frame(dt);
    };
    requestAnimationFrame(loop);
  }

  function updateGlowScale() {
    if (TT.world.glowMat) TT.world.glowMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  }

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.85 ? 64 : 52;
    camera.updateProjectionMatrix();
    updateGlowScale();
  }

  // ---------------------------------------------------------------- input
  function bindInput(canvas) {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) press();
      } else if (e.code === 'KeyM') toggleMute();
      else if (e.code === 'KeyR') quickRestart();
      else if (e.code === 'Enter' && (g.mode === 'title' || g.mode === 'results')) { press(); release(); }
    });
    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); release(); }
    });
    var app = document.getElementById('app');
    app.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault();
      press();
    });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', function () { if (document.hidden) release(); });
    app.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.getElementById('muteBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
    document.getElementById('restartBtn').addEventListener('click', function (e) { e.stopPropagation(); A.init(); quickRestart(); });
  }

  function press() {
    A.init();
    g.hold = true;
    if (g.mode === 'title') { startRound(true); }
    else if (g.mode === 'results' && g.t > 0.9) { startRound(false); }
  }
  function release() { g.hold = false; }

  function toggleMute() { A.toggleMute(); updateMuteIcon(); }
  function updateMuteIcon() {
    var b = document.getElementById('muteBtn');
    if (b) b.classList.toggle('off', !!A.muted);
  }
  function quickRestart() {
    if (g.mode === 'play' || g.mode === 'intro' || g.mode === 'results' || g.mode === 'fail' || g.mode === 'deliver') startRound(false);
  }

  // ---------------------------------------------------------------- round setup
  function resetRound() {
    var pl = g.player;
    var fresh = TT.newPlayerState();
    for (var k in fresh) pl[k] = fresh[k];
    g.timeLeft = TIME_LIMIT; g.runTime = 0; g.bonusTips = 0; g.shaves = 0; g.bumps = 0;
    g.hurry = false; g.nearCD = {}; g.rec = []; g.recT = 0; g.hitStop = 0; g.slowmo = 0; g.timeScale = 1; g.acc = 0;
    g.lastTick = -1; g.panic = 0; g.result = null; g.stepPhase = 0; g.pendingShave = null; g.lastBumpT = -9;
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i];
      if (c.group.parent !== tray.group) tray.group.attach(c.group);
      c.group.position.set(c.def.pos[0], 0.048, c.def.pos[2]);
      c.group.rotation.set(0, 0, 0);
      c.group.scale.set(1, 1, 1);
      c.group.visible = true;
      D.resetCup(c);
      c.frac = 1; c.frameSpill = 0; c.recent = 0; c.dropAcc = 0; c.lastRattle = 0; c.popCD = 0; c.dropT = 1; c.hop = null;
    }
    tray.tiltX = tray.tiltZ = tray.vX = tray.vZ = 0; tray.bounceY = 0; tray.bounceV = 0; tray.deliver = null;
    var r = Math.random;
    for (var h = 0; h < hazards.length; h++) hazards[h].reset(r);
    for (var q = 0; q < crowd.people.length; q++) { var p = crowd.people[q]; p.cheerTarget = 0; p.mood = 0; p.react = 0; }
    goblin.sad = 0; goblin.cheer = 0;
    F.reset();
    U.resetMeters();
    placeGoblin(0);
  }

  function startRound(first) {
    resetRound();
    g.rounds++;
    g.mode = 'intro'; g.t = 0;
    g.introDur = (first && g.firstRun) ? 2.3 : 1.25;
    for (var i = 0; i < g.cups.length; i++) { g.cups[i].dropT = -0.15 - i * 0.2; g.cups[i].group.visible = false; }
    U.show('hud');
    U.hideHint();
    if (first || g.rounds % 5 === 1) A.voice('orderup', 0.9, 1, true); else A.bell(0.5);
    A.setMusic(0.42, 1);
    g.ghostProgress = null;
    var gd = g.ghostData;
    g.ghostOn = !!(gd && gd.s && gd.s.length > 4);
  }

  function placeGoblin(s) {
    path.sample(s, _f);
    goblin.root.position.set(_f.x, 0, _f.z);
    goblin.root.rotation.y = _f.h;
    g.playerPos.x = _f.x; g.playerPos.z = _f.z;
  }

  // ---------------------------------------------------------------- main frame
  function frame(realDt) {
    g.time += realDt;
    // time scale (hit-stop + slow-mo)
    var ts = 1;
    if (g.hitStop > 0) { g.hitStop -= realDt; ts = 0.12; }
    else if (g.slowmo > 0) { g.slowmo -= realDt; ts = 0.5; }
    g.timeScale = ts < g.timeScale ? ts : TT.damp(g.timeScale, ts, 10, realDt);
    var dt = realDt * g.timeScale;
    g.t += dt;
    var time = g.time;

    if (g.mode === 'title') updateTitle(dt);
    else if (g.mode === 'intro') updateIntro(dt);
    else if (g.mode === 'play') updatePlay(dt);
    else if (g.mode === 'deliver') updateDeliver(dt);
    else if (g.mode === 'fail') updateFail(dt);
    else if (g.mode === 'results') updateResults(dt);

    // hazards keep living in every mode
    var hctx = hazardCtx();
    for (var i = 0; i < hazards.length; i++) hazards[i].update(dt, time, hctx);
    crowd.update(dt, time);
    animateGoblinFrame(dt);
    placeTray(dt);
    updateDrinkVisuals(dt, time);
    updateGhost(dt);
    updateBlobs();
    updateLights(time);
    F.update(dt, time, camera);
    F.updateStars(goblin.root.position.x, goblin.root.position.y + 1.25, goblin.root.position.z, time);
    TT.world.glowMat.uniforms.uTime.value = time;
    A.update(realDt);
    // fire crackles near the hearth
    var fd = Math.hypot(g.playerPos.x - TT.world.fire.x, g.playerPos.z - TT.world.fire.z);
    if (fd < 16 && Math.random() < realDt * 6) A.crackle(0.25 * (1 - fd / 16));
    g.progress = g.player.s / path.length;
    U.update(realDt, g);
    applyCamera(realDt);
    renderer.render(scene, camera);
  }

  function hazardCtx() {
    var c = g._hctx || (g._hctx = {
      audio: A, fx: F,
      near: function (x, z, range) { var d = Math.hypot(x - c.px, z - c.pz); return TT.clamp(1 - d / range, 0, 1); },
      onSlam: onSlam
    });
    c.px = goblin.root.position.x; c.pz = goblin.root.position.z;
    return c;
  }

  // ---------------------------------------------------------------- title
  function updateTitle(dt) {
    placeGoblin(0);
    var gp = goblin.root.position;
    var a = Math.PI + Math.sin(g.time * 0.18) * 0.55 + 0.25; // in front of the goblin
    var rad = 3.5;
    var hx = Math.sin(_f.h), hz = Math.cos(_f.h);
    // camera orbits in front of the goblin (goblin faces along the path)
    var ang = _f.h + a + Math.PI;
    camTarget.pos.set(gp.x + Math.sin(ang) * rad, 1.55, gp.z + Math.cos(ang) * rad);
    camTarget.look.set(gp.x + hx * 0.3, 1.75, gp.z + hz * 0.3);
    camTarget.sideShift = camera.aspect > 1.1 ? 1.25 : 0;
    camTarget.fovAdd = 0;
    camTarget.lambda = 2.5;
    for (var i = 0; i < g.cups.length; i++) g.cups[i].group.visible = true;
    A.setMusic(A.muted ? 0 : 0.22, 1);
  }

  // ---------------------------------------------------------------- intro (drinks drop onto the tray)
  function updateIntro(dt) {
    placeGoblin(0);
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i];
      var was = c.dropT;
      c.dropT += dt;
      if (c.dropT < 0) { c.group.visible = false; continue; }
      c.group.visible = true;
      var k = Math.min(1, c.dropT / 0.32);
      c.group.position.y = 0.048 + (1 - k) * (1 - k) * 1.1;
      var sq = c.dropT > 0.32 ? Math.max(0, 1 - (c.dropT - 0.32) / 0.18) : 0;
      c.group.scale.set(1 + sq * 0.12, 1 - sq * 0.15, 1 + sq * 0.12);
      if (was < 0.32 && c.dropT >= 0.32) {
        A.clink(0.45, 0.9 + i * 0.12);
        var a = Math.random() * Math.PI * 2;
        TT.kickDrink(c.def, c.st, Math.cos(a) * 0.35, Math.sin(a) * 0.35);
        tray.bounceV -= 0.5;
      }
      // liquids settle a bit during the intro
      TT.stepDrink(c.def, c.st, 0, 0, dt);
      c.st.L = c.st.L0;
    }
    chaseCam(dt, g.t < 0.05);
    if (g.t > 0.35 && g.t - dt <= 0.35) F.pop(g.firstRun ? 'ORDER UP!' : 'AGAIN!', null, 0, 0, 'big', 1.2);
    if (g.t >= g.introDur) {
      g.mode = 'play'; g.t = 0;
      for (var j = 0; j < g.cups.length; j++) { g.cups[j].group.position.y = 0.048; g.cups[j].group.scale.set(1, 1, 1); g.cups[j].group.visible = true; }
      F.pop('GO!', null, 0, 0, 'big go', 0.8);
      A.pop(0.5, 1.4);
      if (!g.seen.walk) U.showHint(U.touch ? 'Touch & hold to walk' : 'Hold SPACE to walk', 60);
    }
  }

  // ---------------------------------------------------------------- play
  function updatePlay(dt) {
    var pl = g.player;
    // fixed-step physics
    g.acc += dt;
    var h = P.SUBSTEP, steps = 0;
    while (g.acc >= h && steps < 40) { physicsStep(h); g.acc -= h; steps++; }
    placeGoblin(pl.s);
    g.runTime += dt;
    // ghost recording (20 Hz)
    g.recT += dt;
    while (g.recT >= 0.05) { g.recT -= 0.05; g.rec.push(Math.round(pl.s * 100) / 100); }
    // tutorial hints
    tutorial(dt);
    // spills, rattles
    handleSpills(dt);
    // collisions & close shaves
    collide();
    confirmShaves();
    // timer
    g.timeLeft -= dt;
    if (!g.hurry && g.timeLeft <= 15) {
      g.hurry = true;
      F.pop('HURRY!', null, 0, 0, 'big warn', 1.0);
      A.setMusic(0.46, 1.1);
    }
    if (g.hurry) {
      var sec = Math.ceil(g.timeLeft);
      if (sec !== g.lastTick && sec >= 0) { g.lastTick = sec; A.tick(0.5, sec <= 5); }
    }
    chaseCam(dt, false);
    // end conditions
    var allDry = true;
    for (var i = 0; i < g.cups.length; i++) if (g.cups[i].frac > 0.04) allDry = false;
    if (pl.s >= path.length - 0.02) return deliver();
    if (allDry) return fail('dry');
    if (g.timeLeft <= 0) { g.timeLeft = 0; return fail('time'); }
  }

  function physicsStep(h) {
    var pl = g.player;
    TT.stepPlayer(pl, g.hold, h);
    if (pl.s < 0) { pl.s = 0; if (pl.v < 0) pl.v = 0; }
    if (pl.s > path.length) pl.s = path.length;
    path.sample(pl.s, _f2);
    g.stepPhase += h * (2 + Math.abs(pl.v) * 1.6) * Math.PI;
    var lat = pl.v * pl.v * _f2.k + P.WADDLE * pl.v * Math.sin(g.stepPhase) * 0.35;
    var lx = Math.cos(_f2.h), lz = -Math.sin(_f2.h);
    var ax = _f2.tx * pl.a + lx * lat, az = _f2.tz * pl.a + lz * lat;
    g.aF = pl.a; g.aL = lat;
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i];
      var sp = TT.stepDrink(c.def, c.st, ax, az, h);
      if (sp > 0) c.frameSpill += sp;
    }
  }

  function tutorial(dt) {
    var pl = g.player, seen = g.seen, changed = false;
    if (!seen.walk) {
      if (g.hold) g.holdT += dt; else g.holdT = 0;
      if (g.holdT > 0.35) { seen.walk = true; changed = true; U.hideHint(); }
    } else if (!seen.stop && !g.hold && pl.v > 0.6) {
      seen.stop = true; changed = true;
      U.showHint('Release to stop. Ease in, ease out — sloshing spills!', 3.4);
    }
    if (U.hintT <= 0.3) {
      for (var i = 0; i < hazards.length; i++) {
        var hz = hazards[i];
        if (!hz.hint || seen['h' + i]) continue;
        if (pl.s > hz.s - 9 && pl.s < hz.s + 2) {
          seen['h' + i] = true; changed = true;
          U.showHint(hz.hint, 3.6);
          break;
        }
      }
    }
    if (!seen.corner && Math.abs(g.aL) > 2.4 && g.cups[0].st.near > 0.5 && U.hintT <= 0.3) {
      seen.corner = true; changed = true;
      U.showHint('Slow down for corners — the wine is sloshing!', 3.2);
    }
    if (changed) TT.storage.set('tt_seen', seen);
  }

  function handleSpills(dt) {
    var pl = g.player, panic = 0;
    path.sample(pl.s, _f);
    var hc = Math.cos(_f.h), hs = Math.sin(_f.h);
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i], st = c.st;
      c.frac = TT.drinkFrac(c.def, st);
      c.recent = Math.max(0, c.recent - dt * 0.12);
      c.popCD -= dt;
      panic = Math.max(panic, st.near);
      if (c.frameSpill > 0) {
        c.recent += c.frameSpill;
        c.dropAcc += c.frameSpill * 90;
        // local slope direction -> world direction of the high side
        var slx = st.sx * hc - st.sz * hs, slz = st.sx * hs + st.sz * hc;
        var sl = Math.hypot(slx, slz) || 1, ux = slx / sl, uz = slz / sl;
        var wx = ux * hc + uz * hs, wz = -ux * hs + uz * hc;
        var n = 0;
        while (c.dropAcc >= 1 && n < 7) {
          c.dropAcc -= 1; n++;
          var jx = ux + (Math.random() - 0.5) * 0.5, jz = uz + (Math.random() - 0.5) * 0.5;
          D.rimPoint(c, jx, jz, _v);
          var sp = 0.7 + Math.random() * 0.9;
          F.drop(_v.x, _v.y, _v.z, wx * sp + _f.tx * pl.v * 0.9, 0.5 + Math.random() * 1.1, wz * sp + _f.tz * pl.v * 0.9, c.def.color);
        }
        if (g.time - g.lastSplash > 0.14) {
          g.lastSplash = g.time;
          A.play('splash', TT.clamp(c.frameSpill * 30, 0.18, 0.9), 0.85 + Math.random() * 0.35);
        }
        if (c.recent > 0.04 && c.popCD <= 0) {
          c.popCD = 1.2;
          F.pop(TT.pick(['SPLOSH!', 'SLOSH!', 'SPLISH!', 'GLUG!']), _v.x, _v.y + 0.3, _v.z, 'spill c-' + c.def.id);
          reactNearby(4.5, 0.5);
          if (!g.seen.spill && U.hintT <= 0.3) {
            g.seen.spill = true; TT.storage.set('tt_seen', g.seen);
            U.showHint('Whoa! Jerky starts, stops and fast corners slosh drinks over the rim.', 3.6);
          }
        }
        c.frameSpill = 0;
      } else if (st.near > 0.82 && g.time - c.lastRattle > 0.45) {
        c.lastRattle = g.time;
        A.rattle(0.14 + st.near * 0.08);
      }
    }
    g.panic = TT.damp(g.panic, panic > 0.55 ? panic : 0, 8, dt);
  }

  function collide() {
    var pl = g.player;
    if (g.mode !== 'play') return;
    var px = goblin.root.position.x, pz = goblin.root.position.z;
    for (var i = 0; i < hazards.length; i++) {
      var hz = hazards[i], cs = hz.circles;
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j];
        if (c.r < 0.01) continue;
        var dx = px - c.x, dz = pz - c.z, d = Math.sqrt(dx * dx + dz * dz);
        var edge = d - (PR + c.r);
        if (edge < 0) {
          if (pl.invuln <= 0) { bump(hz, c, j, d > 1e-4 ? dx / d : 0, d > 1e-4 ? dz / d : 1); return; }
        } else if (edge < NEAR && Math.abs(pl.v) > 0.8 && pl.invuln <= 0) {
          var key = i + ':' + (hz.name === 'barrels' ? 'b' + (c.idx || 0) : j);
          var last = g.nearCD[key] || -9;
          if (g.time - last > 2.2) { g.nearCD[key] = g.time; nearMiss(hz, c); }
        }
      }
    }
  }

  function bump(hz, c, idx, nx, nz) {
    var pl = g.player;
    pl.stun = P.STUN; pl.invuln = P.INVULN; pl.throttle = 0;
    path.sample(pl.s, _f);
    var along = nx * _f.tx + nz * _f.tz;
    pl.v = along > 0.35 ? 2.0 : -2.6;
    for (var i = 0; i < g.cups.length; i++) TT.kickDrink(g.cups[i].def, g.cups[i].st, nx * P.BUMP_DV, nz * P.BUMP_DV);
    // tray wobble
    var lx = Math.cos(_f.h), lz = -Math.sin(_f.h);
    tray.vX += (nx * _f.tx + nz * _f.tz) * 2.2;
    tray.vZ += -(nx * lx + nz * lz) * 2.2;
    tray.bounceV += 1.4;
    var px = goblin.root.position.x, pz = goblin.root.position.z;
    F.shake(0.62); F.dizzy(1.4);
    U.flashScreen('hit');
    F.pop(TT.pick(['OOF!', 'BONK!', 'WHUMP!', 'OOPS!']), px, 2.3, pz, 'bump');
    F.puff((px + c.x) / 2, 0.45, (pz + c.z) / 2, 0xeadcc4, 7);
    A.play('bump', 0.9, 0.9 + Math.random() * 0.2);
    if (hz.name === 'crosser' || hz.name === 'dance') {
      var pitch = hz.name === 'dance' ? 0.86 : (hz.person && hz.person.kind === 'elf' ? 1.16 : hz.person && hz.person.kind === 'orc' ? 0.8 : 1);
      A.voice('oi', 1.0, pitch);
    } else if (hz.name === 'cat') A.hiss(0.7);
    else if (hz.name === 'dragon') { A.snore(0.5); A.slam(0.4); }
    else if (hz.name === 'barrels') A.thump(0.8);
    if (hz.onHit) hz.onHit(c.idx !== undefined ? c.idx : idx, hazardCtx());
    g.bumps++;
    g.lastBumpT = g.time;
    g.pendingShave = null;
    g.hitStop = 0.09;
    reactNearby(5, 1);
  }

  function nearMiss(hz, c) {
    if (g.pendingShave || g.time - (g.lastBumpT || -9) < 1.0) return;
    g.pendingShave = { t: g.time };
    A.whoosh(0.5);
    g.slowmo = 0.2;
  }
  function confirmShaves() {
    var ps = g.pendingShave;
    if (!ps) return;
    if ((g.lastBumpT || -9) > ps.t - 0.05) { g.pendingShave = null; return; }
    if (g.time - ps.t < 0.55) return;
    g.pendingShave = null;
    g.shaves++;
    g.bonusTips += 15;
    F.pop('CLOSE SHAVE! +15', goblin.root.position.x, 2.4, goblin.root.position.z, 'bonus', 1.2);
    A.coin(0.4, 7);
  }

  function onSlam(strength, hz) {
    if (g.mode !== 'play') return;
    var a = Math.random() * Math.PI * 2, dv = P.SLAM_DV * strength;
    for (var i = 0; i < g.cups.length; i++) TT.kickDrink(g.cups[i].def, g.cups[i].st, Math.cos(a) * dv, Math.sin(a) * dv);
    tray.bounceV += 2.4 * strength;
    tray.vX += (Math.random() - 0.5) * 2.5 * strength;
    tray.vZ += (Math.random() - 0.5) * 2.5 * strength;
    F.pop('BOOM!', hz.tx, 1.9, hz.tz, 'boom', 0.9);
  }

  function reactNearby(range, amt) {
    var px = goblin.root.position.x, pz = goblin.root.position.z;
    for (var i = 0; i < crowd.people.length; i++) {
      var p = crowd.people[i];
      if (!p.ambient) continue;
      var dx = p.x - px, dz = p.z - pz;
      if (dx * dx + dz * dz < range * range) p.react = Math.max(p.react, amt * (0.6 + Math.random() * 0.4));
    }
  }

  // ---------------------------------------------------------------- delivery + fail
  function computeResult(fail, reason) {
    var lines = [], total = 0;
    var labels = { wine: 'Moonberry Wine', ale: 'Frothy Ale', fizz: 'Pixie Fizz' };
    if (!fail) {
      for (var i = 0; i < g.cups.length; i++) {
        var c = g.cups[i], pct = Math.max(0, Math.round(c.frac * 100));
        lines.push({ k: labels[c.def.id] + ' <em>' + pct + '%</em>', v: '+' + pct, cls: 'd-' + c.def.id });
        total += pct;
      }
      var tb = Math.round(Math.max(0, g.timeLeft) * 2);
      lines.push({ k: 'Speedy service <em>' + Math.ceil(Math.max(0, g.timeLeft)) + 's left</em>', v: '+' + tb });
      total += tb;
      if (g.shaves > 0) { lines.push({ k: 'Close shaves <em>&times;' + g.shaves + '</em>', v: '+' + g.bonusTips }); total += g.bonusTips; }
      var perfect = g.cups.every(function (c) { return c.frac >= 0.985; });
      if (perfect) { lines.push({ k: 'Not a single drop!', v: '+100', cls: 'gold' }); total += 100; }
      if (g.bumps === 0) { lines.push({ k: 'Nobody bumped', v: '+50', cls: 'gold' }); total += 50; }
      else { lines.push({ k: 'Bumped patrons <em>&times;' + g.bumps + '</em>', v: '&minus;' + g.bumps * 25, cls: 'bad' }); total -= g.bumps * 25; }
      total = Math.max(0, total);
    } else {
      lines.push({ k: reason === 'dry' ? 'Every drink spilled' : 'Customers left thirsty', v: '0', cls: 'dim' });
      lines.push({ k: 'Tips', v: '0', cls: 'dim' });
    }
    var newBest = !fail && total > g.best;
    var res = {
      fail: fail, lines: lines, total: total, newBest: newBest, best: g.best,
      rank: fail ? { name: reason === 'dry' ? 'BONE DRY' : 'TOO SLOW', col: '#b8322a' } : U.rankFor(total),
      failTitle: reason === 'dry' ? 'Bone dry!' : 'Too slow!',
      failTip: reason === 'dry' ? 'Tip: hold gently, and let go early before you stop.' : 'Tip: hustle on the straights, ease off near crowds.'
    };
    if (newBest) {
      g.best = total; res.best = total;
      TT.storage.set('tt_best', total);
      g.ghostData = { dt: 0.05, s: g.rec.slice(0, 1400) };
      TT.storage.set('tt_ghost', g.ghostData);
    }
    return res;
  }

  function deliver() {
    g.mode = 'deliver'; g.t = 0;
    g.player.v = 0; g.player.s = path.length;
    for (var i = 0; i < g.cups.length; i++) g.cups[i].frac = TT.drinkFrac(g.cups[i].def, g.cups[i].st);
    g.result = computeResult(false);
    A.fanfare(0.7);
    A.play('cheer', 0.85);
    A.setMusic(0.3, 1);
    F.pop('DELIVERED!', null, 0, 0, 'big gold', 1.4);
    U.flashScreen('gold');
    U.hideHint();
    // customers react to their drinks
    var cust = TT.world.customers;
    for (var k = 0; k < cust.length; k++) {
      var cup = cupById(cust[k].drink);
      var fr = cup ? cup.frac : 0;
      cust[k].fr = fr;
    }
    // tray travels to the table
    tray.deliver = { from: tray.group.position.clone(), t: 0 };
    goblin.cheer = 0;
  }

  function cupById(id) { for (var i = 0; i < g.cups.length; i++) if (g.cups[i].def.id === id) return g.cups[i]; return null; }

  function updateDeliver(dt) {
    var T = g.t, ht = TT.world.highTable;
    placeGoblin(path.length);
    var cust = TT.world.customers;
    // cups hop to their owners
    if (T > 0.75) {
      for (var i = 0; i < cust.length; i++) {
        var c = cupById(cust[i].drink);
        if (!c) continue;
        var start = 0.75 + i * 0.16;
        if (T >= start && !c.hop) {
          c.group.updateMatrixWorld(true);
          scene.attach(c.group);
          c.hop = { from: c.group.position.clone(), to: new THREE.Vector3(cust[i].seat.x, ht.top + 0.05, cust[i].seat.z), t: 0, rot: c.group.rotation.y };
          A.clink(0.4, 1.1 + i * 0.12);
        }
        if (c.hop && c.hop.t < 1) {
          c.hop.t = Math.min(1, c.hop.t + dt / 0.38);
          var k = TT.easeInOutSine(c.hop.t);
          c.group.position.lerpVectors(c.hop.from, c.hop.to, k);
          c.group.position.y += Math.sin(Math.PI * c.hop.t) * 0.45;
          c.group.rotation.set(0, c.hop.rot, 0);
          if (c.hop.t >= 1) {
            var fr = cust[i].fr;
            if (fr >= 0.75) { cust[i].p.cheerTarget = 1; F.pop(fr >= 0.985 ? 'PERFECT!' : 'CHEERS!', cust[i].p.x, 2.1, cust[i].p.z, 'cheer'); }
            else if (fr >= 0.35) { cust[i].p.cheerTarget = 0.45; F.pop('Meh.', cust[i].p.x, 2.0, cust[i].p.z, 'meh'); }
            else { cust[i].p.mood = -1; F.pop(fr < 0.03 ? 'EMPTY?!' : 'Hmph!', cust[i].p.x, 2.0, cust[i].p.z, 'grr'); }
          }
        }
      }
    }
    if (T > 1.5 && T - dt <= 1.5) {
      F.coinBurst(ht.x, ht.top + 0.3, ht.z, Math.min(50, 10 + Math.round(g.result.total / 12)), 0, 0);
      A.play('coins', 0.8);
      goblin.cheer = 1;
      // the tavern cheers
      for (var q = 0; q < crowd.people.length; q++) {
        var p = crowd.people[q];
        if (!p.ambient) continue;
        var d = Math.hypot(p.x - ht.x, p.z - ht.z);
        if (d < 12 && Math.random() < 0.8) p.cheerTarget = 0.6 + Math.random() * 0.4;
      }
    }
    deliverCam(dt);
    if (T > 2.5) {
      g.mode = 'results'; g.t = 0;
      U.show('result-hud');
      U.result.classList.remove('hidden');
      U.showReceipt(g.result, A);
      U.showBest();
    }
  }

  function fail(reason) {
    g.mode = 'fail'; g.t = 0; g.failReason = reason;
    g.result = computeResult(true, reason);
    A.trombone(0.8);
    A.setMusic(0.15, 0.92);
    F.pop(reason === 'dry' ? 'BONE DRY!' : 'TOO SLOW!', null, 0, 0, 'big warn', 1.6);
    U.hideHint();
    goblin.sad = 1;
    var cust = TT.world.customers;
    for (var i = 0; i < cust.length; i++) cust[i].p.mood = -1;
  }

  function updateFail(dt) {
    var pl = g.player;
    // coast to a stop
    TT.stepPlayer(pl, false, dt);
    if (pl.s < 0) pl.s = 0;
    placeGoblin(pl.s);
    failCam(dt);
    if (g.t > 1.9) {
      g.mode = 'results'; g.t = 0;
      U.show('result-hud');
      U.result.classList.remove('hidden');
      U.showReceipt(g.result, A);
    }
  }

  function updateResults(dt) {
    if (g.result && g.result.fail) failCam(dt); else deliverCam(dt);
    // customers calm down slowly
    if (g.t > 4) for (var i = 0; i < crowd.people.length; i++) if (crowd.people[i].ambient) crowd.people[i].cheerTarget = 0;
  }

  // ---------------------------------------------------------------- goblin + tray
  function animateGoblinFrame(dt) {
    var pl = g.player;
    var moving = g.mode === 'play' || g.mode === 'fail';
    C.animateGoblin(goblin, {
      dt: dt, time: g.time, speed: moving ? pl.v : 0, accel: moving ? pl.a : 0,
      panic: g.mode === 'play' ? g.panic : 0, dizzy: F.starT > 0 ? Math.min(1, F.starT) : 0,
      headYaw: g.mode === 'title' ? Math.sin(g.time * 0.7) * 0.35 : 0,
      lookUp: g.mode === 'fail' && g.failReason === 'dry' ? 1 : (g.panic > 0.6 ? 0.5 : 0)
    });
    // invulnerability blink (body only, never the tray)
    var blink = pl.invuln > 0 && g.mode === 'play' && Math.floor(g.time * 14) % 2 === 0;
    goblin.hips.visible = !blink;
  }

  function placeTray(dt) {
    goblin.root.updateMatrixWorld(true);
    var palm = goblin.armR.localToWorld(_v.copy(PALM));
    // tilt spring driven by the goblin's acceleration
    var inPlay = g.mode === 'play';
    var tgtX = inPlay ? TT.clamp(-g.aF * 0.02, -0.09, 0.09) : 0;
    var tgtZ = inPlay ? TT.clamp(g.aL * 0.02, -0.08, 0.08) : 0;
    tray.vX += ((tgtX - tray.tiltX) * 110 - tray.vX * 10) * dt;
    tray.vZ += ((tgtZ - tray.tiltZ) * 110 - tray.vZ * 10) * dt;
    tray.tiltX += tray.vX * dt; tray.tiltZ += tray.vZ * dt;
    tray.tiltX = TT.clamp(tray.tiltX, -0.25, 0.25); tray.tiltZ = TT.clamp(tray.tiltZ, -0.25, 0.25);
    tray.bounceV += (-tray.bounceY * 160 - tray.bounceV * 12) * dt;
    tray.bounceY += tray.bounceV * dt;
    var yaw = goblin.root.rotation.y;
    if (tray.deliver) {
      var D0 = tray.deliver, ht = TT.world.highTable;
      D0.t = Math.min(1, D0.t + dt / 0.7);
      var k = TT.easeInOutSine(D0.t);
      var tx = TT.lerp(palm.x, ht.x, k), tz = TT.lerp(palm.z, ht.z, k);
      var ty = TT.lerp(palm.y, ht.top + 0.05, k) + Math.sin(Math.PI * D0.t) * 0.25;
      tray.group.position.set(tx, ty, tz);
      tray.group.rotation.set(0, yaw, 0, 'YXZ');
      return;
    }
    tray.group.position.set(palm.x, palm.y + tray.bounceY * 0.12, palm.z);
    tray.group.rotation.set(tray.tiltX, yaw, tray.tiltZ, 'YXZ');
  }

  function updateDrinkVisuals(dt, time) {
    var yaw = tray.group.rotation.y, hc = Math.cos(yaw), hs = Math.sin(yaw);
    var tanX = Math.tan(tray.tiltX), tanZ = Math.tan(tray.tiltZ);
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i], st = c.st;
      if (g.mode !== 'play' && g.mode !== 'intro') {
        // relax sloshing when not being carried
        var k = Math.exp(-3 * dt);
        st.sx *= k; st.sz *= k; st.vx *= k; st.vz *= k;
      }
      var slx = st.sx * hc - st.sz * hs, slz = st.sx * hs + st.sz * hc;
      if (!c.hop) { slx -= tanZ; slz += tanX; }
      D.updateLiquid(c, slx, slz, dt, time);
      // nervous rattle when the liquid is at the rim
      if (g.mode === 'play' && st.near > 0.8 && !c.hop) {
        var j = (st.near - 0.8) * 0.02;
        c.group.position.x = c.def.pos[0] + (Math.random() - 0.5) * j;
        c.group.position.z = c.def.pos[2] + (Math.random() - 0.5) * j;
      } else if (!c.hop && c.group.parent === tray.group && g.mode === 'play') {
        c.group.position.x = c.def.pos[0]; c.group.position.z = c.def.pos[2];
      }
    }
  }

  function updateGhost(dt) {
    var gd = g.ghostData;
    var show = !!g.ghostOn && !!gd && !!gd.s && (g.mode === 'play' || g.mode === 'intro');
    ghost.root.visible = show; ghostTray.visible = show;
    if (!show) { g.ghostProgress = null; return; }
    var t = g.mode === 'play' ? g.runTime : 0;
    var f = t / gd.dt, i = Math.floor(f), n = gd.s.length;
    var s0 = gd.s[Math.min(n - 1, i)], s1 = gd.s[Math.min(n - 1, i + 1)];
    var s = s0 + (s1 - s0) * (f - i);
    var v = (s1 - s0) / gd.dt;
    path.sample(s, _f3);
    ghost.root.position.set(_f3.x, 0, _f3.z);
    ghost.root.rotation.y = _f3.h;
    C.animateGoblin(ghost, { dt: dt, time: g.time, speed: g.mode === 'play' ? v : 0, accel: 0, panic: 0, dizzy: 0 });
    ghost.root.updateMatrixWorld(true);
    var palm = ghost.armR.localToWorld(_v2.copy(PALM));
    ghostTray.position.set(palm.x, palm.y + 0.025, palm.z);
    ghostTray.rotation.y = _f3.h;
    // fade the ghost when it's right on top of the player
    var d = Math.abs(s - g.player.s);
    C.ghostMat().opacity = TT.clamp(d / 2.5, 0.05, 1) * 0.24;
    g.ghostProgress = s / path.length;
  }

  var _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function blob(i, x, z, s) {
    _p.set(x, 0.013, z); _s.set(s, 1, s);
    blobMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  function updateBlobs() {
    var i = 0, ppl = crowd.people;
    _q.identity();
    for (; i < ppl.length; i++) {
      var p = ppl[i];
      blob(i, p.x, p.z, 0.95 * p.scale * Math.max(0.9, p.width * 0.8));
    }
    blob(i++, goblin.root.position.x, goblin.root.position.z, 0.95);
    if (ghost.root.visible) blob(i++, ghost.root.position.x, ghost.root.position.z, 0.6); else blobMesh.setMatrixAt(i++, ZERO);
    for (var h = 0; h < hazards.length; h++) {
      var hz = hazards[h];
      if (hz.name === 'cat') { blob(i++, hz.cat.root.position.x, hz.cat.root.position.z, 0.7); blob(i++, hz.mouse.root.position.x, hz.mouse.root.position.z, 0.25); }
      if (hz.name === 'barrels') {
        for (var b = 0; b < hz.barrels.length; b++) {
          var B = hz.barrels[b];
          if (B.active && B.y < 0.3) blob(i++, B.mesh.position.x, B.mesh.position.z, 1.0); else blobMesh.setMatrixAt(i++, ZERO);
        }
      }
    }
    while (i < blobMesh.count) blobMesh.setMatrixAt(i++, ZERO);
    blobMesh.instanceMatrix.needsUpdate = true;
  }

  function updateLights(time) {
    var L = TT.world.ctx.lights;
    for (var i = 0; i < L.length; i++) {
      var l = L[i];
      var f = 1 + (TT.noise1(time * (l.fire ? 7 : 3) + i * 13) * l.flick);
      l.light.intensity = l.base * f;
    }
  }

  // ---------------------------------------------------------------- cameras
  var camTarget = { pos: new THREE.Vector3(0, 3, 10), look: new THREE.Vector3(), sideShift: 0, fovAdd: 0, lambda: 7 };
  var camState = { pos: new THREE.Vector3(0, 3, 10), look: new THREE.Vector3(0, 1, 0), init: false };

  function chaseCam(dt, snap) {
    var pl = g.player;
    path.sample(Math.max(0, pl.s), _f);
    if (snap) g.camH = _f.h; else g.camH = TT.angleDamp(g.camH, _f.h, 4.5, dt);
    var portrait = camera.aspect < 0.85;
    var back = portrait ? 5.0 : 4.3, hgt = portrait ? 4.2 : 3.55, ahead = portrait ? 6.0 : 7.5;
    var gp = goblin.root.position;
    camTarget.pos.set(gp.x - Math.sin(g.camH) * back, hgt, gp.z - Math.cos(g.camH) * back);
    path.sample(pl.s + ahead, _f3);
    // mostly look along our own heading, peeking a little into upcoming curves
    var hx = gp.x + Math.sin(g.camH) * ahead, hz = gp.z + Math.cos(g.camH) * ahead;
    camTarget.look.set(TT.lerp(hx, _f3.x, 0.32), 0.55, TT.lerp(hz, _f3.z, 0.32));
    camTarget.sideShift = 0;
    camTarget.fovAdd = Math.abs(pl.v) * 1.1;
    camTarget.lambda = g.mode === 'intro' ? 3.2 : 7;
  }

  function deliverCam(dt) {
    var ht = TT.world.highTable;
    path.sample(path.length, _f);
    var side = 1;
    camTarget.pos.set(ht.x - _f.tx * 2.6 + _f.rx * side * 2.6, 2.4, ht.z - _f.tz * 2.6 + _f.rz * side * 2.6);
    camTarget.look.set(ht.x - _f.tx * 0.4, 1.0, ht.z - _f.tz * 0.4);
    camTarget.sideShift = camera.aspect > 1.1 && g.mode === 'results' ? -1.1 : 0;
    camTarget.fovAdd = 0;
    camTarget.lambda = 2.6;
  }

  function failCam(dt) {
    var gp = goblin.root.position;
    path.sample(g.player.s, _f);
    var a = _f.h + 0.6 + Math.sin(g.time * 0.3) * 0.15;
    camTarget.pos.set(gp.x + Math.sin(a) * 3.0, 1.9, gp.z + Math.cos(a) * 3.0);
    camTarget.look.set(gp.x, 1.25, gp.z);
    camTarget.sideShift = camera.aspect > 1.1 && g.mode === 'results' ? -1.0 : 0;
    camTarget.fovAdd = 0;
    camTarget.lambda = 3;
  }

  function applyCamera(dt) {
    if (!camState.init) { camState.pos.copy(camTarget.pos); camState.look.copy(camTarget.look); camState.init = true; }
    var k = 1 - Math.exp(-camTarget.lambda * dt);
    camState.pos.lerp(camTarget.pos, k);
    camState.look.lerp(camTarget.look, k);
    camState.side = TT.damp(camState.side || 0, camTarget.sideShift, 3, dt);
    // side shift: move the look point to the camera's left so the subject sits right of centre
    _v.subVectors(camState.look, camState.pos).normalize();
    var lx = _v.z, lz = -_v.x; // left vector (up x dir)
    var look = _v2.set(camState.look.x + lx * camState.side, camState.look.y, camState.look.z + lz * camState.side);
    F.shakeOffset(g.time, _shake);
    camera.position.set(camState.pos.x + _shake.x, camState.pos.y + _shake.y, camState.pos.z + _shake.z);
    camera.lookAt(look);
    var baseFov = camera.aspect < 0.85 ? 64 : 52;
    var fov = TT.damp(camera.fov, baseFov + camTarget.fovAdd, 4, dt);
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); updateGlowScale(); }
  }

  TT.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
