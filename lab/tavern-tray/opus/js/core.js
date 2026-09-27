/* Tipsy Tray — core helpers (global namespace TT) */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var TT = (root.TT = root.TT || {});

  TT.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  TT.lerp = function (a, b, t) { return a + (b - a) * t; };
  TT.damp = function (a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); };
  TT.smoothstep = function (a, b, x) {
    var t = TT.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  TT.easeOutBack = function (t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  TT.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  TT.easeInOutSine = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };
  TT.easeInCubic = function (t) { return t * t * t; };
  TT.easeOutElastic = function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  };
  // smooth bump 0 -> 1 -> 0 on [0,1]
  TT.bump = function (t) {
    if (t <= 0 || t >= 1) return 0;
    return Math.sin(Math.PI * t) * Math.sin(Math.PI * t);
  };

  TT.mulberry32 = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  TT.randRange = function (a, b, r) { return a + (b - a) * (r || Math.random)(); };
  TT.pick = function (arr, r) { return arr[Math.floor((r || Math.random)() * arr.length)]; };
  TT.angleLerp = function (a, b, t) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  };
  TT.angleDamp = function (a, b, lambda, dt) {
    return TT.angleLerp(a, b, 1 - Math.exp(-lambda * dt));
  };

  TT.storage = {
    get: function (k, d) {
      try {
        var v = root.localStorage && root.localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { if (root.localStorage) root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };

  // simple 1D value noise for camera shake / wobbles
  TT.noise1 = function (x) {
    var i = Math.floor(x), f = x - i;
    var h = function (n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    var u = f * f * (3 - 2 * f);
    return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
  };
})();
