/* Tipsy Tray — materials, outlines, geometry merging and procedural canvas textures */
(function () {
  'use strict';
  var TT = window.TT;
  var G = (TT.gfx = {});

  // ---------------------------------------------------------------- toon shading
  G.gradient = (function () {
    var data = new Uint8Array([96, 150, 208, 255]);
    var t = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  })();

  var toonCache = {};
  G.toon = function (hex, opts) {
    var key = hex + '|' + (opts ? JSON.stringify(opts) : '');
    if (toonCache[key]) return toonCache[key];
    var p = { color: hex, gradientMap: G.gradient };
    if (opts) for (var k in opts) p[k] = opts[k];
    var m = new THREE.MeshToonMaterial(p);
    toonCache[key] = m;
    return m;
  };
  G.toonVC = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: G.gradient });
  G.toonVCGlow = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: G.gradient, emissive: 0x2a1405 });

  // ---------------------------------------------------------------- outlines (inverted hull)
  G.INK = 0x1c0f0a;
  G.outlineUniform = { value: 1.0 };
  G.makeOutlineMat = function (color) {
    var m = new THREE.MeshBasicMaterial({ color: color == null ? G.INK : color, side: THREE.BackSide });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uOutline = G.outlineUniform;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uOutline;\nattribute vec3 outlineNormal;')
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + outlineNormal * uOutline;');
    };
    m.customProgramCacheKey = function () { return 'tt-outline'; };
    return m;
  };
  G.outlineMat = G.makeOutlineMat();

  // smooth (position-welded) normals, used to extrude the outline hull without cracks
  function weldedNormals(g) {
    var pa = g.attributes.position.array, na = g.attributes.normal.array;
    var n = pa.length / 3, map = {}, keys = new Array(n), i, k, acc;
    for (i = 0; i < n; i++) {
      k = Math.round(pa[i * 3] * 2000) + ',' + Math.round(pa[i * 3 + 1] * 2000) + ',' + Math.round(pa[i * 3 + 2] * 2000);
      keys[i] = k;
      acc = map[k];
      if (!acc) { acc = map[k] = [0, 0, 0]; }
      acc[0] += na[i * 3]; acc[1] += na[i * 3 + 1]; acc[2] += na[i * 3 + 2];
    }
    var out = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      acc = map[keys[i]];
      var l = Math.sqrt(acc[0] * acc[0] + acc[1] * acc[1] + acc[2] * acc[2]) || 1;
      out[i * 3] = acc[0] / l; out[i * 3 + 1] = acc[1] / l; out[i * 3 + 2] = acc[2] / l;
    }
    return out;
  }
  G.weldedNormals = weldedNormals;

  // add an outlineNormal attribute (thickness baked in) to an existing geometry
  G.withOutline = function (geo, thickness) {
    var g = geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    var wn = weldedNormals(g);
    var t = thickness == null ? 0.02 : thickness;
    for (var i = 0; i < wn.length; i++) wn[i] *= t;
    g.setAttribute('outlineNormal', new THREE.BufferAttribute(wn, 3));
    return g;
  };

  // merge parts [{geo, m (Matrix4), c (hex), t (outline thickness, 0 = none)}] into one vertex-coloured geometry
  var _col = new THREE.Color();
  G.merge = function (parts) {
    var prepared = [], total = 0, i, j;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      var g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (p.m) g.applyMatrix4(p.m);
      var wn = weldedNormals(g);
      prepared.push({ g: g, wn: wn, c: p.c == null ? 0xffffff : p.c, t: p.t == null ? 0.02 : p.t });
      total += g.attributes.position.count;
    }
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    var col = new Float32Array(total * 3), onr = new Float32Array(total * 3);
    var o = 0;
    for (i = 0; i < prepared.length; i++) {
      var P = prepared[i];
      var pa = P.g.attributes.position.array, na = P.g.attributes.normal.array;
      pos.set(pa, o); nor.set(na, o);
      _col.set(P.c);
      for (j = 0; j < pa.length; j += 3) {
        col[o + j] = _col.r; col[o + j + 1] = _col.g; col[o + j + 2] = _col.b;
        onr[o + j] = P.wn[j] * P.t; onr[o + j + 1] = P.wn[j + 1] * P.t; onr[o + j + 2] = P.wn[j + 2] * P.t;
      }
      o += pa.length;
      P.g.dispose();
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setAttribute('outlineNormal', new THREE.BufferAttribute(onr, 3));
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  };

  // mesh + inverted hull child
  G.outlined = function (geo, mat, withOutline) {
    var m = new THREE.Mesh(geo, mat);
    if (withOutline !== false) {
      if (!geo.attributes.outlineNormal) G.withOutline(geo, 0.02);
      var o = new THREE.Mesh(geo, G.outlineMat);
      o.name = 'outline';
      m.add(o);
    }
    return m;
  };

  // matrix helpers
  var _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  G.M = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x || 0, y || 0, z || 0);
    _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    return new THREE.Matrix4().compose(_p, _q, _s);
  };

  // shared primitive geometries (unit sized)
  G.geo = {
    sphere: new THREE.SphereGeometry(1, 18, 12),
    sphereLo: new THREE.SphereGeometry(1, 12, 8),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 18, 1),
    cylLo: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
    cone: new THREE.ConeGeometry(1, 1, 16, 1),
    hemi: new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    torus: new THREE.TorusGeometry(1, 0.12, 8, 28)
  };
  G.capsule = function (r, len, seg) { return new THREE.CapsuleGeometry(r, len, 4, seg || 12); };

  // ---------------------------------------------------------------- canvas textures
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  G.canvas = canvas;
  function tex(c, repeat) {
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.needsUpdate = true;
    return t;
  }
  G.tex = tex;

  G.texPlanks = function () {
    var c = canvas(512, 512), x = c.getContext('2d'), r = TT.mulberry32(7);
    var rows = 8, h = 512 / rows;
    for (var i = 0; i < rows; i++) {
      var off = (i % 2) * 180 + Math.floor(r() * 90);
      for (var seg = -1; seg < 3; seg++) {
        var x0 = off + seg * 300, w = 300;
        var l = 34 + r() * 10, hue = 24 + r() * 8, sat = 38 + r() * 12;
        x.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + l + '%)';
        x.fillRect(x0, i * h, w, h);
        // grain
        for (var gI = 0; gI < 14; gI++) {
          x.strokeStyle = 'rgba(40,20,8,' + (0.08 + r() * 0.12) + ')';
          x.lineWidth = 1 + r() * 1.5;
          x.beginPath();
          var gy = i * h + 4 + r() * (h - 8);
          x.moveTo(x0, gy);
          for (var gx = 0; gx <= w; gx += 30) x.lineTo(x0 + gx, gy + Math.sin(gx * 0.03 + gI) * 2.5);
          x.stroke();
        }
        // knot
        if (r() < 0.5) {
          x.fillStyle = 'rgba(50,24,10,0.35)';
          x.beginPath(); x.ellipse(x0 + 40 + r() * 200, i * h + h / 2, 10 + r() * 8, 5 + r() * 3, 0, 0, Math.PI * 2); x.fill();
        }
        // butt joint + nails
        x.fillStyle = 'rgba(20,10,5,0.85)';
        x.fillRect(x0, i * h, 3, h);
        x.fillStyle = 'rgba(15,10,8,0.7)';
        x.fillRect(x0 + 10, i * h + 10, 4, 4); x.fillRect(x0 + 10, i * h + h - 14, 4, 4);
      }
      x.fillStyle = 'rgba(18,9,4,0.9)';
      x.fillRect(0, i * h, 512, 3);
      x.fillStyle = 'rgba(255,220,170,0.08)';
      x.fillRect(0, i * h + 3, 512, 2);
    }
    return tex(c, true);
  };

  G.texRug = function () {
    var c = canvas(256, 512), x = c.getContext('2d');
    x.fillStyle = '#7e1d24'; x.fillRect(0, 0, 256, 512);
    x.fillStyle = '#d9a441'; x.fillRect(0, 0, 22, 512); x.fillRect(234, 0, 22, 512);
    x.fillStyle = '#4a0f16'; x.fillRect(22, 0, 8, 512); x.fillRect(226, 0, 8, 512);
    x.fillStyle = '#f0c665';
    for (var y = 0; y < 512; y += 32) {
      x.beginPath(); x.arc(11, y + 16, 5, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(245, y + 16, 5, 0, Math.PI * 2); x.fill();
    }
    for (var k = 0; k < 2; k++) {
      var cy = 128 + k * 256;
      x.fillStyle = '#b8323a';
      x.beginPath(); x.moveTo(128, cy - 100); x.lineTo(210, cy); x.lineTo(128, cy + 100); x.lineTo(46, cy); x.closePath(); x.fill();
      x.fillStyle = '#e3b04e';
      x.beginPath(); x.moveTo(128, cy - 64); x.lineTo(180, cy); x.lineTo(128, cy + 64); x.lineTo(76, cy); x.closePath(); x.fill();
      x.fillStyle = '#6d1820';
      x.beginPath(); x.moveTo(128, cy - 34); x.lineTo(156, cy); x.lineTo(128, cy + 34); x.lineTo(100, cy); x.closePath(); x.fill();
      x.fillStyle = '#f7d98a';
      x.beginPath(); x.arc(128, cy, 8, 0, Math.PI * 2); x.fill();
    }
    // wear
    var r = TT.mulberry32(3);
    for (var i = 0; i < 400; i++) {
      x.fillStyle = 'rgba(0,0,0,' + r() * 0.08 + ')';
      x.fillRect(r() * 256, r() * 512, 2 + r() * 4, 2 + r() * 4);
    }
    return tex(c, true);
  };

  G.texDanceFloor = function () {
    var c = canvas(512, 512), x = c.getContext('2d');
    var g = x.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#3b6b8f'); g.addColorStop(0.7, '#274a6b'); g.addColorStop(1, '#1b3450');
    x.fillStyle = g; x.beginPath(); x.arc(256, 256, 254, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#e9c46a'; x.lineWidth = 10;
    x.beginPath(); x.arc(256, 256, 240, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 200, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#e9c46a';
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      x.save(); x.translate(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220); x.rotate(a);
      x.beginPath(); x.moveTo(0, -9); x.lineTo(9, 0); x.lineTo(0, 9); x.lineTo(-9, 0); x.closePath(); x.fill();
      x.restore();
    }
    // star in the middle
    x.fillStyle = 'rgba(233,196,106,0.85)';
    x.beginPath();
    for (var k = 0; k < 16; k++) {
      var rr = k % 2 ? 40 : 110, aa = k / 16 * Math.PI * 2;
      x.lineTo(256 + Math.cos(aa) * rr, 256 + Math.sin(aa) * rr);
    }
    x.closePath(); x.fill();
    return tex(c);
  };

  G.texPlaster = function () {
    var c = canvas(256, 256), x = c.getContext('2d'), r = TT.mulberry32(11);
    x.fillStyle = '#c9a57a'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 900; i++) {
      var l = r();
      x.fillStyle = l > 0.5 ? 'rgba(255,240,210,' + r() * 0.12 + ')' : 'rgba(90,55,30,' + r() * 0.1 + ')';
      var s = 2 + r() * 10;
      x.fillRect(r() * 256, r() * 256, s, s * (0.5 + r()));
    }
    return tex(c, true);
  };

  G.texStone = function () {
    var c = canvas(512, 512), x = c.getContext('2d'), r = TT.mulberry32(5);
    x.fillStyle = '#3b2f2c'; x.fillRect(0, 0, 512, 512);
    var rowH = 64;
    for (var yy = 0; yy < 512; yy += rowH) {
      var xx = -r() * 60;
      while (xx < 512) {
        var w = 70 + r() * 70;
        var l = 38 + r() * 16;
        x.fillStyle = 'hsl(' + (20 + r() * 15) + ',' + (10 + r() * 10) + '%,' + l + '%)';
        roundRect(x, xx + 4, yy + 4, w - 8, rowH - 8, 12);
        x.fill();
        x.fillStyle = 'rgba(255,235,210,0.08)';
        roundRect(x, xx + 8, yy + 7, w - 18, 10, 5); x.fill();
        xx += w;
      }
    }
    return tex(c, true);
  };
  function roundRect(x, a, b, w, h, rr) {
    x.beginPath();
    x.moveTo(a + rr, b); x.lineTo(a + w - rr, b); x.quadraticCurveTo(a + w, b, a + w, b + rr);
    x.lineTo(a + w, b + h - rr); x.quadraticCurveTo(a + w, b + h, a + w - rr, b + h);
    x.lineTo(a + rr, b + h); x.quadraticCurveTo(a, b + h, a, b + h - rr);
    x.lineTo(a, b + rr); x.quadraticCurveTo(a, b, a + rr, b); x.closePath();
  }
  G.roundRect = roundRect;

  G.texWindow = function () {
    var c = canvas(128, 256), x = c.getContext('2d'), r = TT.mulberry32(21);
    var g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1d2f6b'); g.addColorStop(0.6, '#3a5aa6'); g.addColorStop(1, '#7fa6d9');
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    x.fillStyle = '#fff';
    for (var i = 0; i < 26; i++) { var s = r() * 2.2 + 0.6; x.globalAlpha = 0.5 + r() * 0.5; x.fillRect(r() * 128, r() * 160, s, s); }
    x.globalAlpha = 1;
    x.fillStyle = '#f5f1d8';
    x.beginPath(); x.arc(86, 58, 18, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2a3f80';
    x.beginPath(); x.arc(78, 52, 16, 0, Math.PI * 2); x.fill();
    // hills
    x.fillStyle = '#1a2a4a';
    x.beginPath(); x.moveTo(0, 256); x.lineTo(0, 200); x.quadraticCurveTo(40, 170, 80, 205); x.quadraticCurveTo(110, 185, 128, 195); x.lineTo(128, 256); x.fill();
    // mullions
    x.fillStyle = '#2a170c';
    x.fillRect(0, 0, 128, 8); x.fillRect(0, 248, 128, 8); x.fillRect(0, 0, 8, 256); x.fillRect(120, 0, 8, 256);
    x.fillRect(60, 0, 8, 256); x.fillRect(0, 124, 128, 8);
    return tex(c);
  };

  G.texBanner = function (bg, fg, kind) {
    var c = canvas(128, 256), x = c.getContext('2d');
    x.fillStyle = bg;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(128, 0); x.lineTo(128, 220); x.lineTo(64, 256); x.lineTo(0, 220); x.closePath(); x.fill();
    x.strokeStyle = fg; x.lineWidth = 6;
    x.beginPath(); x.moveTo(8, 8); x.lineTo(120, 8); x.lineTo(120, 214); x.lineTo(64, 244); x.lineTo(8, 214); x.closePath(); x.stroke();
    x.fillStyle = fg;
    x.save(); x.translate(64, 115);
    if (kind === 'mug') {
      roundRect(x, -26, -30, 44, 58, 8); x.fill();
      x.lineWidth = 8; x.strokeStyle = fg; x.beginPath(); x.arc(22, 0, 14, -1.2, 1.2); x.stroke();
      x.fillStyle = bg; x.fillRect(-18, -20, 8, 40); x.fillRect(-2, -20, 8, 40);
      x.fillStyle = fg; x.beginPath(); x.arc(-16, -32, 12, 0, 7); x.arc(0, -36, 13, 0, 7); x.arc(14, -32, 11, 0, 7); x.fill();
    } else if (kind === 'moon') {
      x.beginPath(); x.arc(0, 0, 36, 0, Math.PI * 2); x.fill();
      x.fillStyle = bg; x.beginPath(); x.arc(14, -8, 32, 0, Math.PI * 2); x.fill();
      x.fillStyle = fg;
      star(x, 22, 30, 9, 4);
    } else if (kind === 'crown') {
      x.beginPath(); x.moveTo(-36, 24); x.lineTo(-36, -18); x.lineTo(-18, 4); x.lineTo(0, -30); x.lineTo(18, 4); x.lineTo(36, -18); x.lineTo(36, 24); x.closePath(); x.fill();
      x.fillStyle = bg; x.beginPath(); x.arc(0, 10, 6, 0, 7); x.fill();
    } else {
      // dragon-ish flame
      x.beginPath(); x.moveTo(0, -40); x.quadraticCurveTo(30, -5, 18, 30); x.quadraticCurveTo(0, 42, -18, 30); x.quadraticCurveTo(-30, -5, 0, -40); x.fill();
      x.fillStyle = bg; x.beginPath(); x.moveTo(0, -8); x.quadraticCurveTo(12, 10, 6, 26); x.quadraticCurveTo(0, 30, -6, 26); x.quadraticCurveTo(-12, 10, 0, -8); x.fill();
    }
    x.restore();
    return tex(c);
  };
  function star(x, cx, cy, R, r) {
    x.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r : R, a = i / 10 * Math.PI * 2 - Math.PI / 2;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath(); x.fill();
  }
  G.star = star;

  G.texBlob = function () {
    var c = canvas(128, 128), x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    var t = tex(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };

  G.texRing = function () {
    var c = canvas(256, 256), x = c.getContext('2d');
    x.strokeStyle = '#fff';
    x.lineWidth = 10;
    x.setLineDash([22, 14]);
    x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.stroke();
    var t = tex(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };

  G.texSign = function (lines) {
    var c = canvas(1024, 256), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6b3f1f'); g.addColorStop(1, '#4a2912');
    x.fillStyle = g; roundRect(x, 6, 6, 1012, 244, 40); x.fill();
    x.lineWidth = 10; x.strokeStyle = '#d9a441'; roundRect(x, 20, 20, 984, 216, 30); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#2a150a';
    x.font = 'bold 92px Georgia, "Times New Roman", serif';
    x.fillText(lines[0], 516, 108);
    x.fillStyle = '#f4d58d';
    x.fillText(lines[0], 512, 102);
    if (lines[1]) {
      x.font = 'italic 40px Georgia, serif';
      x.fillStyle = '#f0c27a';
      x.fillText(lines[1], 512, 190);
    }
    return tex(c);
  };

  G.texZ = function () {
    var c = canvas(64, 64), x = c.getContext('2d');
    x.font = 'bold 54px Georgia, serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = '#1c0f0a'; x.strokeText('Z', 32, 34);
    x.fillStyle = '#e8f6ff'; x.fillText('Z', 32, 34);
    return tex(c);
  };

  G.texSweat = function () {
    var c = canvas(64, 64), x = c.getContext('2d');
    x.fillStyle = '#9fe3ff'; x.strokeStyle = '#1c0f0a'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(32, 6); x.quadraticCurveTo(54, 36, 46, 48); x.arc(32, 44, 15, 0.3, Math.PI - 0.3); x.quadraticCurveTo(10, 36, 32, 6); x.closePath();
    x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(26, 42, 4, 0, 7); x.fill();
    return tex(c);
  };

  G.texStar = function () {
    var c = canvas(64, 64), x = c.getContext('2d');
    x.fillStyle = '#1c0f0a'; star(x, 32, 33, 30, 13);
    x.fillStyle = '#ffd84a'; star(x, 32, 33, 23, 10);
    return tex(c);
  };

  // ---------------------------------------------------------------- additive glow points (candles, fire, sparkles)
  G.makeGlowMaterial = function () {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uFar: { value: 70 } },
      vertexShader: [
        'attribute float size;',
        'attribute vec3 aColor;',
        'attribute float phase;',
        'uniform float uTime; uniform float uScale; uniform float uFar;',
        'varying vec3 vColor; varying float vFade;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float fl = 0.86 + 0.1*sin(uTime*9.0 + phase*17.0) + 0.06*sin(uTime*21.0 + phase*5.0);',
        '  gl_PointSize = max(1.0, size * fl * uScale / -mv.z);',
        '  vColor = aColor;',
        '  vFade = 1.0 - smoothstep(uFar*0.55, uFar, -mv.z);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vFade;',
        'void main(){',
        '  float r = length(gl_PointCoord - 0.5) * 2.0;',
        '  if (r > 1.0) discard;',
        '  float a = pow(1.0 - r, 2.4);',
        '  float core = pow(max(0.0, 1.0 - r * 2.6), 2.0);',
        '  gl_FragColor = vec4((vColor * a + vec3(1.0, 0.93, 0.78) * core) * vFade, 1.0);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  };

  // a Points cloud of glows. add(x,y,z,size,hex,phase) then build()
  G.GlowSet = function () {
    this.p = []; this.s = []; this.c = []; this.ph = [];
  };
  G.GlowSet.prototype.add = function (x, y, z, size, hex) {
    this.p.push(x, y, z); this.s.push(size);
    _col.set(hex); this.c.push(_col.r, _col.g, _col.b);
    this.ph.push(Math.random());
    return this.s.length - 1;
  };
  G.GlowSet.prototype.build = function (mat) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(this.s), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    g.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(this.ph), 1));
    var pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    this.points = pts;
    return pts;
  };
})();
