/* Tipsy Tray — the tray, glass vessels and live liquid surfaces */
(function () {
  'use strict';
  var TT = window.TT, G = TT.gfx;
  var D = (TT.drinks = {});

  D.glassMat = function (tint) {
    return new THREE.ShaderMaterial({
      uniforms: { uTint: { value: new THREE.Color(tint) }, uOpacity: { value: 1 } },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV; varying vec3 vVN;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vV = normalize(cameraPosition - wp.xyz);',
        '  vVN = normalize(normalMatrix * normal);',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTint; uniform float uOpacity;',
        'varying vec3 vN; varying vec3 vV; varying vec3 vVN;',
        'void main(){',
        '  vec3 n = normalize(vN); vec3 vn = normalize(vVN);',
        '  if (!gl_FrontFacing) { n = -n; vn = -vn; }',
        '  float ndv = abs(dot(n, normalize(vV)));',
        '  float fr = pow(1.0 - ndv, 2.0);',
        '  vec3 col = mix(uTint, vec3(1.0), 0.45);',
        '  float a = 0.07 + fr * 0.5;',
        '  float edge = smoothstep(0.52, 0.8, 1.0 - ndv);',
        '  col = mix(col, vec3(0.08, 0.045, 0.03), edge);',
        '  a = mix(a, 0.92, edge);',
        '  float stripe = (1.0 - smoothstep(0.02, 0.12, abs(vn.x + 0.5))) * step(0.0, vn.z) * (gl_FrontFacing ? 1.0 : 0.0);',
        '  col = mix(col, vec3(1.0), stripe * 0.9);',
        '  a = max(a, stripe * 0.75);',
        '  gl_FragColor = vec4(col, a * uOpacity);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  };

  // liquid geometry: frustum r0 (bottom) -> r1 (top) of height H, origin at the bottom
  function liquidGeo(d) {
    var g = new THREE.CylinderGeometry(d.r1 - 0.004, d.r0 - 0.004, d.H, 32, 1, false);
    g.translate(0, d.H / 2, 0);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var top = [], centers = [], caps = [];
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      if (Math.abs(y - d.H) < 1e-5) {
        var x = pos.getX(i), z = pos.getZ(i), r = Math.sqrt(x * x + z * z);
        var isCap = nor.getY(i) > 0.99;
        if (r < 1e-5) centers.push(i);
        else top.push({ i: i, cx: x / r, cz: z / r });
        if (isCap) caps.push(i);
      }
    }
    pos.setUsage(THREE.DynamicDrawUsage);
    nor.setUsage(THREE.DynamicDrawUsage);
    return { geo: g, top: top, centers: centers, caps: caps };
  }

  D.makeTray = function () {
    var M = G.M;
    var tray = new THREE.Group();
    var base = G.outlined(G.merge([
      { geo: new THREE.CylinderGeometry(0.5, 0.47, 0.045, 40), m: M(0, 0.0225, 0), c: 0x7a4a26, t: 0.02 },
      { geo: new THREE.CylinderGeometry(0.455, 0.455, 0.004, 40), m: M(0, 0.046, 0), c: 0x9a6234, t: 0 },
      { geo: new THREE.TorusGeometry(0.49, 0.03, 8, 44), m: M(0, 0.05, 0, Math.PI / 2, 0, 0), c: 0xe6b34e, t: 0.014 }
    ]), G.toonVC);
    tray.add(base);
    var cups = [];
    for (var k = 0; k < TT.DRINK_DEFS.length; k++) cups.push(D.makeCup(TT.DRINK_DEFS[k], tray));
    return { group: tray, base: base, cups: cups, tiltX: 0, tiltZ: 0, vX: 0, vZ: 0 };
  };

  D.makeCup = function (d, tray) {
    var M = G.M;
    var cup = new THREE.Group();
    cup.position.set(d.pos[0], 0.048, d.pos[2]);
    tray.add(cup);
    var baseY = 0; // where the liquid starts inside the vessel
    var glassTint = d.vessel === 'stein' ? 0xfff2d8 : d.vessel === 'goblet' ? 0xffe0f0 : 0xd8fff8;
    var glass = D.glassMat(glassTint);
    var solid = [];
    var gd = 0.008; // glass thickness
    if (d.vessel === 'goblet') {
      baseY = 0.12;
      solid.push({ geo: new THREE.CylinderGeometry(0.085, 0.095, 0.016, 24), m: M(0, 0.008, 0), c: 0xf3e8f0, t: 0.012 });
      solid.push({ geo: new THREE.CylinderGeometry(0.016, 0.022, 0.1, 10), m: M(0, 0.065, 0), c: 0xf3e8f0, t: 0.01 });
      solid.push({ geo: G.geo.sphereLo, m: M(0, 0.095, 0, 0, 0, 0, 0.03, 0.022, 0.03), c: 0xf3e8f0, t: 0.01 });
      solid.push({ geo: G.geo.sphereLo, m: M(0, baseY - 0.003, 0, 0, 0, 0, d.r0 + gd, 0.02, d.r0 + gd), c: 0xf3e8f0, t: 0.01 });
    } else if (d.vessel === 'stein') {
      baseY = 0.03;
      solid.push({ geo: new THREE.CylinderGeometry(d.r0 + gd + 0.004, d.r0 + gd + 0.008, 0.03, 24), m: M(0, 0.015, 0), c: 0xf6ead0, t: 0.012 });
      solid.push({ geo: new THREE.TorusGeometry(0.075, 0.02, 8, 16, Math.PI), m: M(d.r0 + 0.02, 0.17, 0, 0, 0, -Math.PI / 2, 1, 1.25, 1), c: 0xf6ead0, t: 0.012 });
      solid.push({ geo: new THREE.TorusGeometry(d.r1 + gd, 0.012, 6, 28), m: M(0, baseY + 0.07, 0, Math.PI / 2, 0, 0), c: 0xd8b25a, t: 0.008 });
      solid.push({ geo: new THREE.TorusGeometry(d.r1 + gd, 0.012, 6, 28), m: M(0, baseY + 0.2, 0, Math.PI / 2, 0, 0), c: 0xd8b25a, t: 0.008 });
    } else {
      baseY = 0.012;
      solid.push({ geo: new THREE.CylinderGeometry(d.r0 + gd, d.r0 + gd + 0.004, 0.014, 24), m: M(0, 0.007, 0), c: 0xe6fffa, t: 0.012 });
      solid.push({ geo: new THREE.TorusGeometry(d.r1 + gd + 0.004, 0.016, 8, 20), m: M(0, baseY + d.H - 0.035, 0, Math.PI / 2, 0, 0), c: 0xc79bff, t: 0.01 });
    }
    // rim
    solid.push({ geo: new THREE.TorusGeometry(d.r1 + gd * 0.5, 0.009, 6, 32), m: M(0, baseY + d.H, 0, Math.PI / 2, 0, 0), c: 0xffffff, t: 0.01 });
    var solidMesh = G.outlined(G.merge(solid), G.toonVC);
    cup.add(solidMesh);
    // glass wall
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(d.r1 + gd, d.r0 + gd, d.H, 32, 1, true), glass);
    wall.position.y = baseY + d.H / 2;
    wall.renderOrder = 2;
    cup.add(wall);
    // liquid
    var L = liquidGeo(d);
    var sideMat = G.toon(d.color, { emissive: new THREE.Color(d.color).multiplyScalar(d.glow * 0.6) });
    var topMat = G.toon(d.surf, { emissive: new THREE.Color(d.surf).multiplyScalar(d.glow * 0.7 + 0.08) });
    var liquid = new THREE.Mesh(L.geo, [sideMat, topMat, sideMat]);
    liquid.position.y = baseY;
    cup.add(liquid);
    var c = {
      def: d, group: cup, liquid: liquid, L: L, baseY: baseY, glass: glass, wall: wall,
      st: TT.newDrinkState(d), foam: [], bubbles: null, pop: 0, shakeT: 0, spillFlash: 0
    };
    if (d.id === 'ale') {
      for (var f = 0; f < 5; f++) {
        var fm = new THREE.Mesh(G.geo.sphereLo, G.toon(0xfff6e0, { emissive: 0x332a18 }));
        var ang = f * 2.4, rr = 0.03 + (f % 3) * 0.028;
        fm.userData.ox = Math.cos(ang) * rr; fm.userData.oz = Math.sin(ang) * rr;
        fm.scale.setScalar(0.022 + (f % 2) * 0.012);
        liquid.add(fm);
        c.foam.push(fm);
      }
    }
    if (d.id === 'fizz' || d.id === 'wine') {
      var n = d.id === 'fizz' ? 14 : 6;
      var bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      var bm = new THREE.PointsMaterial({ color: d.id === 'fizz' ? 0xeafffb : 0xffd0ec, size: d.id === 'fizz' ? 0.028 : 0.022, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      var pts = new THREE.Points(bg, bm);
      pts.frustumCulled = false;
      liquid.add(pts);
      c.bubbles = { pts: pts, n: n, y: [], a: [], r: [], sp: [] };
      for (var b = 0; b < n; b++) {
        c.bubbles.y.push(Math.random() * d.H * 0.8); c.bubbles.a.push(Math.random() * 6.28);
        c.bubbles.r.push(Math.random()); c.bubbles.sp.push(0.05 + Math.random() * 0.08);
      }
    }
    return c;
  };

  D.resetCup = function (c) {
    c.st = TT.newDrinkState(c.def);
    c.liquid.visible = true;
    c.pop = 0; c.shakeT = 0; c.spillFlash = 0;
  };

  // update liquid surface given a local slope (slx, slz)
  D.updateLiquid = function (c, slx, slz, dt, time) {
    var d = c.def, st = c.st, Lg = c.L;
    var pos = Lg.geo.attributes.position, nor = Lg.geo.attributes.normal;
    var k = (d.r1 - d.r0) / d.H;
    var Lv = st.L;
    if (Lv < 0.002) { c.liquid.visible = false; return; }
    c.liquid.visible = true;
    var i, t;
    for (i = 0; i < Lg.top.length; i++) {
      t = Lg.top[i];
      var sd = slx * t.cx + slz * t.cz;
      var den = 1 - sd * k;
      if (den < 0.2) den = 0.2;
      var y = (Lv + sd * d.r0) / den;
      if (!(y > 0.002)) y = 0.002;
      if (y > d.H) y = d.H;
      var r = d.r0 + k * y - 0.004;
      pos.setXYZ(t.i, t.cx * r, y, t.cz * r);
    }
    var cy = TT.clamp(Lv, 0.002, d.H);
    for (i = 0; i < Lg.centers.length; i++) pos.setXYZ(Lg.centers[i], 0, cy, 0);
    var nl = Math.sqrt(slx * slx + 1 + slz * slz);
    for (i = 0; i < Lg.caps.length; i++) nor.setXYZ(Lg.caps[i], -slx / nl, 1 / nl, -slz / nl);
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    Lg.geo.computeBoundingSphere();
    // foam blobs ride the surface
    for (i = 0; i < c.foam.length; i++) {
      var f = c.foam[i], ox = f.userData.ox, oz = f.userData.oz;
      var fy = Lv + slx * ox + slz * oz;
      f.position.set(ox + Math.sin(time * 2 + i) * 0.004, Math.min(d.H, fy) + 0.004, oz);
    }
    if (c.bubbles) {
      var B = c.bubbles, arr = B.pts.geometry.attributes.position.array;
      for (i = 0; i < B.n; i++) {
        B.y[i] += B.sp[i] * dt;
        var surf = Lv + (slx * Math.cos(B.a[i]) + slz * Math.sin(B.a[i])) * 0.02;
        if (B.y[i] > surf - 0.005) { B.y[i] = 0.005; B.a[i] = Math.random() * 6.28; B.r[i] = Math.random(); }
        var rad = (d.r0 + k * B.y[i]) * 0.75 * Math.sqrt(B.r[i]);
        arr[i * 3] = Math.cos(B.a[i] + B.y[i] * 8) * rad;
        arr[i * 3 + 1] = B.y[i];
        arr[i * 3 + 2] = Math.sin(B.a[i] + B.y[i] * 8) * rad;
      }
      B.pts.geometry.attributes.position.needsUpdate = true;
    }
  };

  // world-space point on the rim, on the side the liquid is climbing
  var _v = new THREE.Vector3();
  D.rimPoint = function (c, ux, uz, out) {
    var d = c.def;
    _v.set(ux * (d.r1 + 0.01), c.baseY + d.H + 0.01, uz * (d.r1 + 0.01));
    return c.group.localToWorld(out.copy(_v));
  };
})();
