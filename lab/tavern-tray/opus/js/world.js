/* Tipsy Tray — builds "The Sloshed Griffin": hall, bar, hearth, route rug, tables, crowd, lights */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx, C = TT.chars;
  var W = (TT.world = {});
  var M = G.M;

  var HALL = { x0: -14.5, x1: 14.5, z0: -78, z1: 10, h: 7.4 };
  W.HALL = HALL;

  W.build = function (scene) {
    var rng = TT.mulberry32(9127);
    TT.TRACK.start.x = -8.3;
    var path = new TT.Path(TT.TRACK);
    var crowd = new C.Crowd(scene);
    var ctx = {
      scene: scene, path: path, crowd: crowd, rng: rng,
      batch: [], plain: [], glows: new G.GlowSet(), blobs: [], zones: [], lights: []
    };
    W.ctx = ctx;
    W.path = path;
    W.crowd = crowd;

    buildShell(ctx);
    buildBar(ctx);
    buildHearth(ctx);
    buildRug(ctx);
    var hazards = TT.hazards.createAll(ctx);
    W.hazards = hazards;
    for (var i = 0; i < hazards.length; i++) {
      var hz = hazards[i];
      for (var j = 0; j < hz.zones.length; j++) ctx.zones.push(hz.zones[j]);
    }
    buildHighTable(ctx);
    var tables = [];
    // destination tables at the ends of crossing lanes
    for (i = 0; i < hazards.length; i++) {
      if (hazards[i].ends) for (j = 0; j < hazards[i].ends.length; j++) {
        var e = hazards[i].ends[j];
        if (insideHall(e.x, e.z, 1.2)) tables.push(placeTable(ctx, e.x, e.z, 'round', rng, true));
      }
    }
    buildPillars(ctx, tables);
    fillTables(ctx, tables);
    buildDecor(ctx, tables);
    buildChandeliers(ctx);
    // finalize static geometry
    var staticMesh = G.outlined(G.merge(ctx.batch), G.toonVC, true);
    staticMesh.matrixAutoUpdate = false;
    staticMesh.children[0].matrixAutoUpdate = false;
    scene.add(staticMesh);
    if (ctx.plain.length) {
      var plainMesh = new THREE.Mesh(G.merge(ctx.plain), G.toonVC);
      plainMesh.matrixAutoUpdate = false;
      scene.add(plainMesh);
    }
    buildBlobs(ctx);
    W.glowMat = G.makeGlowMaterial();
    scene.add(ctx.glows.build(W.glowMat));
    crowd.finalize();
    W.tables = tables;
    return W;
  };

  function insideHall(x, z, m) {
    return x > HALL.x0 + m && x < HALL.x1 - m && z > HALL.z0 + m && z < HALL.z1 - m;
  }

  // ---------------------------------------------------------------- walls, floor, ceiling
  function buildShell(ctx) {
    var scene = ctx.scene, b = ctx.batch;
    var w = HALL.x1 - HALL.x0, d = HALL.z1 - HALL.z0, cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;
    var planks = G.texPlanks();
    planks.repeat.set(w / 2.2, d / 2.2);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: planks, color: 0xd9b48a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);
    // side walls (plaster) + wainscot + timber frame
    var plaster = G.texPlaster();
    plaster.repeat.set(d / 4, HALL.h / 4);
    var wallMat = new THREE.MeshLambertMaterial({ map: plaster, color: 0xe0b98a });
    [HALL.x0, HALL.x1].forEach(function (x, idx) {
      var wall = new THREE.Mesh(new THREE.PlaneGeometry(d, HALL.h), wallMat);
      wall.position.set(x, HALL.h / 2, cz);
      wall.rotation.y = idx === 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(wall);
      var sgn = idx === 0 ? 1 : -1;
      b.push({ geo: G.geo.box, m: M(x + sgn * 0.1, 0.65, cz, 0, 0, 0, 0.2, 1.3, d), c: 0x4a2c18, t: 0.02 });
      b.push({ geo: G.geo.box, m: M(x + sgn * 0.16, 1.32, cz, 0, 0, 0, 0.14, 0.1, d), c: 0x6b4423, t: 0.015 });
      b.push({ geo: G.geo.box, m: M(x + sgn * 0.12, 3.6, cz, 0, 0, 0, 0.2, 0.28, d), c: 0x3d2414, t: 0.02 });
      for (var z = HALL.z1 - 2; z > HALL.z0; z -= 4) {
        b.push({ geo: G.geo.box, m: M(x + sgn * 0.12, HALL.h / 2, z, 0, 0, 0, 0.22, HALL.h, 0.3), c: 0x3d2414, t: 0.02 });
      }
      // windows + sconces + banners
      var k = 0;
      for (var wz = HALL.z1 - 6; wz > HALL.z0 + 3; wz -= 8, k++) {
        var win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), windowMat());
        win.position.set(x + sgn * 0.03, 5.0, wz);
        win.rotation.y = idx === 0 ? Math.PI / 2 : -Math.PI / 2;
        scene.add(win);
        b.push({ geo: G.geo.box, m: M(x + sgn * 0.06, 3.75, wz, 0, 0, 0, 0.16, 0.12, 1.8), c: 0x3d2414, t: 0.015 });
        // sconce between windows
        var sz = wz - 4;
        b.push({ geo: G.geo.box, m: M(x + sgn * 0.12, 2.6, sz, 0, 0, 0, 0.12, 0.35, 0.18), c: 0x2e2a2a, t: 0.012 });
        b.push({ geo: G.geo.cylLo, m: M(x + sgn * 0.3, 2.85, sz, 0, 0, 0, 0.05, 0.16, 0.05), c: 0xf3ead2, t: 0.01 });
        ctx.glows.add(x + sgn * 0.3, 3.02, sz, 0.55, 0xffb35a);
        if (k % 2 === 0) {
          var ban = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), bannerMat(k + idx));
          ban.position.set(x + sgn * 0.05, 5.2, sz);
          ban.rotation.y = idx === 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(ban);
        }
      }
    });
    // end walls
    var stone = G.texStone();
    stone.repeat.set(w / 3, HALL.h / 3);
    var far = new THREE.Mesh(new THREE.PlaneGeometry(w, HALL.h), new THREE.MeshLambertMaterial({ map: stone, color: 0xc8b0a0 }));
    far.position.set(cx, HALL.h / 2, HALL.z0);
    scene.add(far);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(w, HALL.h), wallMat);
    back.position.set(cx, HALL.h / 2, HALL.z1);
    back.rotation.y = Math.PI;
    scene.add(back);
    // ceiling
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: 0x3a2416 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, HALL.h, cz);
    scene.add(ceil);
    for (var bz = HALL.z1 - 1; bz > HALL.z0; bz -= 4.5) b.push({ geo: G.geo.box, m: M(cx, HALL.h - 0.35, bz, 0, 0, 0, w, 0.45, 0.4), c: 0x4a2c18, t: 0.025 });
    for (var bx = -9; bx <= 9; bx += 6) b.push({ geo: G.geo.box, m: M(bx, HALL.h - 0.8, cz, 0, 0, 0, 0.35, 0.4, d), c: 0x3d2414, t: 0.025 });
  }
  var _winMat = null;
  function windowMat() {
    if (!_winMat) _winMat = new THREE.MeshBasicMaterial({ map: G.texWindow(), color: 0xcfe0ff });
    return _winMat;
  }
  var _banners = [];
  function bannerMat(k) {
    if (!_banners.length) {
      var defs = [['#7e1d24', '#e9c46a', 'mug'], ['#1f3a5f', '#e8e0d0', 'moon'], ['#2f5d50', '#f2c14e', 'crown'], ['#5a2a6b', '#f28c38', 'flame']];
      for (var i = 0; i < defs.length; i++) _banners.push(new THREE.MeshLambertMaterial({ map: G.texBanner(defs[i][0], defs[i][1], defs[i][2]), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    }
    return _banners[k % _banners.length];
  }

  // ---------------------------------------------------------------- the bar at the start
  function buildBar(ctx) {
    var b = ctx.batch, p0 = ctx.path.sample(0, {});
    var bx = p0.x, bz = HALL.z1 - 2.6; // counter centre
    var len = 9.5;
    b.push({ geo: G.geo.box, m: M(bx, 0.55, bz, 0, 0, 0, len, 1.1, 0.9), c: 0x5c3a1c, t: 0.025 });
    b.push({ geo: G.geo.box, m: M(bx, 1.14, bz - 0.05, 0, 0, 0, len + 0.3, 0.1, 1.15), c: 0x8a5a2f, t: 0.02 });
    for (var i = 0; i < 12; i++) b.push({ geo: G.geo.box, m: M(bx - len / 2 + 0.4 + i * (len - 0.8) / 11, 0.55, bz - 0.47, 0, 0, 0, 0.12, 0.95, 0.05), c: 0x4a2c18, t: 0.01 });
    b.push({ geo: G.geo.cylLo, m: M(bx, 0.2, bz - 0.62, 0, 0, Math.PI / 2, 0.035, len, 0.035), c: 0xd9a441, t: 0.01 });
    // back shelves with bottles
    var sz = HALL.z1 - 0.35;
    b.push({ geo: G.geo.box, m: M(bx, 2.0, sz, 0, 0, 0, len, 4.0, 0.4), c: 0x3d2414, t: 0.02 });
    var bottleCols = [0x2f8f5a, 0x8f2f4f, 0x2f5f8f, 0xc79a2f, 0x6b3f9f, 0xd9e0e8, 0x9f5a2f];
    for (var lv = 0; lv < 3; lv++) {
      var y = 1.4 + lv * 0.85;
      b.push({ geo: G.geo.box, m: M(bx, y, sz - 0.28, 0, 0, 0, len - 0.2, 0.06, 0.45), c: 0x6b4423, t: 0.012 });
      for (var q = 0; q < 16; q++) {
        var x = bx - len / 2 + 0.5 + q * (len - 1) / 15 + (ctx.rng() - 0.5) * 0.15;
        var col = bottleCols[(q * 3 + lv * 5) % bottleCols.length];
        var hgt = 0.26 + ctx.rng() * 0.14;
        if ((q + lv) % 5 === 2) {
          b.push({ geo: G.geo.cylLo, m: M(x, y + 0.1, sz - 0.3, 0, 0, 0, 0.08, 0.17, 0.08), c: 0x8a5a33, t: 0.01 });
        } else {
          b.push({ geo: G.geo.cylLo, m: M(x, y + 0.03 + hgt / 2, sz - 0.3, 0, 0, 0, 0.06, hgt, 0.06), c: col, t: 0.01 });
          b.push({ geo: G.geo.cylLo, m: M(x, y + 0.03 + hgt + 0.06, sz - 0.3, 0, 0, 0, 0.022, 0.12, 0.022), c: col, t: 0.008 });
        }
      }
    }
    // kegs
    [-1, 1].forEach(function (sgn) {
      var kx = bx + sgn * (len / 2 - 0.9);
      b.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.9, 16), m: M(kx, 1.62, bz + 0.1, Math.PI / 2, 0, 0), c: 0x8b5a2b, t: 0.02 });
      b.push({ geo: new THREE.TorusGeometry(0.44, 0.03, 6, 18), m: M(kx, 1.62, bz - 0.2, 0, 0, 0), c: 0x505862, t: 0.01 });
      b.push({ geo: new THREE.TorusGeometry(0.44, 0.03, 6, 18), m: M(kx, 1.62, bz + 0.4, 0, 0, 0), c: 0x505862, t: 0.01 });
      b.push({ geo: G.geo.box, m: M(kx, 1.22, bz + 0.1, 0, 0, 0, 0.7, 0.12, 0.5), c: 0x4a2c18, t: 0.012 });
      b.push({ geo: G.geo.cylLo, m: M(kx, 1.5, bz - 0.36, Math.PI / 2, 0, 0, 0.04, 0.14, 0.04), c: 0xd9a441, t: 0.008 });
    });
    // sign
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: G.texSign(['The Sloshed Griffin', 'est. a very long time ago']), transparent: true }));
    sign.position.set(bx, 4.7, sz - 0.25);
    sign.rotation.y = Math.PI;
    ctx.scene.add(sign);
    // barkeep
    var keep = ctx.crowd.add({ kind: 'dwarf', pose: 'wipe', scale: 0.95, width: 1.5, skin: 0xe8a987, shirt: 0x7a3a2a, pants: 0x3a2c24, beard: true, beardColor: 0xc44a1a, hair: 0xc44a1a, nose: 1.8, apron: true, mug: true });
    keep.x = bx - 1.2; keep.z = bz + 0.9; keep.yaw = Math.PI; keep.lookRange = 6;
    W.barkeep = keep;
    // bar lamp light
    var l = new THREE.PointLight(0xffc27a, 22, 13, 1.5);
    l.position.set(bx, 3.3, bz - 1.2);
    ctx.scene.add(l);
    ctx.lights.push({ light: l, base: 22, flick: 0.08 });
    ctx.glows.add(bx - 2.5, 1.35, bz - 0.2, 0.5, 0xffb35a);
    ctx.glows.add(bx + 2.5, 1.35, bz - 0.2, 0.5, 0xffb35a);
    b.push({ geo: G.geo.cylLo, m: M(bx - 2.5, 1.25, bz - 0.2, 0, 0, 0, 0.05, 0.15, 0.05), c: 0xf3ead2, t: 0.01 });
    b.push({ geo: G.geo.cylLo, m: M(bx + 2.5, 1.25, bz - 0.2, 0, 0, 0, 0.05, 0.15, 0.05), c: 0xf3ead2, t: 0.01 });
    ctx.zones.push({ x: bx, z: bz, r: 0.1 });
    for (var zx = bx - len / 2; zx <= bx + len / 2; zx += 1.2) ctx.zones.push({ x: zx, z: bz - 0.4, r: 1.4 });
    // stools at the bar ends
    [-3.8, 3.8].forEach(function (o) { stool(ctx, bx + o, bz - 1.0, 0.45); });
  }

  // ---------------------------------------------------------------- hearth at the far end
  function buildHearth(ctx) {
    var b = ctx.batch, end = ctx.path.sample(ctx.path.length, {});
    var fx = end.x, fz = HALL.z0;
    W.hearth = { x: fx, z: fz + 1.2 };
    var st = 0x6e5e58, st2 = 0x5a4c47;
    b.push({ geo: G.geo.box, m: M(fx - 2.2, 1.6, fz + 0.6, 0, 0, 0, 1.2, 3.2, 1.2), c: st, t: 0.025 });
    b.push({ geo: G.geo.box, m: M(fx + 2.2, 1.6, fz + 0.6, 0, 0, 0, 1.2, 3.2, 1.2), c: st, t: 0.025 });
    b.push({ geo: G.geo.box, m: M(fx, 3.5, fz + 0.6, 0, 0, 0, 5.6, 0.8, 1.3), c: st2, t: 0.025 });
    b.push({ geo: G.geo.box, m: M(fx, 3.98, fz + 0.75, 0, 0, 0, 6.0, 0.18, 1.5), c: 0x5c3a1c, t: 0.02 });
    b.push({ geo: G.geo.box, m: M(fx, 5.8, fz + 0.4, 0, 0, 0, 4.4, 3.6, 0.8), c: st, t: 0.025 });
    b.push({ geo: G.geo.box, m: M(fx, 0.08, fz + 1.4, 0, 0, 0, 5.2, 0.16, 1.4), c: st2, t: 0.02 });
    b.push({ geo: G.geo.box, m: M(fx, 1.5, fz + 0.12, 0, 0, 0, 3.2, 3.0, 0.2), c: 0x1a100c, t: 0 });
    // logs
    b.push({ geo: G.geo.cylLo, m: M(fx - 0.3, 0.3, fz + 0.9, 0, 0.3, Math.PI / 2, 0.16, 1.8, 0.16), c: 0x4a2c18, t: 0.015 });
    b.push({ geo: G.geo.cylLo, m: M(fx + 0.3, 0.3, fz + 0.8, 0, -0.4, Math.PI / 2, 0.15, 1.7, 0.15), c: 0x5a3418, t: 0.015 });
    b.push({ geo: G.geo.cylLo, m: M(fx, 0.55, fz + 0.85, 0, 0.1, Math.PI / 2, 0.14, 1.5, 0.14), c: 0x4a2c18, t: 0.015 });
    // shield + crossed axes above the mantel
    b.push({ geo: G.geo.cyl, m: M(fx, 5.3, fz + 0.85, Math.PI / 2, 0, 0, 0.8, 0.1, 0.8), c: 0x7e1d24, t: 0.02 });
    b.push({ geo: G.geo.cyl, m: M(fx, 5.3, fz + 0.9, Math.PI / 2, 0, 0, 0.5, 0.1, 0.5), c: 0xe0ad4a, t: 0.012 });
    b.push({ geo: G.geo.box, m: M(fx, 5.3, fz + 0.8, 0, 0, 0.75, 0.1, 2.3, 0.08), c: 0x5c3a1c, t: 0.012 });
    b.push({ geo: G.geo.box, m: M(fx, 5.3, fz + 0.8, 0, 0, -0.75, 0.1, 2.3, 0.08), c: 0x5c3a1c, t: 0.012 });
    // candles on the mantel
    for (var i = -2; i <= 2; i++) {
      if (i === 0) continue;
      b.push({ geo: G.geo.cylLo, m: M(fx + i * 1.2, 4.2, fz + 1.1, 0, 0, 0, 0.06, 0.28 + (i % 2) * 0.1, 0.06), c: 0xf3ead2, t: 0.01 });
      ctx.glows.add(fx + i * 1.2, 4.42 + (i % 2) * 0.05, fz + 1.1, 0.5, 0xffb35a);
    }
    // fire glows (big + small)
    ctx.glows.add(fx, 0.9, fz + 1.0, 3.6, 0xff7a2a);
    ctx.glows.add(fx - 0.5, 0.7, fz + 1.05, 1.8, 0xffb13a);
    ctx.glows.add(fx + 0.55, 0.75, fz + 1.05, 1.7, 0xffa02a);
    ctx.glows.add(fx, 1.3, fz + 1.0, 1.6, 0xffd070);
    var l = new THREE.PointLight(0xff7a30, 70, 26, 1.35);
    l.position.set(fx, 1.3, fz + 2.2);
    ctx.scene.add(l);
    ctx.lights.push({ light: l, base: 70, flick: 0.22, fire: true });
    ctx.zones.push({ x: fx, z: fz + 1.5, r: 3.2 });
    W.fire = { x: fx, y: 0.9, z: fz + 1.0 };
  }

  // ---------------------------------------------------------------- route rug
  function buildRug(ctx) {
    var path = ctx.path, L = path.length, w = 0.68;
    var n = Math.ceil(L / 0.25);
    var pos = [], uv = [], idx = [], f = {};
    for (var i = 0; i <= n; i++) {
      var s = i / n * L;
      path.sample(s, f);
      pos.push(f.x - f.rx * w, 0.006, f.z - f.rz * w, f.x + f.rx * w, 0.006, f.z + f.rz * w);
      uv.push(0, s / 2.8, 1, s / 2.8);
      if (i < n) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var nor = g.attributes.normal;
    for (var k = 0; k < nor.count; k++) nor.setXYZ(k, 0, 1, 0);
    var rug = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: G.texRug(), side: THREE.DoubleSide }));
    rug.renderOrder = -2;
    ctx.scene.add(rug);
  }

  // ---------------------------------------------------------------- the high table (customers)
  function buildHighTable(ctx) {
    var end = ctx.path.sample(ctx.path.length, {});
    var cx = end.x + end.tx * 1.3, cz = end.z + end.tz * 1.3;
    W.highTable = { x: cx, z: cz, top: 0.8 };
    var b = ctx.batch;
    b.push({ geo: new THREE.CylinderGeometry(0.95, 0.95, 0.09, 28), m: M(cx, 0.8, cz), c: 0x8a5a2f, t: 0.022 });
    b.push({ geo: new THREE.CylinderGeometry(0.9, 0.9, 0.012, 28), m: M(cx, 0.85, cz), c: 0xb8323a, t: 0 });
    b.push({ geo: G.geo.cylLo, m: M(cx, 0.4, cz, 0, 0, 0, 0.12, 0.75, 0.12), c: 0x5c3a1c, t: 0.015 });
    b.push({ geo: G.geo.cylLo, m: M(cx, 0.04, cz, 0, 0, 0, 0.5, 0.08, 0.5), c: 0x5c3a1c, t: 0.015 });
    b.push({ geo: G.geo.cylLo, m: M(cx + 0.25, 0.95, cz + 0.2, 0, 0, 0, 0.05, 0.2, 0.05), c: 0xf3ead2, t: 0.01 });
    ctx.glows.add(cx + 0.25, 1.1, cz + 0.2, 0.55, 0xffb35a);
    ctx.blobs.push({ x: cx, z: cz, s: 2.4 });
    // customers: dwarf (ale), elf (wine), gnome (fizz)
    var seats = [
      { a: 0, o: C.randomPerson(ctx.rng, 'dwarf', { pose: 'sit', hat: 'helmet', shirt: 0x2f5d50, beardColor: 0xc47a2a, hair: 0xc47a2a }), drink: 'ale' },
      { a: 1, o: C.randomPerson(ctx.rng, 'elf', { pose: 'sit', shirt: 0x8e2f6b, hair: 0xe8e0d0, hat: null }), drink: 'wine' },
      { a: -1, o: C.randomPerson(ctx.rng, 'gnome', { pose: 'sit', shirt: 0x2f6b9f, hatColor: 0x2fb3a0 }), drink: 'fizz' }
    ];
    W.customers = [];
    for (var i = 0; i < seats.length; i++) {
      var sa = seats[i];
      // a = 0 far side (facing the goblin), +-1 to the sides
      var ang = Math.atan2(end.tx, end.tz) + sa.a * Math.PI / 2;
      var px = cx + Math.sin(ang) * 1.05, pz = cz + Math.cos(ang) * 1.05;
      var p = ctx.crowd.add(sa.o);
      p.x = px; p.z = pz; p.yaw = Math.atan2(cx - px, cz - pz); p.lookRange = 14;
      stool(ctx, px, pz, 0.45);
      W.customers.push({ p: p, drink: sa.drink, seat: { x: cx + Math.sin(ang) * 0.55, z: cz + Math.cos(ang) * 0.55 } });
    }
    ctx.zones.push({ x: cx, z: cz, r: 2.8 });
  }

  // ---------------------------------------------------------------- pillars + beams
  function buildPillars(ctx, tables) {
    var b = ctx.batch;
    W.pillars = [];
    for (var z = HALL.z1 - 5; z > HALL.z0 + 4; z -= 9) {
      for (var x = -11.5; x <= 11.5; x += 5.75) {
        if (ctx.path.distance(x, z).d < 2.1) continue;
        if (blocked(ctx, x, z, 0.8)) continue;
        b.push({ geo: G.geo.box, m: M(x, HALL.h / 2, z, 0, 0, 0, 0.5, HALL.h, 0.5), c: 0x4a2c18, t: 0.025 });
        b.push({ geo: G.geo.box, m: M(x, 0.25, z, 0, 0, 0, 0.75, 0.5, 0.75), c: 0x6e5e58, t: 0.02 });
        b.push({ geo: G.geo.box, m: M(x, HALL.h - 1.3, z + 0.9, 0.78, 0, 0, 0.22, 2.2, 0.22), c: 0x3d2414, t: 0.015 });
        b.push({ geo: G.geo.box, m: M(x, HALL.h - 1.3, z - 0.9, -0.78, 0, 0, 0.22, 2.2, 0.22), c: 0x3d2414, t: 0.015 });
        ctx.blobs.push({ x: x, z: z, s: 1.3 });
        ctx.zones.push({ x: x, z: z, r: 0.9 });
        W.pillars.push({ x: x, z: z });
      }
    }
  }

  function blocked(ctx, x, z, r) {
    for (var i = 0; i < ctx.zones.length; i++) {
      var q = ctx.zones[i], dx = q.x - x, dz = q.z - z;
      if (dx * dx + dz * dz < (q.r + r) * (q.r + r)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- tables
  var CYL5 = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
  function stool(ctx, x, z, h) {
    var b = ctx.batch;
    b.push({ geo: G.geo.cylLo, m: M(x, h, z, 0, 0, 0, 0.22, 0.07, 0.22), c: 0x7a4a26, t: 0.015 });
    for (var i = 0; i < 3; i++) {
      var a = i * 2.094;
      b.push({ geo: CYL5, m: M(x + Math.cos(a) * 0.13, h / 2, z + Math.sin(a) * 0.13, Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15, 0.025, h, 0.025), c: 0x5c3a1c, t: 0.01 });
    }
  }

  function tableClutter(ctx, x, z, top, rad, r) {
    var b = ctx.batch;
    var n = 2 + Math.floor(r() * 3);
    for (var i = 0; i < n; i++) {
      var a = r() * Math.PI * 2, d = r() * rad * 0.6;
      var px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      var kind = r();
      if (kind < 0.35) {
        b.push({ geo: G.geo.cylLo, m: M(px, top + 0.09, pz, 0, 0, 0, 0.07, 0.16, 0.07), c: 0x8a5a33, t: 0.01 });
        b.push({ geo: G.geo.cylLo, m: M(px, top + 0.175, pz, 0, 0, 0, 0.062, 0.015, 0.062), c: 0xfff0cf, t: 0 });
      } else if (kind < 0.6) {
        b.push({ geo: G.geo.cylLo, m: M(px, top + 0.02, pz, 0, 0, 0, 0.2, 0.02, 0.2), c: 0xe8e0d0, t: 0.008 });
        if (r() < 0.6) b.push({ geo: G.geo.sphereLo, m: M(px, top + 0.08, pz, 0, r() * 3, 0, 0.12, 0.07, 0.08), c: 0xc27c3a, t: 0.01 });
        else b.push({ geo: G.geo.sphereLo, m: M(px, top + 0.07, pz, 0, 0, 0, 0.06, 0.06, 0.06), c: 0xd8342c, t: 0.008 });
      } else if (kind < 0.8) {
        var hh = 0.28;
        b.push({ geo: G.geo.cylLo, m: M(px, top + hh / 2, pz, 0, 0, 0, 0.055, hh, 0.055), c: TT.pick([0x2f8f5a, 0x8f2f4f, 0x2f5f8f, 0x6b3f9f], r), t: 0.01 });
        b.push({ geo: G.geo.cylLo, m: M(px, top + hh + 0.05, pz, 0, 0, 0, 0.02, 0.1, 0.02), c: 0x2f5f4f, t: 0.008 });
      } else {
        b.push({ geo: G.geo.sphereLo, m: M(px, top + 0.05, pz, 0, r() * 3, 0, 0.14, 0.06, 0.09), c: 0xd9a05a, t: 0.01 });
      }
    }
    // candle
    b.push({ geo: G.geo.cylLo, m: M(x, top + 0.09, z, 0, 0, 0, 0.045, 0.16, 0.045), c: 0xf3ead2, t: 0.01 });
    ctx.glows.add(x, top + 0.22, z, 0.42, 0xffb35a);
  }

  function placeTable(ctx, x, z, type, r, forceRound) {
    var b = ctx.batch;
    var yaw = r() * Math.PI;
    var top = 0.74;
    var t = { x: x, z: z, type: type, yaw: yaw, seats: [], near: ctx.path.distance(x, z) };
    if (type === 'round' || forceRound) {
      t.type = 'round';
      var rad = 0.72 + r() * 0.12;
      b.push({ geo: new THREE.CylinderGeometry(rad, rad, 0.08, 16), m: M(x, top, z), c: TT.pick([0x7a4a26, 0x8a5a2f, 0x6b4423], r), t: 0.022 });
      b.push({ geo: G.geo.cylLo, m: M(x, top / 2, z, 0, 0, 0, 0.1, top, 0.1), c: 0x4a2c18, t: 0.014 });
      b.push({ geo: G.geo.box, m: M(x, 0.04, z, 0, yaw, 0, 0.9, 0.06, 0.12), c: 0x4a2c18, t: 0.012 });
      b.push({ geo: G.geo.box, m: M(x, 0.04, z, 0, yaw + Math.PI / 2, 0, 0.9, 0.06, 0.12), c: 0x4a2c18, t: 0.012 });
      tableClutter(ctx, x, z, top + 0.04, rad, r);
      var ns = 3 + (r() < 0.5 ? 1 : 0);
      for (var i = 0; i < ns; i++) {
        var a = yaw + i * Math.PI * 2 / ns + (r() - 0.5) * 0.3;
        var sx = x + Math.sin(a) * (rad + 0.35), sz = z + Math.cos(a) * (rad + 0.35);
        stool(ctx, sx, sz, 0.45);
        t.seats.push({ x: sx, z: sz, yaw: Math.atan2(x - sx, z - sz) });
      }
      ctx.blobs.push({ x: x, z: z, s: rad * 2.6 });
      ctx.zones.push({ x: x, z: z, r: rad + 0.75 });
    } else {
      var lx = Math.sin(yaw), lz = Math.cos(yaw), len = 2.4;
      b.push({ geo: G.geo.box, m: M(x, top, z, 0, yaw, 0, 0.95, 0.08, len), c: TT.pick([0x7a4a26, 0x8a5a2f], r), t: 0.022 });
      [-1, 1].forEach(function (e) {
        b.push({ geo: G.geo.box, m: M(x + lx * e * (len / 2 - 0.25), top / 2, z + lz * e * (len / 2 - 0.25), 0, yaw, 0, 0.8, top, 0.1), c: 0x4a2c18, t: 0.014 });
      });
      var px = lz, pz = -lx; // perpendicular
      [-1, 1].forEach(function (sd) {
        var bxx = x + px * sd * 0.8, bzz = z + pz * sd * 0.8;
        b.push({ geo: G.geo.box, m: M(bxx, 0.45, bzz, 0, yaw, 0, 0.34, 0.07, len - 0.1), c: 0x6b4423, t: 0.015 });
        b.push({ geo: G.geo.box, m: M(bxx, 0.22, bzz, 0, yaw, 0, 0.26, 0.44, 0.08), c: 0x4a2c18, t: 0.01 });
        for (var k = -1; k <= 1; k += 2) {
          var off = k * 0.55;
          t.seats.push({ x: bxx + lx * off, z: bzz + lz * off, yaw: Math.atan2(-px * sd, -pz * sd) });
        }
      });
      tableClutter(ctx, x + lx * 0.6, z + lz * 0.6, top + 0.04, 0.45, r);
      tableClutter(ctx, x - lx * 0.6, z - lz * 0.6, top + 0.04, 0.45, r);
      ctx.blobs.push({ x: x, z: z, s: 2.8 });
      ctx.zones.push({ x: x, z: z, r: 1.75 });
    }
    return t;
  }

  function fillTables(ctx, tables) {
    var r = ctx.rng, path = ctx.path;
    var cand = [];
    for (var z = HALL.z1 - 4.5; z > HALL.z0 + 2; z -= 2.2) {
      for (var x = HALL.x0 + 1.8; x < HALL.x1 - 1.8; x += 2.2) {
        var jx = x + (r() - 0.5) * 1.2, jz = z + (r() - 0.5) * 1.2;
        var pd = path.distance(jx, jz);
        if (pd.d < 2.45) continue;
        cand.push({ x: jx, z: jz, d: pd.d, pr: pd.d + r() * 3 });
      }
    }
    cand.sort(function (a, b) { return a.pr - b.pr; });
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i];
      var long = r() < 0.3 && c.d > 3.2;
      var rad = long ? 1.85 : 1.35;
      if (!insideHall(c.x, c.z, rad + 0.3)) continue;
      if (blocked(ctx, c.x, c.z, rad)) continue;
      tables.push(placeTable(ctx, c.x, c.z, long ? 'long' : 'round', r));
    }
    // seat patrons: dense near the route, sparser further away
    var count = 0;
    for (var t = 0; t < tables.length; t++) {
      var T = tables[t];
      var near = T.near.d;
      var fill = near < 4.5 ? 0.85 : near < 8 ? 0.55 : near < 12 ? 0.22 : 0;
      for (var s = 0; s < T.seats.length; s++) {
        if (r() > fill || count > 96) continue;
        var seat = T.seats[s];
        var o = C.randomPerson(r, null, { pose: 'sit', mug: r() < 0.7 });
        var p = ctx.crowd.add(o);
        p.x = seat.x; p.z = seat.z; p.yaw = seat.yaw;
        p.lookTarget = null; p.lookRange = 3.8;
        p.ambient = true;
        count++;
      }
    }
    W.patronCount = count;
  }

  // ---------------------------------------------------------------- clutter: barrels, crates, standing groups
  function buildDecor(ctx, tables) {
    var b = ctx.batch, r = ctx.rng;
    // barrel & crate stacks along the walls
    for (var z = HALL.z1 - 7; z > HALL.z0 + 4; z -= 5.5) {
      [HALL.x0 + 0.9, HALL.x1 - 0.9].forEach(function (x) {
        if (r() < 0.35 || blocked(ctx, x, z, 0.7)) return;
        if (r() < 0.6) {
          b.push({ geo: new THREE.CylinderGeometry(0.4, 0.4, 0.8, 14), m: M(x, 0.4, z), c: 0x8b5a2b, t: 0.02 });
          b.push({ geo: new THREE.TorusGeometry(0.42, 0.025, 6, 16), m: M(x, 0.62, z, Math.PI / 2, 0, 0), c: 0x505862, t: 0.01 });
          b.push({ geo: new THREE.TorusGeometry(0.42, 0.025, 6, 16), m: M(x, 0.18, z, Math.PI / 2, 0, 0), c: 0x505862, t: 0.01 });
          if (r() < 0.5) b.push({ geo: new THREE.CylinderGeometry(0.4, 0.4, 0.8, 14), m: M(x, 0.4, z + 0.85), c: 0x7a4a26, t: 0.02 });
        } else {
          b.push({ geo: G.geo.box, m: M(x, 0.35, z, 0, r(), 0, 0.7, 0.7, 0.7), c: 0x9c6632, t: 0.02 });
          b.push({ geo: G.geo.box, m: M(x, 0.95, z, 0, r(), 0, 0.5, 0.5, 0.5), c: 0x8a5a2f, t: 0.02 });
        }
        ctx.blobs.push({ x: x, z: z, s: 1.3 });
      });
    }
    // a big keg stack on the inside of the first tight turn
    var f = ctx.path.sample(13, {});
    var kx = f.x + f.rx * 2.6, kz = f.z + f.rz * 2.6;
    if (!blocked(ctx, kx, kz, 0.5)) {
      for (var i = 0; i < 3; i++) {
        b.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14), m: M(kx + (i - 1) * 0.86, 0.42, kz, 0, 0, Math.PI / 2), c: 0x8b5a2b, t: 0.02 });
      }
      b.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14), m: M(kx - 0.43, 1.15, kz, 0, 0, Math.PI / 2), c: 0x7a4a26, t: 0.02 });
      b.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14), m: M(kx + 0.43, 1.15, kz, 0, 0, Math.PI / 2), c: 0x8b5a2b, t: 0.02 });
      ctx.blobs.push({ x: kx, z: kz, s: 2.6 });
      ctx.zones.push({ x: kx, z: kz, r: 1.3 });
    }
    // standing chatters near pillars
    var n = 0;
    for (var p = 0; p < W.pillars.length && n < 10; p++) {
      var pl = W.pillars[p];
      if (ctx.path.distance(pl.x, pl.z).d > 9 || r() < 0.4) continue;
      for (var k = 0; k < 2; k++) {
        var a = r() * Math.PI * 2;
        var px = pl.x + Math.cos(a) * 0.95, pz = pl.z + Math.sin(a) * 0.95;
        if (ctx.path.distance(px, pz).d < 1.6) continue;
        var person = ctx.crowd.add(C.randomPerson(r, null, { pose: 'stand', mug: r() < 0.8 }));
        person.x = px; person.z = pz; person.yaw = a + Math.PI * (0.7 + r() * 0.6);
        person.lookRange = 3.5; person.ambient = true;
        n++;
      }
    }
  }

  // ---------------------------------------------------------------- chandeliers above the route
  function buildChandeliers(ctx) {
    var b = ctx.batch;
    var list = [10, 31, 52, 74];
    W.chandeliers = [];
    for (var i = 0; i < list.length; i++) {
      var f = ctx.path.sample(list[i], {});
      var x = f.x, z = f.z, y = 4.6;
      b.push({ geo: new THREE.TorusGeometry(0.9, 0.06, 6, 24), m: M(x, y, z, Math.PI / 2, 0, 0), c: 0x4a2c18, t: 0.015 });
      b.push({ geo: G.geo.cylLo, m: M(x, y, z, 0, 0, 0, 0.12, 0.3, 0.12), c: 0x3d2414, t: 0.012 });
      b.push({ geo: G.geo.cylLo, m: M(x, (y + HALL.h) / 2, z, 0, 0, 0, 0.025, HALL.h - y, 0.025), c: 0x2e2a2a, t: 0 });
      for (var k = 0; k < 4; k++) {
        var a = k * Math.PI / 2;
        b.push({ geo: G.geo.box, m: M(x, y, z, 0, a, 0, 1.8, 0.05, 0.06), c: 0x3d2414, t: 0.01 });
      }
      for (var c = 0; c < 8; c++) {
        var ca = c * Math.PI / 4;
        var cx = x + Math.cos(ca) * 0.9, cz = z + Math.sin(ca) * 0.9;
        b.push({ geo: G.geo.cylLo, m: M(cx, y + 0.13, cz, 0, 0, 0, 0.04, 0.2, 0.04), c: 0xf3ead2, t: 0.008 });
        ctx.glows.add(cx, y + 0.3, cz, 0.45, 0xffb35a);
      }
      ctx.glows.add(x, y + 0.2, z, 2.4, 0xff9a40);
      var l = new THREE.PointLight(0xffb866, 26, 15, 1.45);
      l.position.set(x, y - 0.2, z);
      ctx.scene.add(l);
      ctx.lights.push({ light: l, base: 26, flick: 0.06 });
      W.chandeliers.push({ x: x, z: z });
    }
  }

  // ---------------------------------------------------------------- blob shadows
  function buildBlobs(ctx) {
    var tex = G.texBlob();
    var mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x1a0c05, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    W.blobMat = mat;
    var pos = [], uv = [], idx = [];
    for (var i = 0; i < ctx.blobs.length; i++) {
      var bl = ctx.blobs[i], h = bl.s / 2, base = i * 4;
      pos.push(bl.x - h, 0.012, bl.z - h, bl.x + h, 0.012, bl.z - h, bl.x + h, 0.012, bl.z + h, bl.x - h, 0.012, bl.z + h);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    var mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = -1;
    ctx.scene.add(mesh);
  }
})();
