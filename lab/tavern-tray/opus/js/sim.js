/* Tipsy Tray — pure gameplay physics (no rendering). Shared by the game and the node tuning tests. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var TT = root.TT;

  // ---- movement + slosh tuning ------------------------------------------------
  TT.PHYS = {
    VMAX: 4.3,          // m/s, a scurrying goblin
    ACCEL: 3.4,         // m/s^2 at full throttle from standstill
    THROTTLE_RAMP: 0.6, // seconds to reach full throttle (quick taps = tiny nudges)
    BRAKE_K: 1.15,      // velocity-proportional braking (1/s)
    BRAKE_C: 0.5,       // constant braking (m/s^2)
    BRAKE_RAMP: 0.45,   // seconds for the brake to bite fully
    G: 20,              // "virtual gravity": higher = liquid less sensitive
    SPILL_RATE: 2.0,    // how fast liquid pours over the rim (1/s per metre of overflow)
    SPILL_DAMP: 26,     // slosh energy lost while pouring
    WADDLE: 0.55,       // sideways sway from the goblin's little steps
    SUBSTEP: 1 / 240,
    STUN: 0.75,
    INVULN: 1.35,
    BUMP_DV: 2.5,       // tray velocity jolt (m/s) from a collision
    FOAM_GAIN: 0.0075,  // fizz foam growth per unit of slosh speed
    FOAM_DECAY: 0.85,   // foam settling rate (1/s)
    SLAM_DV: 1.3        // tray jolt from the ogre's table slam at point blank
  };

  // r0 = bottom radius, r1 = top radius, H = vessel depth, fill = starting fraction of H
  TT.DRINK_DEFS = [
    {
      id: 'wine', name: 'Moonberry Wine', short: 'Wine', vessel: 'goblet',
      color: 0xd8317e, surf: 0xff86c3, glow: 0.55,
      r0: 0.05, r1: 0.165, H: 0.15, fill: 0.8,
      omega: 5.4, zeta: 0.09, smax: 0.75, pour: 0.7,
      pos: [0.0, 0.0, -0.2], css: '#e0408a'
    },
    {
      id: 'ale', name: 'Frothy Ale', short: 'Ale', vessel: 'stein',
      color: 0xf0a12c, surf: 0xfff0cf, glow: 0.12,
      r0: 0.112, r1: 0.122, H: 0.29, fill: 0.91,
      omega: 7.0, zeta: 0.095, smax: 0.9, pour: 4.5,
      pos: [0.23, 0.0, 0.15], css: '#f2a531'
    },
    {
      id: 'fizz', name: 'Pixie Fizz', short: 'Fizz', vessel: 'flask',
      color: 0x2fd9c4, surf: 0xc4fff4, glow: 0.6,
      r0: 0.14, r1: 0.062, H: 0.29, fill: 0.91,
      omega: 8.6, zeta: 0.12, smax: 1.2, pour: 11.0, fizzy: true,
      pos: [-0.23, 0.0, 0.15], css: '#34dcc8'
    }
  ];

  TT.frustumVolume = function (d, L) {
    if (L <= 0) return 0;
    var k = (d.r1 - d.r0) / d.H;
    if (Math.abs(k) < 1e-6) return Math.PI * d.r0 * d.r0 * L;
    var a = d.r0, b = d.r0 + k * L;
    return Math.PI * (b * b * b - a * a * a) / (3 * k);
  };

  TT.newDrinkState = function (d) {
    var L = d.H * d.fill;
    return {
      L: L, L0: L, V0: TT.frustumVolume(d, L),
      sx: 0, sz: 0, vx: 0, vz: 0,
      near: 0, spillRate: 0, dropAcc: 0, frac: 1, lastSpill: 0, foam: 0
    };
  };

  TT.drinkFrac = function (d, st) { return TT.frustumVolume(d, st.L) / st.V0; };

  // height where the tilted surface meets the (conical) wall, on the high side
  TT.rimHeight = function (d, st) {
    var s = Math.sqrt(st.sx * st.sx + st.sz * st.sz);
    var k = (d.r1 - d.r0) / d.H;
    var den = 1 - s * k;
    if (den < 0.2) den = 0.2;
    return (st.L + (st.foam || 0) + s * d.r0) / den;
  };

  // advance one liquid by dt given world horizontal acceleration (ax, az). returns spilled volume fraction
  TT.stepDrink = function (d, st, ax, az, dt) {
    var P = TT.PHYS, w = d.omega, z = d.zeta;
    var ex = -ax / P.G, ez = -az / P.G;
    st.vx += (-w * w * (st.sx - ex) - 2 * z * w * st.vx) * dt;
    st.vz += (-w * w * (st.sz - ez) - 2 * z * w * st.vz) * dt;
    st.sx += st.vx * dt;
    st.sz += st.vz * dt;
    if (d.fizzy) {
      // shaking a fizzy potion whips up foam that rises toward the rim
      var agit = Math.sqrt(st.vx * st.vx + st.vz * st.vz);
      st.foam += (agit * P.FOAM_GAIN - st.foam * P.FOAM_DECAY) * dt;
      if (st.foam < 0) st.foam = 0;
      if (st.foam > 0.06) st.foam = 0.06;
    }
    var s = Math.sqrt(st.sx * st.sx + st.sz * st.sz);
    if (s > d.smax) {
      var f = d.smax / s;
      st.sx *= f; st.sz *= f; st.vx *= 0.6; st.vz *= 0.6;
    }
    var h = TT.rimHeight(d, st);
    var spilled = 0;
    if (h > d.H && st.L > 0.0005) {
      var e = h - d.H;
      var vb = TT.frustumVolume(d, st.L);
      var dL = Math.min(st.L, e * P.SPILL_RATE * (d.pour || 1) * dt);
      st.L -= dL;
      if (st.L < 0) st.L = 0;
      spilled = (vb - TT.frustumVolume(d, st.L)) / st.V0;
      var damp = Math.max(0, 1 - P.SPILL_DAMP * e * dt);
      st.vx *= damp; st.vz *= damp;
      if (st.foam > 0) st.foam = Math.max(0, st.foam - dL * 0.6);
    }
    st.near = TT.clamp(1 - (d.H - h) / 0.022, 0, 1);
    return spilled;
  };

  // a sudden jolt of the tray (dvx, dvz in m/s): stiffer (faster) liquids get kicked harder
  TT.kickDrink = function (d, st, dvx, dvz) {
    var k = d.omega * d.omega / TT.PHYS.G;
    st.vx -= k * dvx;
    st.vz -= k * dvz;
  };

  // ---- player kinematics along the rail ----------------------------------------
  TT.newPlayerState = function () {
    return { s: 0, v: 0, a: 0, throttle: 0, brake: 0, stun: 0, invuln: 0 };
  };

  TT.stepPlayer = function (p, hold, dt) {
    var P = TT.PHYS;
    if (p.stun > 0) { p.stun -= dt; hold = false; }
    if (p.invuln > 0) p.invuln -= dt;
    var a;
    if (hold) {
      p.throttle = Math.min(1, p.throttle + dt / P.THROTTLE_RAMP);
      p.brake = 0;
      a = P.ACCEL * p.throttle * (1 - Math.max(0, p.v) / P.VMAX);
      if (p.v < 0) a += P.BRAKE_K * -p.v + P.BRAKE_C;
    } else {
      p.throttle = 0;
      p.brake = Math.min(1, p.brake + dt / P.BRAKE_RAMP);
      var mag = (P.BRAKE_K * Math.abs(p.v) + P.BRAKE_C) * p.brake;
      a = p.v > 0 ? -mag : p.v < 0 ? mag : 0;
      if (Math.abs(a * dt) > Math.abs(p.v)) a = -p.v / dt;
    }
    p.v += a * dt;
    if (!hold && Math.abs(p.v) < 1e-4) p.v = 0;
    p.s += p.v * dt;
    p.a = a;
  };
})();
