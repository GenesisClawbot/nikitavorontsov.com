/* Tipsy Tray — tavern hazards. Each exposes: circles[{x,z,r}], zones (layout exclusion), update(), reset(), onHit() */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx, C = TT.chars;
  var H = (TT.hazards = {});
  var M = G.M;

  function frame(path, s) { return path.sample(s, {}); }
  function laneZones(zones, cx, cz, dx, dz, a, b, r) {
    for (var u = a; u <= b + 0.001; u += 0.9) zones.push({ x: cx + dx * u, z: cz + dz * u, r: r });
  }

  // ------------------------------------------------------------------ patrons wandering across the aisle
  function Crosser(ctx, o) {
    this.name = 'crosser';
    this.o = o;
    var f = frame(ctx.path, o.s);
    var ang = o.angle || 0;
    this.cx = f.x; this.cz = f.z;
    this.dx = f.rx * Math.cos(ang) + f.tx * Math.sin(ang);
    this.dz = f.rz * Math.cos(ang) + f.tz * Math.sin(ang);
    this.W = o.halfWidth || 3.2;
    var po = C.randomPerson(ctx.rng, o.kind, { pose: 'walk', shirt: o.shirt || TT.pick(C.BRIGHT, ctx.rng), mug: !!o.mug });
    this.person = ctx.crowd.add(po);
    this.person.lookTarget = null;
    this.r = 0.34 * (po.scale || 1) * Math.max(1, (po.width || 1) * 0.9);
    this.circles = [{ x: 0, z: 0, r: this.r }];
    this.zones = [];
    laneZones(this.zones, this.cx, this.cz, this.dx, this.dz, -this.W, this.W, 1.1);
    this.ends = [
      { x: this.cx + this.dx * (this.W + 1.05), z: this.cz + this.dz * (this.W + 1.05) },
      { x: this.cx - this.dx * (this.W + 1.05), z: this.cz - this.dz * (this.W + 1.05) }
    ];
    this.voice = o.voice || 1;
    this.hint = o.hint || null;
    this.s = o.s;
  }
  Crosser.prototype.reset = function (r) {
    this.u = TT.randRange(-this.W, this.W, r);
    this.dir = r() < 0.5 ? 1 : -1;
    this.state = r() < 0.35 ? 'pause' : 'walk';
    this.timer = TT.randRange(0.2, 1.4, r);
    this.hitT = 0;
    this.face = this.dir;
    this.update(0, 0, null);
  };
  Crosser.prototype.update = function (dt, t, ctx) {
    var o = this.o, p = this.person;
    if (this.hitT > 0) {
      this.hitT -= dt;
      p.pose = 'stand';
      if (ctx) p.yaw = TT.angleDamp(p.yaw, Math.atan2(ctx.px - p.x, ctx.pz - p.z), 10, dt);
    } else if (this.state === 'walk') {
      this.u += this.dir * o.speed * dt;
      if (this.u > this.W) { this.u = this.W; this.state = 'pause'; this.timer = TT.randRange(o.pause[0], o.pause[1]); this.face = 1; this.dir = -1; }
      else if (this.u < -this.W) { this.u = -this.W; this.state = 'pause'; this.timer = TT.randRange(o.pause[0], o.pause[1]); this.face = -1; this.dir = 1; }
      p.pose = 'walk'; p.walkSpeed = o.speed;
      var wy = Math.atan2(this.dx * this.dir, this.dz * this.dir);
      p.yaw = TT.angleDamp(p.yaw, wy, 12, dt || 1);
    } else {
      this.timer -= dt;
      p.pose = 'stand';
      var fy = Math.atan2(this.dx * this.face, this.dz * this.face);
      p.yaw = TT.angleDamp(p.yaw, fy, 6, dt || 1);
      if (this.timer <= 0) this.state = 'walk';
    }
    p.x = this.cx + this.dx * this.u;
    p.z = this.cz + this.dz * this.u;
    this.circles[0].x = p.x; this.circles[0].z = p.z;
  };
  Crosser.prototype.onHit = function () {
    this.hitT = 0.75;
    this.person.react = 1;
  };
  H.Crosser = Crosser;

  // ------------------------------------------------------------------ ring of dancing dwarves
  function DanceRing(ctx, o) {
    this.name = 'dance';
    this.o = o; this.s = o.s;
    var f = frame(ctx.path, o.s);
    this.cx = f.x; this.cz = f.z;
    this.R = o.radius || 2.6;
    this.dancers = [];
    this.circles = [];
    var cols = [0xe0473b, 0x2b9bd6, 0xf2b933, 0x8e44c9, 0x2fb37a, 0xff7a3d];
    for (var i = 0; i < o.count; i++) {
      var kind = i % 2 ? 'dwarf' : TT.pick(['human', 'gnome', 'elf'], ctx.rng);
      var po = C.randomPerson(ctx.rng, kind, { pose: 'dance', shirt: cols[i % cols.length] });
      var p = ctx.crowd.add(po);
      this.dancers.push(p);
      this.circles.push({ x: 0, z: 0, r: 0.36 * Math.max(0.9, po.width || 1) * (po.scale || 1) });
    }
    this.zones = [{ x: this.cx, z: this.cz, r: this.R + 1.9 }];
    // dance floor decal
    var floor = new THREE.Mesh(new THREE.CircleGeometry(this.R + 1.0, 48), new THREE.MeshLambertMaterial({ map: G.texDanceFloor(), transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(this.cx, 0.004, this.cz);
    floor.renderOrder = -1;
    ctx.scene.add(floor);
    // fiddler + bard at the edge
    var side = o.bandSide || 1;
    var bx = this.cx + f.rx * side * (this.R + 1.5) - f.tx * 1.2, bz = this.cz + f.rz * side * (this.R + 1.5) - f.tz * 1.2;
    var bard = ctx.crowd.add(C.randomPerson(ctx.rng, 'elf', { pose: 'play', lute: true, shirt: 0x6b2f7a, hat: 'wizard', hatColor: 0x2f6b4f }));
    bard.x = bx; bard.z = bz; bard.yaw = Math.atan2(this.cx - bx, this.cz - bz);
    this.zones.push({ x: bx, z: bz, r: 1.2 });
    ctx.blobs.push({ x: bx, z: bz, s: 0.8 });
    this.hint = o.hint;
  }
  DanceRing.prototype.reset = function (r) {
    this.phase = r() * Math.PI * 2;
    this.dirSign = r() < 0.5 ? 1 : -1;
    this.update(0, 0, null);
  };
  DanceRing.prototype.update = function (dt, t, ctx) {
    var o = this.o;
    this.phase += dt * o.omega * this.dirSign;
    var n = this.dancers.length;
    for (var i = 0; i < n; i++) {
      var a = this.phase + i * Math.PI * 2 / n;
      var p = this.dancers[i];
      var wob = Math.sin(t * 3 + i) * 0.12;
      p.x = this.cx + Math.cos(a) * (this.R + wob);
      p.z = this.cz + Math.sin(a) * (this.R + wob);
      p.yaw = Math.atan2(-Math.sin(a) * this.dirSign, Math.cos(a) * this.dirSign) * 1;
      this.circles[i].x = p.x; this.circles[i].z = p.z;
    }
  };
  DanceRing.prototype.onHit = function (idx) { if (this.dancers[idx]) this.dancers[idx].react = 1; };
  H.DanceRing = DanceRing;

  // ------------------------------------------------------------------ barrels rolling out of the cellar
  function BarrelChute(ctx, o) {
    this.name = 'barrels';
    this.o = o; this.s = o.s;
    var f = frame(ctx.path, o.s);
    this.cx = f.x; this.cz = f.z; this.dx = f.rx * o.side; this.dz = f.rz * o.side; // +u points toward the ramp
    this.top = 7.2; this.bottom = 3.6; this.end = -4.6; this.rampH = 1.25;
    this.barrels = [];
    for (var i = 0; i < 4; i++) {
      var b = C.makeBarrel();
      b.visible = false;
      ctx.scene.add(b);
      this.barrels.push({ mesh: b, u: 0, y: 0, v: 0, roll: 0, active: false, burst: 0 });
    }
    this.circles = [];
    this.zones = [];
    laneZones(this.zones, this.cx, this.cz, this.dx, this.dz, this.end - 1, this.top + 1.5, 1.3);
    // static ramp + platform + hay pile go into the batch
    var yaw = Math.atan2(this.dx, this.dz);
    var rampLen = this.top - this.bottom, ang = Math.atan2(this.rampH, rampLen);
    var mid = (this.top + this.bottom) / 2;
    var rp = { x: this.cx + this.dx * mid, z: this.cz + this.dz * mid };
    var rot = new THREE.Matrix4().makeRotationY(yaw);
    var slope = new THREE.Matrix4().makeRotationX(-ang);
    var place = function (lx, ly, lz, sx, sy, sz, extra) {
      var m = new THREE.Matrix4().makeTranslation(rp.x, 0, rp.z).multiply(rot).multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz));
      if (extra) m.multiply(extra);
      m.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
      return m;
    };
    // ramp planks (local z runs along +u)
    ctx.batch.push({ geo: G.geo.box, m: place(0, this.rampH / 2 + 0.02, 0, 1.3, 0.08, Math.hypot(rampLen, this.rampH), slope), c: 0x8a5a2f, t: 0.02 });
    ctx.batch.push({ geo: G.geo.box, m: place(0.66, this.rampH / 2 + 0.1, 0, 0.1, 0.18, Math.hypot(rampLen, this.rampH), slope), c: 0x5c3a1c, t: 0.015 });
    ctx.batch.push({ geo: G.geo.box, m: place(-0.66, this.rampH / 2 + 0.1, 0, 0.1, 0.18, Math.hypot(rampLen, this.rampH), slope), c: 0x5c3a1c, t: 0.015 });
    // cellar platform with a trapdoor frame at the top
    var topOff = rampLen / 2 + 0.9;
    ctx.batch.push({ geo: G.geo.box, m: place(0, this.rampH / 2, topOff, 2.2, this.rampH, 1.8), c: 0x6b4423, t: 0.025 });
    ctx.batch.push({ geo: G.geo.box, m: place(0, this.rampH + 0.02, topOff, 1.5, 0.05, 1.2), c: 0x2a170c, t: 0 });
    // stacked barrels decor on the platform
    for (var k = 0; k < 3; k++) {
      ctx.batch.push({ geo: new THREE.CylinderGeometry(0.4, 0.4, 0.78, 14), m: place(-0.55 + k * 0.55, this.rampH + 0.4, topOff + 0.55, 1, 1, 1), c: 0x8b5a2b, t: 0.02 });
      ctx.batch.push({ geo: new THREE.TorusGeometry(0.42, 0.025, 6, 16), m: place(-0.55 + k * 0.55, this.rampH + 0.62, topOff + 0.55, 1, 1, 1, new THREE.Matrix4().makeRotationX(Math.PI / 2)), c: 0x505862, t: 0.01 });
    }
    // hay pile catching barrels on the far side
    var hp = { x: this.cx + this.dx * (this.end - 0.9), z: this.cz + this.dz * (this.end - 0.9) };
    for (var h = 0; h < 7; h++) {
      var hx = hp.x + Math.cos(h * 2.1) * 0.6, hz = hp.z + Math.sin(h * 2.1) * 0.6;
      ctx.batch.push({ geo: G.geo.sphereLo, m: M(hx, 0.25 + (h % 3) * 0.12, hz, 0, h, 0, 0.75, 0.5, 0.7), c: h % 2 ? 0xe8c15a : 0xd4a843, t: 0.02 });
    }
    ctx.blobs.push({ x: hp.x, z: hp.z, s: 2.2 });
    this.zones.push({ x: hp.x, z: hp.z, r: 1.8 });
    this.hp = hp;
    this.hint = o.hint;
    this.pattern = o.pattern || [1.35, 1.35, 3.2];
  }
  BarrelChute.prototype.reset = function (r) {
    for (var i = 0; i < this.barrels.length; i++) { this.barrels[i].active = false; this.barrels[i].mesh.visible = false; }
    this.pi = Math.floor(r() * this.pattern.length);
    this.timer = r() * 2.5;
    this.circles.length = 0;
  };
  BarrelChute.prototype.update = function (dt, t, ctx) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer += this.pattern[this.pi % this.pattern.length] * (0.92 + Math.random() * 0.16);
      this.pi++;
      for (var i = 0; i < this.barrels.length; i++) {
        var b = this.barrels[i];
        if (!b.active) {
          b.active = true; b.u = this.top; b.v = 1.2; b.roll = 0; b.burst = 0; b.mesh.visible = true; b.mesh.scale.setScalar(1);
          if (ctx && ctx.audio) ctx.audio.rumble(ctx.near(this.cx, this.cz, 16) * 0.8);
          break;
        }
      }
    }
    this.circles.length = 0;
    var yaw = Math.atan2(this.dx, this.dz);
    for (var j = 0; j < this.barrels.length; j++) {
      var B = this.barrels[j];
      if (!B.active) continue;
      if (B.burst > 0) {
        B.burst -= dt;
        B.mesh.scale.setScalar(Math.max(0.01, B.burst / 0.25));
        if (B.burst <= 0) { B.active = false; B.mesh.visible = false; }
        continue;
      }
      var onRamp = B.u > this.bottom;
      if (onRamp) B.v = Math.min(4.6, B.v + dt * 6); else B.v = 4.6;
      B.u -= B.v * dt;
      B.y = onRamp ? (B.u - this.bottom) / (this.top - this.bottom) * this.rampH : 0;
      B.roll += B.v * dt / 0.4;
      var x = this.cx + this.dx * B.u, z = this.cz + this.dz * B.u;
      B.mesh.position.set(x, B.y + 0.41, z);
      B.mesh.rotation.set(0, yaw, 0);
      B.mesh.rotateZ(Math.PI / 2);
      B.mesh.rotateY(B.roll);
      if (!onRamp) this.circles.push({ x: x, z: z, r: 0.42, idx: j });
      if (B.u < this.end) {
        B.burst = 0.25;
        if (ctx && ctx.fx) ctx.fx.puff(x, 0.4, z, 0xe8c15a, 8);
        if (ctx && ctx.audio) ctx.audio.thump(ctx.near(x, z, 14) * 0.5);
      }
    }
  };
  BarrelChute.prototype.onHit = function (idx, ctx) {
    var B = this.barrels[idx];
    if (!B) return;
    B.burst = 0.25;
    if (ctx && ctx.fx) ctx.fx.splinters(B.mesh.position.x, 0.5, B.mesh.position.z);
  };
  H.BarrelChute = BarrelChute;

  // ------------------------------------------------------------------ arm-wrestling ogre: periodic table slam shockwave
  function OgreSlam(ctx, o) {
    this.name = 'ogre';
    this.o = o; this.s = o.s;
    var f = frame(ctx.path, o.s);
    this.tx = f.x + f.rx * o.side * o.offset; this.tz = f.z + f.rz * o.side * o.offset;
    this.ax = f.tx; this.az = f.tz; // table axis parallel to the path
    this.R = o.radius || 3.3;
    var tyaw = Math.atan2(this.ax, this.az);
    // table
    ctx.batch.push({ geo: G.geo.box, m: M(this.tx, 0.74, this.tz, 0, tyaw, 0, 0.9, 0.08, 1.3), c: 0x7a4a26, t: 0.02 });
    ctx.batch.push({ geo: G.geo.box, m: M(this.tx, 0.36, this.tz, 0, tyaw, 0, 0.18, 0.72, 0.18), c: 0x5c3a1c, t: 0.015 });
    ctx.batch.push({ geo: G.geo.box, m: M(this.tx, 0.03, this.tz, 0, tyaw, 0, 0.7, 0.06, 0.7), c: 0x5c3a1c, t: 0.015 });
    ctx.blobs.push({ x: this.tx, z: this.tz, s: 1.8 });
    // ogre on one end, dwarf on the other
    var oz = 0.98, dz = 0.8;
    var ogre = ctx.crowd.add({ kind: 'ogre', pose: 'wrestle', scale: 1.55, width: 1.45, skin: 0x9aa46a, shirt: 0x6b4a2a, pants: 0x3a2c24, ears: 'pointy', tusks: true, hair: null, nose: 1.6 });
    ogre.x = this.tx - this.ax * oz; ogre.z = this.tz - this.az * oz; ogre.yaw = tyaw;
    var dwarf = ctx.crowd.add(C.randomPerson(ctx.rng, 'dwarf', { pose: 'wrestle', hat: 'helmet', shirt: 0x8c2f39 }));
    dwarf.x = this.tx + this.ax * dz; dwarf.z = this.tz + this.az * dz; dwarf.yaw = tyaw + Math.PI;
    ogre.armOverride = new THREE.Vector3(); dwarf.armOverride = new THREE.Vector3();
    this.ogre = ogre; this.dwarf = dwarf;
    // stools
    ctx.batch.push({ geo: G.geo.cylLo, m: M(ogre.x, 0.42, ogre.z, 0, 0, 0, 0.32, 0.08, 0.32), c: 0x6b4423, t: 0.015 });
    ctx.batch.push({ geo: G.geo.cylLo, m: M(dwarf.x, 0.38, dwarf.z, 0, 0, 0, 0.26, 0.08, 0.26), c: 0x6b4423, t: 0.015 });
    ctx.blobs.push({ x: ogre.x, z: ogre.z, s: 1.3 }); ctx.blobs.push({ x: dwarf.x, z: dwarf.z, s: 0.9 });
    // spectators
    this.fans = [];
    for (var i = 0; i < 3; i++) {
      var a = tyaw + Math.PI / 2 * o.side + (i - 1) * 0.7;
      var fp = ctx.crowd.add(C.randomPerson(ctx.rng, null, { pose: 'stand', mug: i !== 1 }));
      fp.x = this.tx + Math.sin(a) * 1.5 * 1 + 0; fp.z = this.tz + Math.cos(a) * 1.5;
      // keep fans on the far side of the table from the path
      var toPathX = f.x - this.tx, toPathZ = f.z - this.tz;
      if ((fp.x - this.tx) * toPathX + (fp.z - this.tz) * toPathZ > 0) { fp.x = 2 * this.tx - fp.x; fp.z = 2 * this.tz - fp.z; }
      fp.yaw = Math.atan2(this.tx - fp.x, this.tz - fp.z);
      this.fans.push(fp);
      ctx.blobs.push({ x: fp.x, z: fp.z, s: 0.8 });
    }
    // telegraph ring on the floor
    var ringMat = new THREE.MeshBasicMaterial({ map: G.texRing(), color: 0xff5a2a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(this.R * 2, this.R * 2), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(this.tx, 0.02, this.tz);
    ctx.scene.add(this.ring);
    var waveMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), waveMat);
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.position.set(this.tx, 0.05, this.tz);
    ctx.scene.add(this.wave);
    this.zones = [{ x: this.tx, z: this.tz, r: this.R - 0.2 }];
    this.circles = [];
    this.hint = o.hint;
    this.period = o.period || 3.4;
  }
  OgreSlam.prototype.reset = function (r) {
    this.t = r() * this.period * 0.6;
    this.slammed = false;
    this.winner = 1;
    this.waveT = 1;
  };
  OgreSlam.prototype.update = function (dt, t, ctx) {
    var P = this.period, strainEnd = P - 1.0;
    this.t += dt;
    if (this.t > P) { this.t -= P; this.slammed = false; this.winner = Math.random() < 0.65 ? 1 : -1; }
    var tt = this.t;
    // grip point relative to table centre: lateral wobble while straining, slam to the loser's side
    var lat = 0, h = 1.08, strain = 0;
    if (tt < strainEnd) {
      strain = tt / strainEnd;
      lat = Math.sin(tt * 7.5) * 0.08 * (0.4 + strain);
    } else if (tt < strainEnd + 0.14) {
      var k = (tt - strainEnd) / 0.14;
      lat = this.winner * 0.55 * k; h = 1.08 - 0.3 * k;
      if (!this.slammed && k >= 0.99) this.slam(ctx);
    } else {
      var back = TT.clamp((tt - strainEnd - 0.14) / 0.7, 0, 1);
      lat = this.winner * 0.55 * (1 - TT.easeInOutSine(back)); h = 0.78 + 0.3 * TT.easeInOutSine(back);
      if (!this.slammed) this.slam(ctx);
    }
    // grip in world: table centre + perpendicular * lat
    var px = -this.az, pz = this.ax; // perpendicular to table axis
    var gx = this.tx + px * lat, gz = this.tz + pz * lat;
    this.aim(this.ogre, gx, h, gz);
    this.aim(this.dwarf, gx, h, gz);
    this.ogre.strain = strain * 0.8; this.dwarf.strain = strain;
    // telegraph ring pulses faster & brighter as the slam approaches
    var pulse = tt < strainEnd ? (0.15 + 0.45 * strain * (0.6 + 0.4 * Math.sin(tt * (6 + strain * 18)))) : 0.12;
    this.ring.material.opacity = pulse;
    this.ring.rotation.z += dt * (0.2 + strain);
    // shockwave
    if (this.waveT < 1) {
      this.waveT += dt / 0.45;
      var e = TT.easeOutCubic(Math.min(1, this.waveT));
      this.wave.scale.setScalar(0.3 + e * this.R);
      this.wave.material.opacity = (1 - this.waveT) * 0.85;
    } else this.wave.material.opacity = 0;
    for (var i = 0; i < this.fans.length; i++) this.fans[i].cheerTarget = (tt > strainEnd && tt < strainEnd + 0.9) ? 1 : 0;
  };
  var _d = new THREE.Vector3();
  OgreSlam.prototype.aim = function (p, gx, gy, gz) {
    // convert world grip point into the person's body-local direction from the right (+x) shoulder
    var s = p.scale, c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    var wx = gx - p.x, wz = gz - p.z;
    var lx = (wx * c - wz * sn) / s, lz = (wx * sn + wz * c) / s, ly = gy / s;
    var sx = C.DIMS.SH_X * p.width, sy = C.DIMS.SH_Y;
    _d.set(lx - sx, ly - sy, lz);
    if (_d.lengthSq() < 1e-6) _d.set(0, -1, 0);
    p.armStretchR = TT.clamp(_d.length() / C.DIMS.ARM_LEN, 0.6, 2.4);
    p.armOverride.copy(_d.normalize());
  };
  OgreSlam.prototype.slam = function (ctx) {
    this.slammed = true;
    this.waveT = 0;
    if (!ctx) return;
    var dx = ctx.px - this.tx, dz = ctx.pz - this.tz, d = Math.sqrt(dx * dx + dz * dz);
    var near = ctx.near(this.tx, this.tz, 18);
    if (ctx.audio) ctx.audio.slam(0.35 + near * 0.65);
    if (ctx.fx) { ctx.fx.puff(this.tx, 0.8, this.tz, 0xd8c3a0, 10); ctx.fx.shake(0.12 + 0.5 * Math.max(0, 1 - d / 9)); }
    if (d < this.R && ctx.onSlam) ctx.onSlam(Math.pow(1 - d / this.R, 0.5), this);
  };
  H.OgreSlam = OgreSlam;

  // ------------------------------------------------------------------ cat chasing a mouse across the aisle
  function CatChase(ctx, o) {
    this.name = 'cat';
    this.o = o; this.s = o.s;
    var f = frame(ctx.path, o.s);
    this.cx = f.x; this.cz = f.z; this.dx = f.rx; this.dz = f.rz;
    this.W = o.halfWidth || 3.8;
    this.cat = C.makeCat(); this.mouse = C.makeMouse();
    ctx.scene.add(this.cat.root); ctx.scene.add(this.mouse.root);
    this.circles = [{ x: 0, z: 0, r: 0.3 }];
    this.zones = [];
    laneZones(this.zones, this.cx, this.cz, this.dx, this.dz, -this.W, this.W, 1.0);
    this.ends = [
      { x: this.cx + this.dx * (this.W + 1.0), z: this.cz + this.dz * (this.W + 1.0) },
      { x: this.cx - this.dx * (this.W + 1.0), z: this.cz - this.dz * (this.W + 1.0) }
    ];
    this.hint = o.hint;
  }
  CatChase.prototype.reset = function (r) {
    this.side = r() < 0.5 ? 1 : -1;
    this.state = 'wait';
    this.timer = TT.randRange(0.8, 2.8, r);
    this.mu = this.side * this.W; this.cu = this.side * (this.W + 0.2);
    this.spin = 0;
    this.update(0, 0, null);
  };
  CatChase.prototype.update = function (dt, t, ctx) {
    var o = this.o;
    if (this.state === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'run'; this.runT = 0;
        if (ctx && ctx.audio) ctx.audio.squeak(ctx.near(this.cx, this.cz, 14));
      }
    } else {
      this.runT += dt;
      var target = -this.side * this.W;
      this.mu = TT.clamp(this.mu - this.side * o.mouseSpeed * dt, Math.min(target, this.side * this.W), Math.max(target, this.side * this.W));
      if (this.runT > o.catDelay) {
        this.cu -= this.side * o.catSpeed * dt;
        if (this.runT < o.catDelay + dt * 1.5 && ctx && ctx.audio) ctx.audio.hiss(ctx.near(this.cx, this.cz, 12) * 0.6);
      }
      var catTarget = -this.side * (this.W + 0.2);
      if ((this.side > 0 && this.cu <= catTarget) || (this.side < 0 && this.cu >= catTarget)) {
        this.cu = catTarget; this.side = -this.side; this.state = 'wait';
        this.timer = TT.randRange(o.wait[0], o.wait[1]);
      }
    }
    var running = this.state === 'run';
    var dirSign = running ? -this.side : this.side * -1;
    var yaw = Math.atan2(this.dx * dirSign, this.dz * dirSign);
    // mouse
    this.mouse.root.position.set(this.cx + this.dx * this.mu, 0, this.cz + this.dz * this.mu);
    this.mouse.root.rotation.y = yaw;
    this.mouse.root.position.y = running ? Math.abs(Math.sin(t * 30)) * 0.03 : 0;
    // cat: crouched & tail swishing while waiting, bounding while running
    var cr = this.cat.root;
    cr.position.set(this.cx + this.dx * this.cu, 0, this.cz + this.dz * this.cu);
    cr.rotation.y = yaw;
    if (this.spin > 0) { this.spin -= dt; cr.rotation.y += this.spin * 25; }
    var catRunning = running && this.runT > o.catDelay;
    var gait = t * 16;
    this.cat.body.position.y = catRunning ? Math.abs(Math.sin(gait)) * 0.08 : -0.06;
    this.cat.head.position.y = this.cat.body.position.y;
    this.cat.body.rotation.x = catRunning ? Math.sin(gait) * 0.12 : 0.05;
    for (var i = 0; i < 4; i++) this.cat.legs[i].rotation.x = catRunning ? Math.sin(gait + (i < 2 ? 0 : Math.PI)) * 0.9 : 0;
    this.cat.tail.rotation.x = catRunning ? -1.2 : -0.5 + Math.sin(t * 4) * 0.2;
    this.cat.tail.rotation.z = catRunning ? 0 : Math.sin(t * 5.5) * 0.7;
    this.circles[0].x = cr.position.x; this.circles[0].z = cr.position.z;
    this.circles[0].r = catRunning ? 0.3 : 0.001;
  };
  CatChase.prototype.onHit = function () { this.spin = 0.4; };
  H.CatChase = CatChase;

  // ------------------------------------------------------------------ sleeping dragon, tail swish
  function DragonTail(ctx, o) {
    this.name = 'dragon';
    this.o = o; this.s = o.s;
    var f = frame(ctx.path, o.s);
    this.f = f;
    this.side = o.side;
    this.bx = f.x + f.rx * o.side * o.offset; this.bz = f.z + f.rz * o.side * o.offset;
    this.d = C.makeDragon();
    this.d.root.position.set(this.bx, 0, this.bz);
    this.d.root.rotation.y = Math.atan2(f.tx, f.tz);
    ctx.scene.add(this.d.root);
    // tail pivot (rear of the dragon) in world
    this.pivx = this.bx - f.tx * 1.7; this.pivz = this.bz - f.tz * 1.7;
    this.circles = [];
    for (var i = 0; i < this.d.segs.length; i++) this.circles.push({ x: 0, z: 0, r: this.d.segs[i].userData.r });
    this.zones = [{ x: this.bx, z: this.bz, r: 2.6 }, { x: this.pivx - f.tx * 1.0, z: this.pivz - f.tz * 1.0, r: 2.2 }];
    // coin hoard decor
    var r = ctx.rng;
    for (var c = 0; c < 26; c++) {
      var a = r() * Math.PI * 2, rr = 1.4 + r() * 1.2;
      ctx.batch.push({ geo: G.geo.cylLo, m: M(this.bx + Math.cos(a) * rr * 0.8, 0.02 + r() * 0.05, this.bz + Math.sin(a) * rr, r() * 0.5, 0, r() * 0.5, 0.09, 0.02, 0.09), c: 0xf2c14e, t: 0.008 });
    }
    ctx.blobs.push({ x: this.bx, z: this.bz, s: 4.6 });
    // Z sprites
    this.zs = [];
    var zmat = new THREE.SpriteMaterial({ map: G.texZ(), transparent: true, depthWrite: false });
    for (var zz = 0; zz < 3; zz++) {
      var sp = new THREE.Sprite(zmat.clone());
      sp.scale.set(0.45, 0.45, 1);
      ctx.scene.add(sp);
      this.zs.push({ sp: sp, t: zz / 3 });
    }
    this.hint = o.hint;
    this.period = o.period || 3.7;
  }
  DragonTail.prototype.reset = function (r) {
    this.t = r() * this.period * 0.5;
    this.swish = 0;
    this.snored = false;
    this.eyeT = 0;
    this.update(0, 0, null);
  };
  DragonTail.prototype.update = function (dt, t, ctx) {
    var P = this.period, rest = P - 1.25;
    this.t += dt;
    if (this.t > P) { this.t -= P; this.snored = false; }
    var tt = this.t, sw;
    if (tt < rest) sw = 0;
    else if (tt < rest + 0.42) sw = TT.easeOutCubic((tt - rest) / 0.42);
    else if (tt < rest + 0.7) sw = 1;
    else sw = 1 - TT.easeInOutSine(Math.min(1, (tt - rest - 0.7) / 0.55));
    this.swish = sw;
    if (!this.snored && tt > rest - 1.3) {
      this.snored = true;
      if (ctx && ctx.audio) ctx.audio.snore(ctx.near(this.bx, this.bz, 16));
    }
    // breathing (inhale during rest, big exhale when swishing)
    var inhale = tt < rest ? tt / rest : 1 - Math.min(1, (tt - rest) / 0.5);
    var b = 1 + inhale * 0.06;
    this.d.body.scale.set(b, 1 + inhale * 0.09, 1);
    this.d.headPivot.rotation.x = 0.1 - inhale * 0.08 + sw * 0.1;
    // tail: base angle from straight back (-T) toward the path side
    var f = this.f, side = this.side;
    var baseA = TT.lerp(-0.35, 1.52, sw); // radians toward the path
    var bx = -f.tx, bz = -f.tz;             // backwards
    var px = -f.rx * side, pz = -f.rz * side; // toward the path from the dragon
    var x = this.pivx, z = this.pivz, a = baseA;
    var segs = this.d.segs, n = segs.length, spacing = 0.44;
    for (var i = 0; i < n; i++) {
      var curl = TT.lerp(-0.2, 0.03, sw) * i; // curls away while resting
      var ang = a + curl * 0.35;
      var dx = bx * Math.cos(ang) + px * Math.sin(ang), dz = bz * Math.cos(ang) + pz * Math.sin(ang);
      x += dx * spacing; z += dz * spacing;
      var y = TT.lerp(0.34, 0.12, i / (n - 1)) + Math.sin(t * 2 + i * 0.6) * 0.02 * (1 - sw);
      segs[i].position.set(x - this.bx, y, z - this.bz).applyAxisAngle(_up, -this.d.root.rotation.y);
      this.circles[i].x = x; this.circles[i].z = z;
      if (i === n - 1) {
        var tipx = x + dx * 0.35, tipz = z + dz * 0.35;
        this.d.tip.position.set(tipx - this.bx, 0.12, tipz - this.bz).applyAxisAngle(_up, -this.d.root.rotation.y);
        this.d.tip.rotation.y = Math.atan2(dx, dz) - this.d.root.rotation.y;
      }
    }
    // Zs float up while snoozing
    for (var q = 0; q < this.zs.length; q++) {
      var Z = this.zs[q];
      Z.t += dt * 0.35;
      if (Z.t > 1) Z.t -= 1;
      var hx = this.bx + f.tx * 2.9, hz = this.bz + f.tz * 2.9;
      Z.sp.position.set(hx + Math.sin(Z.t * 6 + q) * 0.3, 1.4 + Z.t * 1.6, hz);
      Z.sp.material.opacity = Math.sin(Z.t * Math.PI) * (1 - sw * 0.8);
      Z.sp.scale.setScalar(0.25 + Z.t * 0.35);
    }
    if (this.eyeT > 0) { this.eyeT -= dt; this.d.eyeOpen.visible = true; } else this.d.eyeOpen.visible = false;
  };
  var _up = new THREE.Vector3(0, 1, 0);
  DragonTail.prototype.onHit = function () { this.eyeT = 1.4; };
  H.DragonTail = DragonTail;

  // ------------------------------------------------------------------ layout
  H.createAll = function (ctx) {
    var list = [];
    list.push(new Crosser(ctx, { s: 6.2, speed: 1.15, pause: [0.6, 1.4], halfWidth: 2.7, kind: 'human', mug: true, hint: 'Patrons wander the aisle. Wait for a gap, then go!' }));
    list.push(new Crosser(ctx, { s: 18.0, speed: 1.55, pause: [0.4, 1.1], halfWidth: 3.0, kind: 'elf', angle: 0.12 }));
    list.push(new Crosser(ctx, { s: 22.2, speed: 1.95, pause: [0.3, 0.9], halfWidth: 3.0, kind: 'orc', angle: -0.1, hint: 'Busy lane! There is a safe spot between them.' }));
    list.push(new Crosser(ctx, { s: 30.6, speed: 1.0, pause: [0.4, 1.0], halfWidth: 2.6, kind: 'dwarf', mug: true }));
    list.push(new DanceRing(ctx, { s: 38.8, radius: 2.6, count: 5, omega: 0.78, bandSide: -1, hint: 'Dwarf jig! Slip through a gap — the middle is safe.' }));
    list.push(new Crosser(ctx, { s: 46.6, speed: 1.35, pause: [0.4, 1.1], halfWidth: 2.8, kind: 'human', mug: true }));
    list.push(new BarrelChute(ctx, { s: 53.8, side: 1, pattern: [1.2, 1.2, 3.0], hint: 'Barrels from the cellar! Watch the rhythm.' }));
    list.push(new OgreSlam(ctx, { s: 68.2, side: -1, offset: 2.5, radius: 3.3, period: 3.4, hint: 'Arm-wrestling! Stay out of the ring when the table SLAMS.' }));
    list.push(new Crosser(ctx, { s: 74.6, speed: 1.75, pause: [0.3, 0.9], halfWidth: 2.8, kind: 'elf', hat: true }));
    list.push(new CatChase(ctx, { s: 79.6, mouseSpeed: 3.6, catSpeed: 5.0, catDelay: 0.42, wait: [1.6, 3.0], halfWidth: 3.6, hint: 'The mouse runs first. The cat is right behind it!' }));
    list.push(new DragonTail(ctx, { s: 88.6, side: -1, offset: 3.2, period: 3.8, hint: 'A sleeping dragon. Mind the tail when it snores!' }));
    return list;
  };
})();
