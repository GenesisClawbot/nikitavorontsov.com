/* Tipsy Tray — the serving route: straights + arcs, sampled into a fast lookup table */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var TT = root.TT;

  // heading h: tangent = (sin h, cos h) in XZ. kappa > 0 turns left (toward local +x), < 0 turns right.
  TT.TRACK = {
    start: { x: 0, z: 5.5, h: Math.PI },
    segs: [
      { len: 10 },                       // leaving the bar
      { r: 5, deg: -70 },                // tight right around the keg stack
      { len: 9 },                        // elf lane
      { r: 7.5, deg: 70 },               // sweeping left
      { len: 9 },                        // dance floor
      { r: 9, deg: 45 },
      { len: 7 },                        // barrel chute
      { r: 5, deg: -90 },                // hairpin right
      { len: 6 },                        // arm-wrestling ogre
      { r: 8.5, deg: 45 },
      { len: 14.2 }                      // cat, dragon, the high table
    ]
  };

  function Path(track) {
    var step = 0.05;
    var xs = [], zs = [], hs = [], ks = [];
    var x = track.start.x, z = track.start.z, h = track.start.h;
    xs.push(x); zs.push(z); hs.push(h); ks.push(0);
    var bounds = [];
    for (var i = 0; i < track.segs.length; i++) {
      var sg = track.segs[i];
      var len, k;
      if (sg.len) { len = sg.len; k = 0; } else { var ang = sg.deg * Math.PI / 180; len = Math.abs(ang) * sg.r; k = (ang > 0 ? 1 : -1) / sg.r; }
      var n = Math.max(1, Math.round(len / step));
      var ds = len / n;
      for (var j = 0; j < n; j++) {
        // midpoint integration
        var hm = h + k * ds * 0.5;
        x += Math.sin(hm) * ds; z += Math.cos(hm) * ds; h += k * ds;
        xs.push(x); zs.push(z); hs.push(h); ks.push(k);
      }
      bounds.push(xs.length - 1);
    }
    this.step = step;
    this.n = xs.length;
    this.length = (this.n - 1) * step; // approximate (segments rounded to step)
    // recompute exact length from samples
    var L = 0;
    this.sArr = new Float32Array(this.n);
    for (var q = 1; q < this.n; q++) { L += Math.hypot(xs[q] - xs[q - 1], zs[q] - zs[q - 1]); this.sArr[q] = L; }
    this.length = L;
    this.xs = new Float32Array(xs); this.zs = new Float32Array(zs); this.hs = new Float32Array(hs);
    // smooth curvature over ~0.8 m so centripetal forces ramp in rather than snap
    var raw = new Float32Array(ks), sm = new Float32Array(this.n), w = Math.round(0.4 / step);
    for (var a = 0; a < this.n; a++) {
      var sum = 0, cnt = 0;
      for (var b = a - w; b <= a + w; b++) if (b >= 0 && b < this.n) { sum += raw[b]; cnt++; }
      sm[a] = sum / cnt;
    }
    this.ks = sm;
  }

  Path.prototype.sample = function (s, out) {
    out = out || {};
    if (s < 0) s = 0;
    var L = this.length;
    var extra = 0;
    if (s > L) { extra = s - L; s = L; }
    var f = s / this.step;
    var i = Math.floor(f);
    if (i >= this.n - 1) i = this.n - 2;
    var t = f - i;
    if (t > 1) t = 1;
    var h = this.hs[i] + (this.hs[i + 1] - this.hs[i]) * t;
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t + Math.sin(h) * extra;
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t + Math.cos(h) * extra;
    out.h = h;
    out.k = this.ks[i] + (this.ks[i + 1] - this.ks[i]) * t;
    out.tx = Math.sin(h); out.tz = Math.cos(h);
    // screen-right when looking along the path
    out.rx = -out.tz; out.rz = out.tx;
    return out;
  };

  // closest distance from point to path (coarse)
  Path.prototype.distance = function (x, z) {
    var best = 1e9, bi = 0;
    for (var i = 0; i < this.n; i += 4) {
      var dx = this.xs[i] - x, dz = this.zs[i] - z, d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return { d: Math.sqrt(best), s: bi * this.step };
  };

  TT.Path = Path;
})();
