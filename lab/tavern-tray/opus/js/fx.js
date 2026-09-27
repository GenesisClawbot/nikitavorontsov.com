/* Tipsy Tray — juice: droplets, puddles, dust puffs, splinters, coins, dizzy stars, floating text, camera shake */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx;
  var F = (TT.fx = {});
  var _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  var _c = new THREE.Color();
  var ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  function Pool(mesh, n) {
    this.mesh = mesh; this.n = n; this.items = [];
    for (var i = 0; i < n; i++) { this.items.push({ alive: false }); mesh.setMatrixAt(i, ZERO); }
    this.next = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  Pool.prototype.spawn = function () {
    for (var k = 0; k < this.n; k++) {
      var i = (this.next + k) % this.n;
      if (!this.items[i].alive) { this.next = (i + 1) % this.n; this.items[i].alive = true; this.items[i].i = i; return this.items[i]; }
    }
    var j = this.next; this.next = (j + 1) % this.n;
    this.items[j].alive = true; this.items[j].i = j;
    return this.items[j];
  };
  Pool.prototype.clear = function () {
    for (var i = 0; i < this.n; i++) { this.items[i].alive = false; this.mesh.setMatrixAt(i, ZERO); }
    this.mesh.instanceMatrix.needsUpdate = true;
  };

  F.init = function (scene, camera) {
    F.scene = scene; F.camera = camera;
    // droplets
    var dm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), G.toon(0xffffff, { emissive: 0x221108 }), 180);
    dm.setColorAt(0, _c.set(0xffffff));
    scene.add(dm);
    F.drops = new Pool(dm, 180);
    // puddles
    var pm = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 90);
    pm.setColorAt(0, _c.set(0xffffff));
    pm.renderOrder = 1;
    scene.add(pm);
    F.puddles = new Pool(pm, 90);
    // dust puffs
    var um = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }), 60);
    um.setColorAt(0, _c.set(0xffffff));
    scene.add(um);
    F.puffs = new Pool(um, 60);
    // splinters
    var sm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), G.toon(0x9c6632), 40);
    scene.add(sm);
    F.splints = new Pool(sm, 40);
    // coins
    var cg = new THREE.CylinderGeometry(1, 1, 0.25, 14);
    G.withOutline(cg, 0.25);
    var cm = new THREE.InstancedMesh(cg, G.toon(0xf5c542, { emissive: 0x3a2400 }), 60);
    scene.add(cm);
    F.coins = new Pool(cm, 60);
    // dizzy stars
    F.stars = [];
    var smat = new THREE.SpriteMaterial({ map: G.texStar(), transparent: true, depthWrite: false });
    for (var i = 0; i < 3; i++) {
      var sp = new THREE.Sprite(smat);
      sp.scale.set(0.2, 0.2, 1); sp.visible = false;
      scene.add(sp);
      F.stars.push(sp);
    }
    F.starT = 0;
    // flames in the hearth (additive cones)
    F.flames = [];
    if (TT.world.fire) {
      var fmat1 = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      var fmat2 = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (var k = 0; k < 7; k++) {
        var fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 8, 1, true), k % 2 ? fmat2 : fmat1);
        fl.position.set(TT.world.fire.x + (k - 3) * 0.28, 0.55, TT.world.fire.z + 0.1 + (k % 3) * 0.08);
        fl.userData.ph = k * 1.7;
        fl.userData.h = 0.6 + (3 - Math.abs(k - 3)) * 0.22;
        scene.add(fl);
        F.flames.push(fl);
      }
    }
    // dust motes floating in the lamplight
    var n = 260, mp = new Float32Array(n * 3);
    for (var j = 0; j < n; j++) { mp[j * 3] = (Math.random() - 0.5) * 22; mp[j * 3 + 1] = Math.random() * 5; mp[j * 3 + 2] = (Math.random() - 0.5) * 22; }
    var mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    F.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    F.motes.frustumCulled = false;
    scene.add(F.motes);
    F.shakeAmt = 0;
    F.popLayer = document.getElementById('pops');
    F.popsLive = [];
  };

  F.reset = function () {
    F.drops.clear(); F.puddles.clear(); F.puffs.clear(); F.splints.clear(); F.coins.clear();
    F.starT = 0;
    for (var i = 0; i < F.popsLive.length; i++) if (F.popsLive[i].el.parentNode) F.popsLive[i].el.parentNode.removeChild(F.popsLive[i].el);
    F.popsLive.length = 0;
  };

  F.drop = function (x, y, z, vx, vy, vz, color, size) {
    var d = F.drops.spawn();
    d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.r = size || (0.022 + Math.random() * 0.02); d.color = color;
    F.drops.mesh.setColorAt(d.i, _c.set(color));
    F.drops.mesh.instanceColor.needsUpdate = true;
  };

  F.puddle = function (x, z, color, size) {
    var p = F.puddles.spawn();
    p.x = x; p.z = z; p.r = 0; p.target = size; p.age = 0; p.y = 0.014 + Math.random() * 0.004;
    p.sx = 0.8 + Math.random() * 0.5;
    F.puddles.mesh.setColorAt(p.i, _c.set(color).multiplyScalar(0.8));
    F.puddles.mesh.instanceColor.needsUpdate = true;
  };

  F.puff = function (x, y, z, color, count) {
    for (var i = 0; i < count; i++) {
      var p = F.puffs.spawn();
      var a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
      p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 0.3 + Math.random() * 0.8;
      p.age = 0; p.life = 0.5 + Math.random() * 0.4; p.size = 0.12 + Math.random() * 0.14;
      F.puffs.mesh.setColorAt(p.i, _c.set(color || 0xe8d8c0));
    }
    F.puffs.mesh.instanceColor.needsUpdate = true;
  };

  F.splinters = function (x, y, z) {
    for (var i = 0; i < 12; i++) {
      var s = F.splints.spawn();
      var a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      s.x = x; s.y = y; s.z = z; s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = 1.5 + Math.random() * 2.5;
      s.rx = Math.random() * 6; s.ry = Math.random() * 6; s.w = (Math.random() - 0.5) * 20; s.age = 0; s.rest = false;
    }
    F.puff(x, y, z, 0xd8c3a0, 6);
  };

  F.coinBurst = function (x, y, z, n, towardX, towardZ) {
    for (var i = 0; i < n; i++) {
      var c = F.coins.spawn();
      var a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
      c.x = x; c.y = y; c.z = z;
      c.vx = Math.cos(a) * sp + (towardX || 0); c.vz = Math.sin(a) * sp + (towardZ || 0); c.vy = 3 + Math.random() * 3;
      c.rx = Math.random() * 6; c.w = 8 + Math.random() * 12; c.age = 0; c.rest = false;
    }
  };

  F.dizzy = function (t) { F.starT = Math.max(F.starT, t); };
  F.shake = function (amt) { F.shakeAmt = Math.min(1.2, F.shakeAmt + amt); };

  // DOM floating text anchored to a world point (or screen centre when big)
  F.pop = function (text, x, y, z, cls, life) {
    var el = document.createElement('div');
    el.className = 'pop ' + (cls || '');
    var inner = document.createElement('span');
    inner.className = 'in';
    inner.textContent = text;
    inner.style.setProperty('--rot', ((Math.random() - 0.5) * 16).toFixed(1) + 'deg');
    el.appendChild(inner);
    F.popLayer.appendChild(el);
    var P = { el: el, x: x, y: y, z: z, age: 0, life: life || 1.1, world: x !== null && x !== undefined };
    F.popsLive.push(P);
    return P;
  };

  var _v = new THREE.Vector3();
  F.update = function (dt, time, cam) {
    var i, it, mesh;
    // droplets
    mesh = F.drops.mesh;
    for (i = 0; i < F.drops.n; i++) {
      it = F.drops.items[i];
      if (!it.alive) continue;
      it.vy -= 9.8 * dt;
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      if (it.y < 0.02) {
        it.alive = false; mesh.setMatrixAt(i, ZERO);
        if (Math.random() < 0.55) F.puddle(it.x, it.z, it.color, 0.08 + Math.random() * 0.12);
        continue;
      }
      var st = Math.min(2.2, 1 + Math.abs(it.vy) * 0.15);
      _q.identity(); _p.set(it.x, it.y, it.z); _s.set(it.r, it.r * st, it.r);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
    // puddles grow, then slowly shrink
    mesh = F.puddles.mesh;
    for (i = 0; i < F.puddles.n; i++) {
      it = F.puddles.items[i];
      if (!it.alive) continue;
      it.age += dt;
      it.r = TT.damp(it.r, it.target, 10, dt);
      var sh = it.age > 12 ? Math.max(0, 1 - (it.age - 12) / 6) : 1;
      if (sh <= 0) { it.alive = false; mesh.setMatrixAt(i, ZERO); continue; }
      _q.identity(); _p.set(it.x, it.y, it.z); _s.set(it.r * it.sx * sh, 1, it.r * sh);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
    // puffs
    mesh = F.puffs.mesh;
    for (i = 0; i < F.puffs.n; i++) {
      it = F.puffs.items[i];
      if (!it.alive) continue;
      it.age += dt;
      if (it.age > it.life) { it.alive = false; mesh.setMatrixAt(i, ZERO); continue; }
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      it.vx *= 0.92; it.vz *= 0.92; it.vy *= 0.95;
      var k = it.age / it.life, sz = it.size * (0.6 + k * 1.4) * (1 - k * k);
      _q.identity(); _p.set(it.x, it.y, it.z); _s.set(sz, sz, sz);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
    // splinters + coins (simple bouncy physics)
    var bodies = [F.splints, F.coins];
    for (var b = 0; b < 2; b++) {
      var pool = bodies[b]; mesh = pool.mesh;
      for (i = 0; i < pool.n; i++) {
        it = pool.items[i];
        if (!it.alive) continue;
        it.age += dt;
        var maxAge = b === 0 ? 3 : 4.5;
        if (it.age > maxAge) { it.alive = false; mesh.setMatrixAt(i, ZERO); continue; }
        if (!it.rest) {
          it.vy -= 9.8 * dt;
          it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
          it.rx += it.w * dt;
          var floorY = b === 0 ? 0.03 : 0.02;
          if (it.y < floorY) {
            it.y = floorY;
            if (Math.abs(it.vy) > 1.2) { it.vy = -it.vy * 0.35; it.vx *= 0.6; it.vz *= 0.6; it.w *= 0.5; }
            else { it.rest = true; it.rx = b === 1 ? 0 : it.rx; }
          }
        }
        var fade = it.age > maxAge - 0.6 ? (maxAge - it.age) / 0.6 : 1;
        _e.set(it.rx, it.ry || 0, b === 1 ? Math.PI / 2 * (it.rest ? 0 : 1) : 0);
        _q.setFromEuler(_e); _p.set(it.x, it.y, it.z);
        if (b === 0) _s.set(0.05 * fade, 0.03 * fade, 0.22 * fade); else _s.set(0.075 * fade, 0.075 * fade, 0.075 * fade);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // stars
    if (F.starT > 0) F.starT -= dt;
    // flames
    for (i = 0; i < F.flames.length; i++) {
      var fl = F.flames[i], ph = fl.userData.ph;
      var hh = fl.userData.h * (0.75 + 0.25 * Math.sin(time * 9 + ph) + 0.12 * Math.sin(time * 23 + ph * 2));
      fl.scale.set(0.9 + 0.2 * Math.sin(time * 7 + ph), hh, 0.9);
      fl.position.y = 0.35 + hh / 2;
      fl.rotation.z = Math.sin(time * 5 + ph) * 0.12;
    }
    // motes drift around the camera
    if (cam) {
      F.motes.position.set(Math.round(cam.position.x / 22) * 22, 0, Math.round(cam.position.z / 22) * 22);
      F.motes.rotation.y = time * 0.01;
    }
    // shake decays
    F.shakeAmt = Math.max(0, F.shakeAmt - dt * 1.6);
    // pops
    for (i = F.popsLive.length - 1; i >= 0; i--) {
      var P = F.popsLive[i];
      P.age += dt;
      if (P.age > P.life) { if (P.el.parentNode) P.el.parentNode.removeChild(P.el); F.popsLive.splice(i, 1); continue; }
      if (P.world && cam) {
        _v.set(P.x, P.y + P.age * 0.5, P.z).project(cam);
        if (_v.z > 1) { P.el.style.display = 'none'; continue; }
        P.el.style.display = '';
        var sx = (_v.x * 0.5 + 0.5) * window.innerWidth, sy = (-_v.y * 0.5 + 0.5) * window.innerHeight;
        P.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-50%)';
      }
    }
  };

  F.updateStars = function (hx, hy, hz, time) {
    var on = F.starT > 0;
    for (var i = 0; i < F.stars.length; i++) {
      var s = F.stars[i];
      s.visible = on;
      if (!on) continue;
      var a = time * 7 + i * Math.PI * 2 / 3;
      s.position.set(hx + Math.cos(a) * 0.32, hy + Math.sin(time * 5 + i) * 0.05, hz + Math.sin(a) * 0.32);
      var sc = 0.18 * Math.min(1, F.starT * 2);
      s.scale.set(sc, sc, 1);
    }
  };

  F.shakeOffset = function (time, out) {
    var s = F.shakeAmt * F.shakeAmt * (TT.reducedMotion ? 0.3 : 1);
    out.x = TT.noise1(time * 23) * 0.35 * s;
    out.y = TT.noise1(time * 29 + 7) * 0.25 * s;
    out.z = TT.noise1(time * 19 + 3) * 0.2 * s;
    return out;
  };
})();
