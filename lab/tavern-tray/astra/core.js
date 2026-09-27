/* Deterministic game rules, independent of rendering and audio. */
(function (root) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function random(seed) {
    let x = seed >>> 0;
    return function () { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const NAMES = { dwarf: 'DANCING DWARF', wizard: 'WANDERING WIZARD', orc: 'ORCISH ELBOWS', barrel: 'RUNAWAY BARREL' };
  class Shift {
    constructor(seed) { this.reset(seed || 1); }
    reset(seed) {
      this.seed = seed >>> 0; this.rng = random(this.seed);
      this.length = 148; this.limit = 45; this.time = 0; this.distance = 0; this.speed = 2.3;
      this.fill = [1, 1, 1]; this.tiltX = 0; this.tiltZ = 0; this.velX = 0; this.velZ = 0;
      this.holdTime = 0; this.held = false; this.clean = 0; this.combo = 0; this.bestCombo = 0;
      this.result = null; this.reason = null; this.points = 0; this.spilled = 0; this.spillAccumulator = 0; this.state = 'ready'; this.events = [];
      const kinds = ['dwarf', 'wizard', 'orc'];
      this.hazards = [16, 32, 49, 66, 83, 100, 117, 134].map((s, i) => {
        const kind = i === 5 ? 'barrel' : kinds[(i + Math.floor(this.rng() * 3)) % 3];
        const side = this.rng() < .5 ? -1 : 1;
        return { id: i, s: s + (this.rng() - .5) * 1.4, side, kind, name: NAMES[kind], walkSpeed: 2.28 + this.rng() * .3,
          triggerDistance: 11.6 + this.rng() * .6, x: side * 5.7, time: 0, triggered: false, passed: false,
          hit: false, guarded: false, warned: false, nearHeld: false, variation: this.rng() };
      });
    }
    start() { this.state = 'playing'; this.events.length = 0; }
    emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }
    lose(amount, side) {
      const before = this.fill.reduce((a,b) => a+b, 0);
      this.fill = this.fill.map((f, i) => clamp(f - amount * (1 + (i - 1) * side * .15 + this.rng() * .1), 0, 1));
      const lost = before - this.fill.reduce((a,b) => a+b, 0);
      this.spilled += lost; return lost;
    }
    update(dt, held) {
      this.events.length = 0;
      if (this.state !== 'playing') return this.events;
      dt = clamp(dt, 0, .05); this.time += dt; this.held = !!held;
      this.holdTime = held ? this.holdTime + dt : 0;
      const oldSpeed = this.speed;
      this.speed += ((held ? 2.3 : 4.8) - this.speed) * (1 - Math.exp(-dt * 11));
      this.distance += this.speed * dt;
      const acceleration = dt ? (this.speed - oldSpeed) / dt : 0;
      const driveX = held ? Math.sin(this.distance * 2) * .16 : Math.sin(this.distance * 2.3) * 2.1 + Math.sin(this.distance * .9) * .6;
      const driveZ = (held ? .12 : .65) * Math.sin(this.distance * 3.8) + acceleration * .17;
      this.velX += (-18 * this.tiltX - (held ? 10 : 3.6) * this.velX + driveX) * dt;
      this.velZ += (-21 * this.tiltZ - (held ? 11 : 4.0) * this.velZ + driveZ) * dt;
      this.tiltX = clamp(this.tiltX + this.velX * dt, -1.5, 1.5);
      this.tiltZ = clamp(this.tiltZ + this.velZ * dt, -1.5, 1.5);
      const overflow = Math.max(0, Math.hypot(this.tiltX, this.tiltZ) - .46);
      if (overflow > 0) {
        const lost = this.lose(overflow * (held ? .019 : .078) * dt, Math.sign(this.tiltX));
        this.spillAccumulator += lost;
        if (this.spillAccumulator > .028) { this.emit('drip', { amount: this.spillAccumulator }); this.spillAccumulator = 0; }
      }
      for (const h of this.hazards) {
        const ahead = h.s - this.distance;
        if (!h.triggered && ahead < h.triggerDistance) { h.triggered = true; this.emit('approach', { hazard: h }); }
        if (h.triggered) { h.time += dt; h.x = h.side * Math.max(-6.1, 5.7 - h.time * h.walkSpeed); }
        if (ahead < 5 && ahead > -1 && held) h.nearHeld = true;
        if (!h.hit && !h.guarded && Math.abs(ahead) < 1.22 && Math.abs(h.x) < (h.kind === 'orc' ? 1.85 : 1.6)) {
          if (held && this.holdTime > .105) {
            h.guarded = true; this.velX += h.side * .85; this.velZ -= .45;
            this.points += 45; this.emit('guard', { hazard: h });
          } else {
            h.hit = true; this.combo = 0;
            const lost = this.lose(h.kind === 'barrel' ? .15 : .115, h.side);
            this.velX += h.side * 5.65; this.velZ += (this.rng() - .5) * 4.8;
            this.emit('bump', { hazard: h, lost });
          }
        }
        if (!h.passed && ahead < -2) {
          h.passed = true;
          if (!h.hit) {
            this.clean++; this.combo++; this.bestCombo = Math.max(this.combo, this.bestCombo);
            this.points += 75 + this.combo * 15;
            this.emit('clean', { hazard: h, combo: this.combo, close: h.guarded });
          }
        }
      }
      if (this.distance >= this.length) this.finish('served');
      else if (this.time >= this.limit) this.finish('late');
      else if (this.time >= 30 && this.fill.every(f => f < .025)) this.finish('empty');
      return this.events;
    }
    nearest() { return this.hazards.find(h => !h.passed && h.s - this.distance < 13) || null; }
    finish(reason) {
      if (this.state !== 'playing') return;
      this.state = 'finished'; this.reason = reason;
      const average = this.fill.reduce((a,b) => a+b, 0) / 3;
      const served = reason === 'served' ? this.fill.filter(f => f > .08).length : 0;
      const timeLeft = Math.max(0, this.limit - this.time);
      const score = served ? Math.round((average * 1800 + this.points + timeLeft * 35) / 5) * 5 : 0;
      let stars = 0, title = 'A round for<br>the floor.', description = 'The floorboards send their compliments.';
      if (reason === 'late') { title = 'The bell<br>beat you.'; description = 'A little less steady. A little more speedy.'; }
      else if (average >= .9 && served === 3) { stars = 3; title = 'A liquid<br>legend.'; description = 'Three drinks. Still on speaking terms.'; }
      else if (average >= .62 && served === 3) { stars = 2; title = 'A proper<br>publican.'; description = 'A little on the floor. A lot to be proud of.'; }
      else if (served) { stars = 1; title = 'Mostly in<br>the glasses.'; description = 'They ordered drinks, not a full glass. Right?'; }
      this.result = { reason, average, served, timeLeft, score, stars, title, description, clean: this.clean, bestCombo: this.bestCombo };
      this.emit('finish', { result: this.result });
    }
  }
  const api = { Shift, random, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PintsCore = api;
})(typeof window !== 'undefined' ? window : null);
