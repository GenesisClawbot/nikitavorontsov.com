/* Tipsy Tray — characters: an instanced crowd of "bean folk", the goblin waiter, the dragon, cat, mouse, barrels */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx;
  var C = (TT.chars = {});

  // ------------------------------------------------------------------ palettes
  C.SKIN = {
    human: [0xf2c7a0, 0xe0a57a, 0xc48358, 0x8f5a3a, 0xf5d2b5],
    elf: [0xf6dcc6, 0xe9c9b0, 0xd7b8e0],
    dwarf: [0xe8a987, 0xd9936f, 0xf0b89a],
    orc: [0x7fae5d, 0x6d9c50, 0x93b86a],
    gnome: [0xf7c3a8, 0xf0b0a0],
    ogre: [0x9aa46a]
  };
  C.SHIRTS = [0x8c2f39, 0x2f5d50, 0x324a7a, 0xb5892e, 0x6b3e75, 0xa0522d, 0x3f6f7f, 0x7a6a3a, 0x9c3d5a, 0x4d6b2f];
  C.BRIGHT = [0xe0473b, 0x2b9bd6, 0xf2b933, 0x8e44c9, 0x2fb37a, 0xff7a3d];
  C.PANTS = [0x3b2c24, 0x2e3140, 0x4a3a2a, 0x2f3b2c, 0x3c2a3a];
  C.HAIR = [0x2b1a10, 0x5a3418, 0x9b5a2a, 0xd9b36b, 0xe8e0d0, 0x6b2f1a, 0x1b1b24];
  C.HATS = [0x3a3f8f, 0x6b2f7a, 0x2f6b4f, 0x8f2f2f, 0x2b2f4f];

  // ------------------------------------------------------------------ crowd (instanced)
  var HIP_Y = 0.5, BODY_Y = 0.84, NECK_Y = 1.15, SH_Y = 1.05, SH_X = 0.29, HIP_X = 0.11, ARM_LEN = 0.42;
  C.DIMS = { HIP_Y: HIP_Y, BODY_Y: BODY_Y, NECK_Y: NECK_Y, SH_Y: SH_Y, SH_X: SH_X, ARM_LEN: ARM_LEN };

  function buildPartGeos() {
    var M = G.M, g = {};
    var OL = 0.02;
    var S8 = new THREE.SphereGeometry(1, 8, 6), S10 = new THREE.SphereGeometry(1, 10, 7);
    g.leg = G.withOutline(new THREE.CapsuleGeometry(0.085, 0.26, 3, 8).translate(0, -0.215, 0), OL);
    g.boot = G.merge([{ geo: S8, m: M(0, -0.43, 0.04, 0, 0, 0, 0.1, 0.075, 0.155), t: OL }]);
    g.body = G.withOutline(new THREE.SphereGeometry(1, 14, 10).scale(0.27, 0.36, 0.235), OL);
    g.belt = G.merge([{ geo: new THREE.TorusGeometry(0.245, 0.035, 4, 16), m: M(0, -0.12, 0, Math.PI / 2, 0, 0, 1, 1, 1), t: 0.012 },
      { geo: G.geo.box, m: M(0, -0.12, 0.24, 0, 0, 0, 0.08, 0.07, 0.03), c: 0xd9a441, t: 0.01 }]);
    g.apron = G.merge([{ geo: G.geo.cyl, m: M(0, -0.08, 0.05, 0, 0, 0, 0.26, 0.5, 0.2), t: OL }]);
    g.head = G.withOutline(new THREE.SphereGeometry(0.22, 16, 11).translate(0, 0.2, 0), OL);
    g.eyes = G.merge([
      { geo: S8, m: M(-0.078, 0.235, 0.182, 0, 0, 0, 0.055, 0.062, 0.04), t: 0.012 },
      { geo: S8, m: M(0.078, 0.235, 0.182, 0, 0, 0, 0.055, 0.062, 0.04), t: 0.012 }]);
    g.pupils = G.merge([
      { geo: S8, m: M(-0.08, 0.232, 0.216, 0, 0, 0, 0.026, 0.03, 0.012), t: 0 },
      { geo: S8, m: M(0.08, 0.232, 0.216, 0, 0, 0, 0.026, 0.03, 0.012), t: 0 }]);
    g.nose = G.withOutline(new THREE.SphereGeometry(0.055, 8, 6), 0.014);
    g.earsRound = G.merge([
      { geo: S8, m: M(-0.215, 0.2, 0, 0, 0, 0, 0.05, 0.065, 0.04), t: 0.014 },
      { geo: S8, m: M(0.215, 0.2, 0, 0, 0, 0, 0.05, 0.065, 0.04), t: 0.014 }]);
    var earCone = new THREE.ConeGeometry(0.05, 0.24, 7).translate(0, 0.12, 0);
    g.earsPointy = G.merge([
      { geo: earCone, m: M(-0.19, 0.23, -0.02, 0, 0, 1.05, 1, 1, 0.55), t: 0.014 },
      { geo: earCone, m: M(0.19, 0.23, -0.02, 0, 0, -1.05, 1, 1, 0.55), t: 0.014 }]);
    g.hair = G.merge([{ geo: new THREE.SphereGeometry(0.232, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), m: M(0, 0.215, -0.012, -0.32, 0, 0, 1, 1, 1), t: OL }]);
    g.beard = G.merge([
      { geo: S10, m: M(0, 0.07, 0.13, 0.25, 0, 0, 0.19, 0.2, 0.12), t: OL },
      { geo: S8, m: M(0, 0.145, 0.205, 0, 0, 0, 0.11, 0.035, 0.035), t: 0.012 }]);
    g.hatWizard = G.merge([
      { geo: new THREE.ConeGeometry(0.2, 0.5, 16), m: M(0, 0.62, -0.03, -0.22, 0, 0.08, 1, 1, 1), t: OL },
      { geo: G.geo.cyl, m: M(0, 0.37, 0, -0.05, 0, 0, 0.34, 0.025, 0.34), t: OL },
      { geo: G.geo.cyl, m: M(0, 0.41, 0, -0.05, 0, 0, 0.2, 0.05, 0.2), c: 0xf2c14e, t: 0.008 }]);
    g.hatCap = G.merge([{ geo: G.geo.cyl, m: M(0.03, 0.38, -0.02, -0.18, 0, 0.16, 0.25, 0.07, 0.25), t: OL },
      { geo: G.geo.sphereLo, m: M(0.08, 0.43, -0.03, 0, 0, 0, 0.04, 0.04, 0.04), c: 0xe8d8b0, t: 0.01 }]);
    var horn = new THREE.ConeGeometry(0.045, 0.2, 10).translate(0, 0.1, 0);
    g.helmet = G.merge([
      { geo: G.geo.hemi, m: M(0, 0.24, 0, 0, 0, 0, 0.245, 0.23, 0.245), c: 0x8d939e, t: OL },
      { geo: G.geo.cyl, m: M(0, 0.24, 0, 0, 0, 0, 0.25, 0.04, 0.25), c: 0xb88a3a, t: 0.012 },
      { geo: G.geo.box, m: M(0, 0.17, 0.24, 0, 0, 0, 0.035, 0.12, 0.03), c: 0x8d939e, t: 0.01 },
      { geo: horn, m: M(-0.2, 0.33, 0, 0, 0, 0.9, 1, 1, 1), c: 0xf1e3c2, t: 0.012 },
      { geo: horn, m: M(0.2, 0.33, 0, 0, 0, -0.9, 1, 1, 1), c: 0xf1e3c2, t: 0.012 }]);
    var tusk = new THREE.ConeGeometry(0.022, 0.08, 8).translate(0, 0.04, 0);
    g.tusks = G.merge([
      { geo: tusk, m: M(-0.07, 0.1, 0.19, 0, 0, 0.2, 1, 1, 1), c: 0xfff6dc, t: 0.008 },
      { geo: tusk, m: M(0.07, 0.1, 0.19, 0, 0, -0.2, 1, 1, 1), c: 0xfff6dc, t: 0.008 }]);
    g.arm = G.withOutline(new THREE.CapsuleGeometry(0.068, 0.27, 3, 8).translate(0, -0.2, 0), OL);
    g.hand = G.withOutline(new THREE.SphereGeometry(0.078, 8, 6), 0.016);
    var C8 = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    g.mug = G.merge([
      { geo: C8, m: M(0, 0.07, 0, 0, 0, 0, 0.07, 0.15, 0.07), c: 0x8a5a33, t: 0.014 },
      { geo: C8, m: M(0, 0.1, 0, 0, 0, 0, 0.074, 0.03, 0.074), c: 0x9aa0a8, t: 0.008 },
      { geo: C8, m: M(0, 0.147, 0, 0, 0, 0, 0.062, 0.012, 0.062), c: 0xfff0cf, t: 0 },
      { geo: new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI), m: M(0.07, 0.075, 0, 0, 0, -Math.PI / 2, 1, 1, 1), c: 0x8a5a33, t: 0.01 }]);
    g.lute = G.merge([
      { geo: G.geo.sphere, m: M(0, 0, 0, 0, 0, 0, 0.17, 0.2, 0.07), c: 0xc27c3a, t: OL },
      { geo: G.geo.cylLo, m: M(0, 0, 0.072, Math.PI / 2, 0, 0, 0.045, 0.004, 0.045), c: 0x2a150a, t: 0 },
      { geo: G.geo.box, m: M(0, 0.3, 0.02, 0, 0, 0, 0.05, 0.36, 0.03), c: 0x6b3f1f, t: 0.012 },
      { geo: G.geo.box, m: M(0, 0.5, 0.0, -0.4, 0, 0, 0.07, 0.08, 0.035), c: 0x4a2912, t: 0.01 }]);
    return g;
  }

  var PART_MATS = null;
  function partMats() {
    if (PART_MATS) return PART_MATS;
    var white = G.toon(0xffffff);
    PART_MATS = {
      leg: white, boot: white, body: white, belt: white, apron: white, head: white, nose: white,
      earsRound: white, earsPointy: white, hair: white, beard: white, hatWizard: G.toonVC, hatCap: G.toonVC,
      helmet: G.toonVC, tusks: G.toonVC, arm: white, hand: white, mug: G.toonVC, lute: G.toonVC,
      eyes: G.toon(0xfffdf6),
      pupils: new THREE.MeshBasicMaterial({ color: 0x140a06 })
    };
    return PART_MATS;
  }
  var NO_OUTLINE = { pupils: true, belt: true };
  var HEAD_PARTS = ['head', 'eyes', 'pupils', 'earsRound', 'earsPointy', 'hair', 'beard', 'hatWizard', 'hatCap', 'helmet', 'tusks'];

  var _mRoot = new THREE.Matrix4(), _mBody = new THREE.Matrix4(), _mNeck = new THREE.Matrix4(), _mT = new THREE.Matrix4();
  var _mP = new THREE.Matrix4(), _mSh = new THREE.Matrix4(), _mH = new THREE.Matrix4();
  var _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _sc = new THREE.Vector3(1, 1, 1);
  var _dir = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), _c = new THREE.Color();
  var ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  function comp(out, x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _v.set(x, y, z);
    _sc.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    return out.compose(_v, _q, _sc);
  }
  function compQ(out, x, y, z, q) { _v.set(x, y, z); _sc.set(1, 1, 1); return out.compose(_v, q, _sc); }

  function Crowd(scene) {
    this.scene = scene;
    this.geos = buildPartGeos();
    this.types = {};
    this.people = [];
    this.built = false;
  }
  C.Crowd = Crowd;

  Crowd.prototype._slot = function (type, color) {
    var T = this.types[type];
    if (!T) T = this.types[type] = { list: [] };
    T.list.push(color == null ? 0xffffff : color);
    return T.list.length - 1;
  };

  // opts: x,z,yaw,scale,width,skin,shirt,pants,boot,hair(color|null),beard(bool),hat('wizard'|'cap'|'helmet'|null),hatColor,
  //       ears('round'|'pointy'), tusks, mug, lute, apron, belt, pose, nose
  Crowd.prototype.add = function (o) {
    var p = {
      x: o.x || 0, y: o.y || 0, z: o.z || 0, yaw: o.yaw || 0, scale: o.scale || 1, width: o.width || 1,
      pose: o.pose || 'stand', nose: o.nose || 1, seed: Math.random() * 1000,
      kind: o.kind || 'human', visible: true, tag: o.tag || null,
      // animation state
      t: Math.random() * 10, walkPhase: Math.random() * 6, walkSpeed: 0,
      headYaw: 0, headPitch: 0, headTilt: 0, lookTarget: null, lookWeight: 0,
      drinkT: -1, drinkNext: 2 + Math.random() * 8, laughT: -1, laughNext: 3 + Math.random() * 10,
      mood: 0, cheer: 0, cheerTarget: 0, hop: 0, spin: 0, action: null, actionT: 0,
      armL: new THREE.Vector3(-0.15, -1, 0.05).normalize(), armR: new THREE.Vector3(0.15, -1, 0.05).normalize(),
      custom: o.custom || null, grip: null, react: 0, slots: {}
    };
    var s = p.slots;
    s.legL = this._slot('leg', o.pants); s.legR = this._slot('leg', o.pants);
    s.bootL = this._slot('boot', o.boot || 0x2b1c14); s.bootR = this._slot('boot', o.boot || 0x2b1c14);
    s.body = this._slot('body', o.shirt);
    if (o.belt !== false) s.belt = this._slot('belt', o.beltColor || 0x3a2416);
    if (o.apron) s.apron = this._slot('apron', 0xf3eee2);
    s.head = this._slot('head', o.skin);
    s.eyes = this._slot('eyes'); s.pupils = this._slot('pupils');
    s.nose = this._slot('nose', o.skin);
    s[o.ears === 'pointy' ? 'earsPointy' : 'earsRound'] = this._slot(o.ears === 'pointy' ? 'earsPointy' : 'earsRound', o.skin);
    if (o.hair != null) s.hair = this._slot('hair', o.hair);
    if (o.beard) s.beard = this._slot('beard', o.beardColor || o.hair || 0x6b3a1a);
    if (o.hat === 'wizard') s.hatWizard = this._slot('hatWizard', o.hatColor || 0x3a3f8f);
    if (o.hat === 'cap') s.hatCap = this._slot('hatCap', o.hatColor || 0x8f2f2f);
    if (o.hat === 'helmet') s.helmet = this._slot('helmet');
    if (o.tusks) s.tusks = this._slot('tusks');
    s.armL = this._slot('arm', o.shirt); s.armR = this._slot('arm', o.shirt);
    s.handL = this._slot('hand', o.skin); s.handR = this._slot('hand', o.skin);
    if (o.mug) s.mug = this._slot('mug');
    if (o.lute) s.lute = this._slot('lute');
    p.hasMug = !!o.mug;
    this.people.push(p);
    return p;
  };

  Crowd.prototype.finalize = function () {
    var mats = partMats();
    for (var name in this.types) {
      var T = this.types[name];
      var n = T.list.length;
      var geo = this.geos[name];
      var mesh = new THREE.InstancedMesh(geo, mats[name], n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (var i = 0; i < n; i++) {
        mesh.setMatrixAt(i, ZERO);
        _c.set(T.list[i]);
        mesh.setColorAt(i, _c);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
      T.mesh = mesh;
      if (!NO_OUTLINE[name]) {
        var ol = new THREE.InstancedMesh(geo, G.outlineMat, n);
        ol.instanceMatrix = mesh.instanceMatrix;
        ol.frustumCulled = false;
        this.scene.add(ol);
        T.outline = ol;
      }
    }
    this.built = true;
  };

  function setArm(vec, x, y, z) { vec.set(x, y, z).normalize(); }

  // pose logic -> fills p.* animation params
  Crowd.prototype.animate = function (p, dt, time, ctx) {
    p.t += dt;
    var t = p.t, sd = p.seed;
    var a = p.anim || (p.anim = {});
    a.bob = 0; a.lean = 0; a.sway = 0; a.legL = 0; a.legR = 0; a.twist = 0; a.lift = 0;
    a.mugTilt = 0; a.jitter = 0;
    var headYaw = 0, headPitch = 0, headTilt = 0;
    var pose = p.pose;

    // cheering overrides for everyone when excited
    p.cheer = TT.damp(p.cheer, p.cheerTarget, 6, dt);

    if (pose === 'sit' || pose === 'wrestle') {
      a.legL = -1.45; a.legR = -1.38;
      a.bob = Math.sin(t * 1.3 + sd) * 0.008;
      a.lean = 0.12;
      setArm(p.armL, -0.3, -0.55, 0.75);
      setArm(p.armR, 0.3, -0.55, 0.75);
      // idle chatter
      headYaw = Math.sin(t * 0.37 + sd) * 0.5;
      headTilt = Math.sin(t * 0.9 + sd * 2) * 0.08;
      if (pose === 'sit') {
        p.drinkNext -= dt;
        if (p.hasMug && p.drinkT < 0 && p.drinkNext < 0) { p.drinkT = 0; p.drinkNext = 5 + Math.random() * 9; }
        if (p.drinkT >= 0) {
          p.drinkT += dt;
          var k = TT.bump(p.drinkT / 1.8);
          var kk = Math.min(1, k * 1.6);
          setArm(p.armR, TT.lerp(0.3, 0.05, kk), TT.lerp(-0.55, 0.62, kk), TT.lerp(0.75, 0.78, kk));
          headPitch -= 0.45 * kk; headYaw *= (1 - kk);
          a.mugTilt = -1.6 * Math.max(0, k * 1.3 - 0.3);
          if (p.drinkT > 1.8) p.drinkT = -1;
        }
        p.laughNext -= dt;
        if (p.laughT < 0 && p.laughNext < 0) { p.laughT = 0; p.laughNext = 6 + Math.random() * 12; }
        if (p.laughT >= 0) {
          p.laughT += dt;
          var lk = TT.bump(p.laughT / 1.3);
          a.bob += Math.abs(Math.sin(p.laughT * 18)) * 0.035 * lk;
          headPitch -= 0.35 * lk;
          a.lean -= 0.2 * lk;
          if (p.laughT > 1.3) p.laughT = -1;
        }
      } else {
        // arm wrestling: the hazard aims the arm (body-local direction)
        if (p.armOverride) p.armR.copy(p.armOverride);
        setArm(p.armL, -0.35, -0.5, 0.6);
        a.jitter = p.strain || 0;
        headPitch = 0.1;
        headYaw = 0;
      }
    } else if (pose === 'walk') {
      p.walkPhase += dt * (3.2 + p.walkSpeed * 3.4) / Math.max(0.7, p.scale);
      var ph = p.walkPhase;
      var amp = TT.clamp(p.walkSpeed / 1.5, 0.3, 1);
      a.legL = Math.sin(ph) * 0.62 * amp;
      a.legR = -Math.sin(ph) * 0.62 * amp;
      a.bob = Math.abs(Math.cos(ph)) * 0.06 * amp;
      a.sway = Math.sin(ph) * 0.07;
      a.lean = 0.08 * amp;
      setArm(p.armL, -0.18, -1, -Math.sin(ph) * 0.55 * amp);
      setArm(p.armR, 0.18, -1, Math.sin(ph) * 0.55 * amp);
      headYaw = Math.sin(t * 0.8 + sd) * 0.25;
      if (p.hasMug) setArm(p.armR, 0.25, -0.6, 0.7);
    } else if (pose === 'dance') {
      var dp = t * 7.5 + sd;
      a.bob = Math.abs(Math.sin(dp)) * 0.16;
      a.legL = Math.sin(dp) * 0.5;
      a.legR = -Math.sin(dp) * 0.5;
      a.sway = Math.sin(dp * 0.5) * 0.15;
      a.twist = Math.sin(t * 2.1 + sd) * 0.6;
      var up = 0.5 + 0.5 * Math.sin(dp * 0.5);
      setArm(p.armL, -0.9, TT.lerp(-0.2, 0.9, up), 0.1);
      setArm(p.armR, 0.9, TT.lerp(0.9, -0.2, up), 0.1);
      headTilt = Math.sin(dp * 0.5) * 0.2;
    } else if (pose === 'play') {
      // bard strumming
      a.bob = Math.abs(Math.sin(t * 5.2)) * 0.03;
      a.sway = Math.sin(t * 2.6) * 0.08;
      setArm(p.armL, -0.55, 0.25, 0.8);
      setArm(p.armR, 0.25, -0.55 + Math.sin(t * 16) * 0.12, 0.8);
      headTilt = Math.sin(t * 2.6) * 0.18;
      headPitch = 0.1;
      a.legL = Math.max(0, Math.sin(t * 5.2)) * -0.25;
    } else if (pose === 'wipe') {
      a.bob = Math.sin(t * 1.5) * 0.01;
      var wp = t * 4;
      setArm(p.armR, 0.25 + Math.cos(wp) * 0.25, -0.35, 0.8 + Math.sin(wp) * 0.2);
      setArm(p.armL, -0.35, -0.4, 0.8);
      headYaw = Math.sin(t * 0.5) * 0.4;
      headPitch = 0.15;
    } else {
      // stand / idle
      a.bob = Math.sin(t * 1.6 + sd) * 0.012;
      a.sway = Math.sin(t * 0.9 + sd) * 0.03;
      setArm(p.armL, -0.2, -1, 0.06 + Math.sin(t * 1.1 + sd) * 0.05);
      setArm(p.armR, 0.2, -1, 0.06 + Math.sin(t * 1.3 + sd) * 0.05);
      if (p.hasMug) setArm(p.armR, 0.3, -0.5, 0.75);
      headYaw = Math.sin(t * 0.45 + sd) * 0.6;
      headTilt = Math.sin(t * 0.7 + sd) * 0.06;
    }

    // cheering (arms up + hop) blends over any pose
    if (p.cheer > 0.01) {
      var c = p.cheer, hopT = t * 9 + sd;
      a.bob += Math.abs(Math.sin(hopT)) * 0.12 * c * (pose === 'sit' ? 0.4 : 1);
      p.armL.lerp(_dir.set(-0.5, 1, 0.15).normalize(), c).normalize();
      p.armR.lerp(_dir.set(0.5, 1, 0.15).normalize(), c).normalize();
      headPitch -= 0.25 * c;
    }
    // grumpy: arms crossed-ish, head shake
    if (p.mood < -0.01) {
      var m = -p.mood;
      p.armL.lerp(_dir.set(0.6, -0.2, 0.8).normalize(), m).normalize();
      p.armR.lerp(_dir.set(-0.6, -0.2, 0.8).normalize(), m).normalize();
      headYaw = TT.lerp(headYaw, Math.sin(t * 9) * 0.35, m);
    }
    // react (startled jolt)
    if (p.react > 0) {
      p.react = Math.max(0, p.react - dt * 2);
      a.lean -= p.react * 0.4;
      headPitch -= p.react * 0.3;
    }

    // look at target (player) if close
    if (p.lookTarget) {
      var dx = p.lookTarget.x - p.x, dz = p.lookTarget.z - p.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var want = dist < (p.lookRange || 4.5) ? 1 : 0;
      p.lookWeight = TT.damp(p.lookWeight, want, 3, dt);
      if (p.lookWeight > 0.01) {
        var ang = Math.atan2(dx, dz) - (p.yaw + a.twist);
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
        ang = TT.clamp(ang, -1.25, 1.25);
        headYaw = TT.lerp(headYaw, ang, p.lookWeight);
      }
    }
    p.headYaw = TT.damp(p.headYaw, headYaw, 8, dt);
    p.headPitch = TT.damp(p.headPitch, headPitch, 8, dt);
    p.headTilt = TT.damp(p.headTilt, headTilt, 8, dt);
  };

  Crowd.prototype.update = function (dt, time, ctx) {
    if (!this.built) return;
    var types = this.types;
    for (var i = 0; i < this.people.length; i++) {
      var p = this.people[i];
      this.animate(p, dt, time, ctx);
      var s = p.slots, a = p.anim, w = p.width;
      if (!p.visible) {
        for (var key in s) types[slotType(key, s)].mesh.setMatrixAt(s[key], ZERO);
        continue;
      }
      var jit = a.jitter ? (Math.sin(time * 60 + p.seed) * 0.02 * a.jitter) : 0;
      comp(_mRoot, p.x + jit, p.y + a.lift, p.z, 0, p.yaw + a.twist, 0, p.scale);
      // legs
      comp(_mT, -HIP_X * w, HIP_Y, 0, a.legL, 0, 0, 1); _mP.multiplyMatrices(_mRoot, _mT);
      types.leg.mesh.setMatrixAt(s.legL, _mP); types.boot.mesh.setMatrixAt(s.bootL, _mP);
      comp(_mT, HIP_X * w, HIP_Y, 0, a.legR, 0, 0, 1); _mP.multiplyMatrices(_mRoot, _mT);
      types.leg.mesh.setMatrixAt(s.legR, _mP); types.boot.mesh.setMatrixAt(s.bootR, _mP);
      // body
      comp(_mT, 0, BODY_Y + a.bob, 0, a.lean, 0, a.sway, 1); _mBody.multiplyMatrices(_mRoot, _mT);
      comp(_mT, 0, 0, 0, 0, 0, 0, w, 1, 0.92 + 0.08 * w); _mP.multiplyMatrices(_mBody, _mT);
      types.body.mesh.setMatrixAt(s.body, _mP);
      if (s.belt !== undefined) types.belt.mesh.setMatrixAt(s.belt, _mP);
      if (s.apron !== undefined) types.apron.mesh.setMatrixAt(s.apron, _mP);
      // head
      comp(_mT, 0, NECK_Y - BODY_Y, 0, p.headPitch, p.headYaw, p.headTilt, 1); _mNeck.multiplyMatrices(_mBody, _mT);
      for (var h = 0; h < HEAD_PARTS.length; h++) {
        var hn = HEAD_PARTS[h];
        if (s[hn] !== undefined) types[hn].mesh.setMatrixAt(s[hn], _mNeck);
      }
      comp(_mT, 0, 0.17, 0.215, 0, 0, 0, p.nose); _mP.multiplyMatrices(_mNeck, _mT);
      types.nose.mesh.setMatrixAt(s.nose, _mP);
      // arms
      this._arm(_mBody, -SH_X * w, p.armL, s.armL, s.handL, null, a, 1);
      this._arm(_mBody, SH_X * w, p.armR, s.armR, s.handR, s.mug, a, p.armStretchR || 1);
      if (s.lute !== undefined) {
        comp(_mT, 0.02, 0.0, 0.25, 0.15, 0, -0.95, 1); _mP.multiplyMatrices(_mBody, _mT);
        types.lute.mesh.setMatrixAt(s.lute, _mP);
      }
    }
    for (var n in types) {
      types[n].mesh.instanceMatrix.needsUpdate = true;
    }
  };

  function slotType(key, s) {
    if (key === 'legL' || key === 'legR') return 'leg';
    if (key === 'bootL' || key === 'bootR') return 'boot';
    if (key === 'armL' || key === 'armR') return 'arm';
    if (key === 'handL' || key === 'handR') return 'hand';
    return key;
  }

  var _hp = new THREE.Vector3();
  var _mS = new THREE.Matrix4();
  Crowd.prototype._arm = function (mBody, sx, dir, armSlot, handSlot, mugSlot, a, stretch) {
    _q.setFromUnitVectors(DOWN, dir);
    compQ(_mT, sx, SH_Y - BODY_Y, 0, _q);
    _mSh.multiplyMatrices(mBody, _mT);
    if (stretch !== 1) { _mS.makeScale(1, stretch, 1); _mP.multiplyMatrices(_mSh, _mS); this.types.arm.mesh.setMatrixAt(armSlot, _mP); }
    else this.types.arm.mesh.setMatrixAt(armSlot, _mSh);
    comp(_mT, 0, -ARM_LEN * stretch, 0, 0, 0, 0, 1); _mH.multiplyMatrices(_mSh, _mT);
    this.types.hand.mesh.setMatrixAt(handSlot, _mH);
    if (mugSlot !== null && mugSlot !== undefined) {
      _hp.copy(dir).multiplyScalar(ARM_LEN);
      comp(_mT, sx + _hp.x, SH_Y - BODY_Y + _hp.y - 0.03, _hp.z + 0.05, a.mugTilt, 0, 0, 1);
      _mP.multiplyMatrices(mBody, _mT);
      this.types.mug.mesh.setMatrixAt(mugSlot, _mP);
    }
  };

  // random person factory
  C.randomPerson = function (r, kind, extra) {
    r = r || Math.random;
    kind = kind || TT.pick(['human', 'human', 'human', 'elf', 'dwarf', 'dwarf', 'orc', 'gnome'], r);
    var o = { kind: kind, shirt: TT.pick(C.SHIRTS, r), pants: TT.pick(C.PANTS, r), ears: 'round', hair: TT.pick(C.HAIR, r), nose: 1 };
    if (kind === 'human') {
      o.skin = TT.pick(C.SKIN.human, r); o.scale = 0.95 + r() * 0.12; o.width = 0.9 + r() * 0.35;
      if (r() < 0.25) o.beard = true;
      if (r() < 0.2) { o.hat = 'cap'; o.hatColor = TT.pick(C.HATS, r); }
      if (r() < 0.12) o.hair = null;
      o.nose = 0.9 + r() * 0.5;
    } else if (kind === 'elf') {
      o.skin = TT.pick(C.SKIN.elf, r); o.scale = 1.08 + r() * 0.08; o.width = 0.78 + r() * 0.1; o.ears = 'pointy';
      o.hair = TT.pick([0xe8e0d0, 0xd9b36b, 0x2b1a10, 0x9fb8d8], r); o.nose = 0.8;
      if (r() < 0.3) { o.hat = 'wizard'; o.hatColor = TT.pick(C.HATS, r); }
    } else if (kind === 'dwarf') {
      o.skin = TT.pick(C.SKIN.dwarf, r); o.scale = 0.8 + r() * 0.05; o.width = 1.3 + r() * 0.15; o.beard = true;
      o.beardColor = TT.pick([0x9b4a1a, 0x6b2f1a, 0xd9d0c0, 0x3a2416, 0xc47a2a], r); o.hair = o.beardColor;
      o.nose = 1.5 + r() * 0.4;
      if (r() < 0.5) o.hat = 'helmet';
    } else if (kind === 'orc') {
      o.skin = TT.pick(C.SKIN.orc, r); o.scale = 1.1 + r() * 0.1; o.width = 1.3 + r() * 0.2; o.tusks = true; o.ears = 'pointy';
      o.hair = r() < 0.5 ? 0x1b1b24 : null; o.nose = 1.2;
    } else if (kind === 'gnome') {
      o.skin = TT.pick(C.SKIN.gnome, r); o.scale = 0.68; o.width = 1.05; o.nose = 1.7; o.beard = r() < 0.6;
      o.beardColor = 0xf2f0ea; o.hair = 0xf2f0ea; o.hat = 'wizard'; o.hatColor = TT.pick([0xc0392b, 0x2f6b9f, 0x6b2f7a], r);
    }
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  };

  // ------------------------------------------------------------------ the goblin waiter (player)
  C.makeGoblin = function (ghost) {
    var M = G.M;
    var mat = ghost ? ghostMat() : G.toonVC;
    var mk = function (parts) {
      var geo = G.merge(parts);
      if (ghost) return new THREE.Mesh(geo, mat);
      return G.outlined(geo, mat, true);
    };
    var SKIN = 0x86c45a, SKIN_D = 0x5f9a3f, SHIRT = 0xf6f1e4, VEST = 0x2d2433, PANTS = 0x3a2c3f, SHOE = 0x2a1a12, TIE = 0xd8342c;
    var root = new THREE.Group();
    var hips = new THREE.Group(); hips.position.y = 0.34; root.add(hips);
    var legGeo = [{ geo: G.capsule(0.07, 0.16, 8), m: M(0, -0.15, 0), c: PANTS, t: 0.018 },
      { geo: G.geo.sphereLo, m: M(0, -0.31, 0.05, 0, 0, 0, 0.085, 0.06, 0.14), c: SHOE, t: 0.018 }];
    var legL = mk(legGeo); legL.position.set(0.09, 0, 0); hips.add(legL);
    var legR = mk(legGeo); legR.position.set(-0.09, 0, 0); hips.add(legR);
    var body = new THREE.Group(); body.position.y = 0.2; hips.add(body);
    body.add(mk([
      { geo: G.geo.sphere, m: M(0, 0, 0, 0, 0, 0, 0.23, 0.26, 0.2), c: VEST, t: 0.02 },
      { geo: G.geo.sphere, m: M(0, 0.02, 0.03, 0, 0, 0, 0.17, 0.22, 0.19), c: SHIRT, t: 0 },
      { geo: G.geo.cyl, m: M(0, -0.07, 0.06, 0.08, 0, 0, 0.2, 0.3, 0.16), c: 0xfbf8ef, t: 0.016 },
      { geo: new THREE.TorusGeometry(0.215, 0.022, 6, 24), m: M(0, -0.05, 0, Math.PI / 2 + 0.05, 0, 0), c: 0xfbf8ef, t: 0.01 },
      { geo: G.geo.sphereLo, m: M(0, -0.04, -0.215, 0, 0, 0, 0.06, 0.04, 0.03), c: 0xfbf8ef, t: 0.01 },
      { geo: G.geo.cone, m: M(0.05, 0.22, 0.14, 0, 0, Math.PI / 2, 0.035, 0.08, 0.035), c: TIE, t: 0.01 },
      { geo: G.geo.cone, m: M(-0.05, 0.22, 0.14, 0, 0, -Math.PI / 2, 0.035, 0.08, 0.035), c: TIE, t: 0.01 },
      { geo: G.geo.sphereLo, m: M(0, 0.22, 0.15, 0, 0, 0, 0.025, 0.025, 0.025), c: TIE, t: 0.008 }
    ]));
    var neck = new THREE.Group(); neck.position.y = 0.24; body.add(neck);
    var head = mk([
      { geo: G.geo.sphere, m: M(0, 0.2, 0, 0, 0, 0, 0.23, 0.215, 0.22), c: SKIN, t: 0.02 },
      { geo: G.geo.cone, m: M(0, 0.15, 0.27, Math.PI / 2 - 0.25, 0, 0, 0.055, 0.2, 0.05), c: SKIN, t: 0.014 },
      { geo: G.geo.cone, m: M(0.03, 0.42, -0.02, 0.3, 0, -0.3, 0.03, 0.12, 0.03), c: 0x2e4a1f, t: 0.01 },
      { geo: G.geo.cone, m: M(-0.04, 0.43, 0.0, -0.1, 0, 0.35, 0.03, 0.13, 0.03), c: 0x2e4a1f, t: 0.01 },
      { geo: G.geo.cone, m: M(0.0, 0.44, 0.03, 0.2, 0, 0.05, 0.028, 0.12, 0.028), c: 0x2e4a1f, t: 0.01 },
      { geo: G.geo.sphereLo, m: M(0, 0.07, 0.16, 0.3, 0, 0, 0.09, 0.03, 0.05), c: 0x5a2a20, t: 0 }
    ]);
    neck.add(head);
    var eyes = mk([
      { geo: G.geo.sphereLo, m: M(-0.085, 0.24, 0.17, 0, 0, 0, 0.075, 0.085, 0.06), c: 0xfffdf4, t: 0.014 },
      { geo: G.geo.sphereLo, m: M(0.085, 0.24, 0.17, 0, 0, 0, 0.075, 0.085, 0.06), c: 0xfffdf4, t: 0.014 }]);
    neck.add(eyes);
    var pupilGeo = G.merge([
      { geo: G.geo.sphereLo, m: M(-0.085, 0.24, 0.225, 0, 0, 0, 0.034, 0.04, 0.012), c: 0x120806, t: 0 },
      { geo: G.geo.sphereLo, m: M(0.085, 0.24, 0.225, 0, 0, 0, 0.034, 0.04, 0.012), c: 0x120806, t: 0 }]);
    var pupils = new THREE.Mesh(pupilGeo, ghost ? mat : G.toonVC);
    neck.add(pupils);
    var lids = mk([
      { geo: G.geo.sphereLo, m: M(-0.085, 0.245, 0.172, 0, 0, 0, 0.082, 0.092, 0.066), c: SKIN_D, t: 0.01 },
      { geo: G.geo.sphereLo, m: M(0.085, 0.245, 0.172, 0, 0, 0, 0.082, 0.092, 0.066), c: SKIN_D, t: 0.01 }]);
    lids.scale.y = 0.25;
    lids.position.y = 0.337 * (1 - 0.25);
    neck.add(lids);
    var earGeo = [
      { geo: new THREE.ConeGeometry(0.08, 0.46, 12).translate(0, 0.23, 0), m: M(0, 0, 0, 0, 0, 0, 1, 1, 0.45), c: SKIN, t: 0.016 },
      { geo: new THREE.ConeGeometry(0.05, 0.33, 10).translate(0, 0.17, 0), m: M(0, 0.02, 0.022, 0, 0, 0, 1, 1, 0.3), c: 0xd98a7a, t: 0 }];
    var earL = mk(earGeo); earL.position.set(0.2, 0.24, -0.02); neck.add(earL);
    var earR = mk(earGeo); earR.position.set(-0.2, 0.24, -0.02); neck.add(earR);
    // arms: left free arm (balancing), right arm raised holding the tray
    var armL = new THREE.Group(); armL.position.set(0.2, 0.12, 0); body.add(armL);
    armL.add(mk([
      { geo: G.capsule(0.055, 0.24, 8), m: M(0, -0.17, 0), c: SHIRT, t: 0.016 },
      { geo: G.geo.sphereLo, m: M(0, -0.35, 0, 0, 0, 0, 0.065, 0.065, 0.065), c: SKIN, t: 0.014 }]));
    var armR = new THREE.Group(); armR.position.set(-0.2, 0.12, 0); body.add(armR);
    // upper arm up-and-out to elbow, forearm up to the palm under the tray centre
    var elbow = new THREE.Vector3(-0.23, 0.3, 0.2), palm = new THREE.Vector3(0.14, 0.72, 0.06);
    armR.add(mk([
      segment(new THREE.Vector3(0, 0, 0), elbow, 0.055, SHIRT),
      segment(elbow, palm, 0.05, SHIRT),
      { geo: G.geo.sphereLo, m: M(elbow.x, elbow.y, elbow.z, 0, 0, 0, 0.06, 0.06, 0.06), c: SHIRT, t: 0.016 },
      { geo: G.geo.sphereLo, m: M(palm.x, palm.y + 0.02, palm.z, 0, 0, 0, 0.085, 0.05, 0.085), c: SKIN, t: 0.014 }]));
    // sweat drop sprite
    var sweat = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.texSweat(), transparent: true, depthWrite: false }));
    sweat.scale.set(0.16, 0.16, 1); sweat.position.set(-0.26, 0.42, 0); sweat.visible = false;
    neck.add(sweat);

    var gob = {
      root: root, hips: hips, body: body, neck: neck, head: head, eyes: eyes, pupils: pupils, lids: lids,
      earL: earL, earR: earR, armL: armL, armR: armR, legL: legL, legR: legR, sweat: sweat,
      phase: 0, blinkT: 2, look: 0, panic: 0, dizzy: 0, lean: 0, cheer: 0, sad: 0,
      trayAnchor: new THREE.Vector3(-0.06, 1.5, 0.08)
    };
    root.userData.gob = gob;
    return gob;
  };

  function segment(a, b, r, color) {
    var d = new THREE.Vector3().subVectors(b, a);
    var len = d.length();
    var geo = G.capsule(r, Math.max(0.01, len - r), 8);
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    var m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return { geo: geo, m: m, c: color, t: 0.016 };
  }
  C.segment = segment;

  var _ghostMat = null;
  function ghostMat() {
    if (!_ghostMat) {
      _ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
    }
    return _ghostMat;
  }
  C.ghostMat = ghostMat;

  // animate goblin. st: {speed, accel, stun, panic, time, dt, pose}
  C.animateGoblin = function (g, st) {
    var dt = st.dt, sp = st.speed;
    var moving = Math.min(1, Math.abs(sp) / 2.2);
    g.phase += dt * (5 + Math.abs(sp) * 3.2);
    var ph = g.phase;
    var stepAmp = Math.min(1, Math.abs(sp) / 1.2);
    // legs
    g.legL.rotation.x = Math.sin(ph) * 0.8 * stepAmp;
    g.legR.rotation.x = -Math.sin(ph) * 0.8 * stepAmp;
    // skid pose when braking hard
    var skid = TT.clamp(-st.accel / 4, 0, 1) * Math.min(1, sp / 1.5);
    g.legL.rotation.x = TT.lerp(g.legL.rotation.x, -0.6, skid);
    g.legR.rotation.x = TT.lerp(g.legR.rotation.x, -0.3, skid);
    // body bob + lean
    var bob = Math.abs(Math.cos(ph)) * 0.05 * stepAmp;
    g.hips.position.y = 0.34 + bob;
    var targetLean = TT.clamp(st.accel * 0.06, -0.3, 0.3) + moving * 0.1;
    g.lean = TT.damp(g.lean, targetLean, 8, dt);
    g.body.rotation.x = g.lean;
    g.body.rotation.z = Math.sin(ph) * 0.08 * stepAmp + (st.dizzy || 0) * Math.sin(st.time * 11) * 0.2;
    g.hips.rotation.y = Math.sin(ph) * 0.12 * stepAmp;
    // free arm balances (flails when panicking)
    var panic = st.panic || 0;
    g.armL.rotation.z = 0.6 + Math.sin(st.time * 2.1) * 0.08 + panic * (0.6 + Math.sin(st.time * 19) * 0.4) + (g.cheer * 2.0);
    g.armL.rotation.x = -Math.sin(ph) * 0.4 * stepAmp;
    // ears flop with motion, droop when sad, perk when cheering
    var flop = Math.sin(ph * 2) * 0.12 * stepAmp;
    var droop = (g.sad || 0) * 0.7 - (g.cheer || 0) * 0.3;
    g.earL.rotation.z = -1.2 + flop - g.lean * 0.4 + droop - panic * 0.2;
    g.earR.rotation.z = 1.2 - flop + g.lean * 0.4 - droop + panic * 0.2;
    g.earL.rotation.x = -0.15 - moving * 0.35;
    g.earR.rotation.x = -0.15 - moving * 0.35;
    // head
    g.neck.rotation.x = -g.lean * 0.6 + (g.sad || 0) * 0.35 - (st.lookUp || 0) * 0.5;
    g.neck.rotation.y = TT.damp(g.neck.rotation.y, st.headYaw || 0, 6, dt);
    g.neck.rotation.z = (st.dizzy || 0) * Math.sin(st.time * 7) * 0.25;
    // eyes: blink, panic widen
    g.blinkT -= dt;
    var panicLid = st.panic || 0;
    var lid = 0.25 - panicLid * 0.2; // panic = wide eyes
    if (g.blinkT < 0) { lid = 1; if (g.blinkT < -0.12) g.blinkT = 1.5 + Math.random() * 3; }
    if (st.dizzy > 0.2) lid = 0.6;
    if (g.sad > 0.3) lid = Math.max(lid, 0.55);
    g.lids.scale.y = TT.damp(g.lids.scale.y, lid, 30, dt);
    g.lids.position.y = 0.337 * (1 - g.lids.scale.y);
    g.sweat.visible = panic > 0.35;
    if (g.sweat.visible) g.sweat.position.y = 0.42 + ((st.time * 1.5) % 1) * -0.12;
  };

  // ------------------------------------------------------------------ dragon
  C.makeDragon = function () {
    var M = G.M;
    var GREEN = 0x2f9e6e, GREEN_D = 0x1f6e4c, BELLY = 0xf2c14e, HORN = 0xf3e6c4;
    var root = new THREE.Group();
    var body = G.outlined(G.merge([
      { geo: G.geo.sphere, m: M(0, 0.75, 0, 0, 0, 0, 1.25, 0.8, 1.9), c: GREEN, t: 0.035 },
      { geo: G.geo.sphere, m: M(0, 0.5, 0.15, 0, 0, 0, 1.0, 0.5, 1.6), c: BELLY, t: 0 },
      // folded wings
      { geo: G.geo.cone, m: M(0.8, 1.25, -0.2, 0.2, 0, -1.2, 0.5, 1.6, 0.18), c: GREEN_D, t: 0.03 },
      { geo: G.geo.cone, m: M(-0.8, 1.25, -0.2, 0.2, 0, 1.2, 0.5, 1.6, 0.18), c: GREEN_D, t: 0.03 },
      // spikes
      { geo: G.geo.cone, m: M(0, 1.6, 0.9, -0.3, 0, 0, 0.12, 0.3, 0.12), c: HORN, t: 0.015 },
      { geo: G.geo.cone, m: M(0, 1.62, 0.3, -0.2, 0, 0, 0.13, 0.32, 0.13), c: HORN, t: 0.015 },
      { geo: G.geo.cone, m: M(0, 1.58, -0.35, -0.1, 0, 0, 0.13, 0.3, 0.13), c: HORN, t: 0.015 },
      { geo: G.geo.cone, m: M(0, 1.45, -1.0, 0.1, 0, 0, 0.12, 0.28, 0.12), c: HORN, t: 0.015 },
      // paws
      { geo: G.geo.sphere, m: M(0.8, 0.2, 1.3, 0, 0, 0, 0.35, 0.22, 0.45), c: GREEN, t: 0.025 },
      { geo: G.geo.sphere, m: M(-0.8, 0.2, 1.3, 0, 0, 0, 0.35, 0.22, 0.45), c: GREEN, t: 0.025 },
      { geo: G.geo.sphere, m: M(0.95, 0.22, -1.1, 0, 0, 0, 0.38, 0.24, 0.5), c: GREEN, t: 0.025 },
      { geo: G.geo.sphere, m: M(-0.95, 0.22, -1.1, 0, 0, 0, 0.38, 0.24, 0.5), c: GREEN, t: 0.025 }
    ]), G.toonVC);
    root.add(body);
    var headPivot = new THREE.Group(); headPivot.position.set(0, 0.7, 1.8); root.add(headPivot);
    var head = G.outlined(G.merge([
      { geo: G.geo.sphere, m: M(0, 0.1, 0.3, 0, 0, 0, 0.6, 0.5, 0.65), c: GREEN, t: 0.03 },
      { geo: G.geo.sphere, m: M(0, -0.02, 0.85, 0, 0, 0, 0.42, 0.3, 0.45), c: GREEN, t: 0.03 },
      { geo: G.geo.sphere, m: M(0, -0.16, 0.8, 0, 0, 0, 0.36, 0.14, 0.4), c: BELLY, t: 0 },
      { geo: G.geo.sphereLo, m: M(0.15, 0.1, 1.24, 0, 0, 0, 0.05, 0.04, 0.03), c: 0x0f2a1f, t: 0 },
      { geo: G.geo.sphereLo, m: M(-0.15, 0.1, 1.24, 0, 0, 0, 0.05, 0.04, 0.03), c: 0x0f2a1f, t: 0 },
      { geo: G.geo.cone, m: M(0.28, 0.55, 0.05, -0.7, 0, -0.3, 0.1, 0.45, 0.1), c: HORN, t: 0.02 },
      { geo: G.geo.cone, m: M(-0.28, 0.55, 0.05, -0.7, 0, 0.3, 0.1, 0.45, 0.1), c: HORN, t: 0.02 },
      // sleepy closed eyes (dark arcs)
      { geo: new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), m: M(0.27, 0.25, 0.72, 0, 0.5, Math.PI, 1, 1, 1), c: 0x0f2a1f, t: 0 },
      { geo: new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), m: M(-0.27, 0.25, 0.72, 0, -0.5, Math.PI, 1, 1, 1), c: 0x0f2a1f, t: 0 },
      // cheeks / brows
      { geo: G.geo.sphereLo, m: M(0.33, 0.33, 0.62, 0, 0, 0.3, 0.14, 0.06, 0.08), c: GREEN_D, t: 0.012 },
      { geo: G.geo.sphereLo, m: M(-0.33, 0.33, 0.62, 0, 0, -0.3, 0.14, 0.06, 0.08), c: GREEN_D, t: 0.012 }
    ]), G.toonVC);
    headPivot.add(head);
    // one eye that can open when disturbed
    var eyeOpen = G.outlined(G.merge([
      { geo: G.geo.sphereLo, m: M(0.27, 0.26, 0.74, 0, 0, 0, 0.12, 0.1, 0.06), c: 0xfff6c9, t: 0.012 },
      { geo: G.geo.sphereLo, m: M(0.27, 0.26, 0.79, 0, 0, 0, 0.03, 0.08, 0.02), c: 0x120806, t: 0 }]), G.toonVC);
    eyeOpen.visible = false;
    headPivot.add(eyeOpen);
    // tail segments (updated by the hazard)
    var segs = [];
    var N = 10;
    for (var i = 0; i < N; i++) {
      var r = TT.lerp(0.42, 0.14, i / (N - 1));
      var geo = G.merge([{ geo: G.geo.sphere, m: M(0, 0, 0, 0, 0, 0, r, r * 0.85, r), c: GREEN, t: 0.028 },
        { geo: G.geo.cone, m: M(0, r * 0.95, 0, 0, 0, 0, r * 0.35, r * 0.7, r * 0.35), c: HORN, t: 0.012 }]);
      var seg = G.outlined(geo, G.toonVC);
      seg.userData.r = r * 0.9;
      root.add(seg);
      segs.push(seg);
    }
    var tip = G.outlined(G.merge([{ geo: G.geo.cone, m: M(0, 0, 0, Math.PI / 2, 0, 0, 0.3, 0.45, 0.08), c: GREEN_D, t: 0.02 }]), G.toonVC);
    root.add(tip);
    return { root: root, body: body, headPivot: headPivot, head: head, eyeOpen: eyeOpen, segs: segs, tip: tip };
  };

  // ------------------------------------------------------------------ cat + mouse
  C.makeCat = function () {
    var M = G.M, O = 0xf08a2e, O2 = 0xc9661a, W = 0xfff3e0;
    var root = new THREE.Group();
    var body = G.outlined(G.merge([
      { geo: G.geo.sphere, m: M(0, 0.28, 0, 0, 0, 0, 0.17, 0.16, 0.34), c: O, t: 0.016 },
      { geo: G.geo.sphere, m: M(0, 0.22, 0.05, 0, 0, 0, 0.13, 0.1, 0.26), c: W, t: 0 },
      { geo: G.geo.box, m: M(0, 0.4, -0.05, 0, 0, 0, 0.1, 0.02, 0.05), c: O2, t: 0 },
      { geo: G.geo.box, m: M(0, 0.41, 0.08, 0, 0, 0, 0.1, 0.02, 0.05), c: O2, t: 0 }
    ]), G.toonVC);
    root.add(body);
    var head = G.outlined(G.merge([
      { geo: G.geo.sphere, m: M(0, 0.44, 0.34, 0, 0, 0, 0.16, 0.14, 0.14), c: O, t: 0.016 },
      { geo: G.geo.cone, m: M(0.09, 0.59, 0.32, 0, 0, -0.3, 0.06, 0.12, 0.04), c: O, t: 0.012 },
      { geo: G.geo.cone, m: M(-0.09, 0.59, 0.32, 0, 0, 0.3, 0.06, 0.12, 0.04), c: O, t: 0.012 },
      { geo: G.geo.sphereLo, m: M(0.06, 0.47, 0.46, 0, 0, 0, 0.035, 0.04, 0.02), c: 0xc7ff5a, t: 0.008 },
      { geo: G.geo.sphereLo, m: M(-0.06, 0.47, 0.46, 0, 0, 0, 0.035, 0.04, 0.02), c: 0xc7ff5a, t: 0.008 },
      { geo: G.geo.sphereLo, m: M(0.06, 0.47, 0.475, 0, 0, 0, 0.01, 0.03, 0.01), c: 0x111111, t: 0 },
      { geo: G.geo.sphereLo, m: M(-0.06, 0.47, 0.475, 0, 0, 0, 0.01, 0.03, 0.01), c: 0x111111, t: 0 },
      { geo: G.geo.sphereLo, m: M(0, 0.41, 0.48, 0, 0, 0, 0.02, 0.015, 0.015), c: 0xff8fa0, t: 0 }
    ]), G.toonVC);
    root.add(head);
    var legs = [];
    var lp = [[0.09, 0.22], [-0.09, 0.22], [0.09, -0.22], [-0.09, -0.22]];
    for (var i = 0; i < 4; i++) {
      var leg = G.outlined(G.merge([{ geo: G.capsule(0.04, 0.12, 6), m: M(0, -0.08, 0), c: O, t: 0.012 }]), G.toonVC);
      leg.position.set(lp[i][0], 0.2, lp[i][1]);
      root.add(leg); legs.push(leg);
    }
    var tail = new THREE.Group(); tail.position.set(0, 0.32, -0.3); root.add(tail);
    tail.add(G.outlined(G.merge([{ geo: G.capsule(0.035, 0.36, 6), m: M(0, 0.18, 0), c: O, t: 0.012 }]), G.toonVC));
    return { root: root, body: body, head: head, legs: legs, tail: tail };
  };

  C.makeMouse = function () {
    var M = G.M;
    var root = new THREE.Group();
    root.add(G.outlined(G.merge([
      { geo: G.geo.sphere, m: M(0, 0.07, 0, 0, 0, 0, 0.06, 0.055, 0.1), c: 0x9a938c, t: 0.01 },
      { geo: G.geo.sphereLo, m: M(0.04, 0.12, 0.05, 0, 0, 0, 0.03, 0.035, 0.01), c: 0xe8a0a0, t: 0.006 },
      { geo: G.geo.sphereLo, m: M(-0.04, 0.12, 0.05, 0, 0, 0, 0.03, 0.035, 0.01), c: 0xe8a0a0, t: 0.006 },
      { geo: G.geo.sphereLo, m: M(0, 0.07, 0.1, 0, 0, 0, 0.012, 0.012, 0.012), c: 0x201010, t: 0 },
      { geo: G.geo.cylLo, m: M(0, 0.05, -0.17, Math.PI / 2 - 0.2, 0, 0, 0.006, 0.16, 0.006), c: 0xd9a0a0, t: 0 }
    ]), G.toonVC));
    return { root: root };
  };

  C.makeBarrel = function () {
    var M = G.M;
    var geo = G.merge([
      { geo: new THREE.CylinderGeometry(0.4, 0.4, 0.78, 16, 1), m: M(0, 0, 0), c: 0x8b5a2b, t: 0.022 },
      { geo: new THREE.CylinderGeometry(0.43, 0.43, 0.5, 16, 1, true), m: M(0, 0, 0), c: 0x9c6632, t: 0 },
      { geo: new THREE.TorusGeometry(0.43, 0.025, 6, 20), m: M(0, 0.22, 0, Math.PI / 2, 0, 0), c: 0x505862, t: 0.01 },
      { geo: new THREE.TorusGeometry(0.43, 0.025, 6, 20), m: M(0, -0.22, 0, Math.PI / 2, 0, 0), c: 0x505862, t: 0.01 },
      { geo: G.geo.cylLo, m: M(0, 0.392, 0, 0, 0, 0, 0.3, 0.01, 0.3), c: 0x6b421f, t: 0 },
      { geo: G.geo.cylLo, m: M(0, -0.392, 0, 0, 0, 0, 0.3, 0.01, 0.3), c: 0x6b421f, t: 0 }
    ]);
    return G.outlined(geo, G.toonVC);
  };
})();
