/* Tipsy Tray — audio: WebAudio synth + embedded samples (works from file://), music via <audio> */
(function () {
  'use strict';
  var TT = window.TT;
  var A = (TT.audio = {
    ctx: null, master: null, sfx: null, buffers: {}, muted: false, ready: false,
    music: null, musicVol: 0, musicTarget: 0, noiseBuf: null, lastVoice: 0, voiceSrc: null
  });

  // create the context early (suspended) so samples are decoded before the first key press
  A.preload = function () {
    if (A.ctx) return;
    A.create();
  };
  A.init = function () {
    if (!A.ctx) A.create();
    if (A.ctx && A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) { /* ignore */ } }
    A.startMusic();
  };
  A.create = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        A.ctx = new AC();
        var comp = A.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        comp.connect(A.ctx.destination);
        A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.9; A.master.connect(comp);
        A.sfx = A.ctx.createGain(); A.sfx.gain.value = 0.85; A.sfx.connect(A.master);
        var len = A.ctx.sampleRate * 2, buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        A.noiseBuf = buf;
        A.decodeAll();
      } catch (e) { A.ctx = null; }
    }
  };

  A.decodeAll = function () {
    var data = TT.AUDIO_DATA || {};
    Object.keys(data).forEach(function (name) {
      try {
        var bin = atob(data[name]), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var done = function (b) {
          A.buffers[name] = b;
          var pv = A.pendingVoice;
          if (pv && pv.name === name && performance.now() - pv.at < 2500) { A.pendingVoice = null; A.voice(pv.name, pv.vol, pv.rate, true); }
        };
        var p = A.ctx.decodeAudioData(bytes.buffer, done, function () { });
        if (p && p.catch) p.catch(function () { });
      } catch (e) { /* ignore */ }
    });
    A.ready = true;
  };

  A.startMusic = function () {
    if (!A.music) {
      try {
        A.music = new Audio('assets/music_jig.mp3');
        A.music.loop = true;
        A.music.volume = 0;
        A.music.preload = 'auto';
      } catch (e) { A.music = null; }
    }
    if (A.music && A.music.paused) {
      var p = A.music.play();
      if (p && p.catch) p.catch(function () { });
    }
  };

  A.setMusic = function (level, rate) {
    A.musicTarget = level;
    if (A.music && rate) A.music.playbackRate = rate;
  };

  A.update = function (dt) {
    if (!A.music) return;
    A.musicVol = TT.damp(A.musicVol, A.muted ? 0 : A.musicTarget, 3, dt);
    A.music.volume = TT.clamp(A.musicVol, 0, 1);
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.9, A.ctx.currentTime, 0.05);
    TT.storage.set('tt_muted', A.muted);
    return A.muted;
  };

  // ---- sample playback -------------------------------------------------------
  A.play = function (name, vol, rate, delay) {
    if (!A.ctx || !A.buffers[name]) return null;
    var src = A.ctx.createBufferSource();
    src.buffer = A.buffers[name];
    src.playbackRate.value = rate || 1;
    var g = A.ctx.createGain();
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(A.sfx);
    src.start(A.ctx.currentTime + (delay || 0));
    return src;
  };
  A.voice = function (name, vol, rate, force) {
    if (!A.ctx) return;
    if (!A.buffers[name]) { A.pendingVoice = { name: name, vol: vol, rate: rate, at: performance.now() }; return; }
    var now = A.ctx.currentTime;
    if (!force && now - A.lastVoice < 2.2) return;
    A.lastVoice = now;
    if (A.voiceSrc) { try { A.voiceSrc.stop(); } catch (e) { /* ignore */ } }
    A.voiceSrc = A.play(name, vol == null ? 1 : vol, rate || 1);
  };

  // ---- synth helpers ---------------------------------------------------------
  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function osc(type, f, t, dur, vol, dest, fEnd) {
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    env(g, t, 0.004, vol, dur);
    o.connect(g); g.connect(dest || A.sfx);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, vol, type, f, q, dest, fEnd) {
    var s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf;
    s.playbackRate.value = 1;
    var fl = A.ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1000, t); fl.Q.value = q || 1;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    var g = A.ctx.createGain();
    env(g, t, 0.005, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || A.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return { src: s, filter: fl, gain: g };
  }
  function ok(v) { return A.ctx && !A.muted && v > 0.01; }

  A.clink = function (vol, pitch) {
    vol = vol == null ? 0.3 : vol; if (!ok(vol)) return;
    var t = A.ctx.currentTime, f = (pitch || 1) * (2100 + Math.random() * 500);
    osc('sine', f, t, 0.35, vol * 0.5);
    osc('sine', f * 2.76, t, 0.2, vol * 0.25);
    osc('sine', f * 5.4, t, 0.1, vol * 0.12);
  };
  A.rattle = function (vol) {
    if (!ok(vol)) return;
    for (var i = 0; i < 3; i++) (function (k) { setTimeout(function () { A.clink(vol * (0.7 - k * 0.15), 0.9 + Math.random() * 0.3); }, k * 38); })(i);
  };
  A.step = function (vol, pitch) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime, p = pitch || 1;
    noise(t, 0.05, vol * 0.5, 'bandpass', 650 * p, 1.4);
    osc('sine', 120 * p, t, 0.06, vol * 0.4, null, 70 * p);
  };
  A.whoosh = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    var n = noise(t, 0.38, vol, 'bandpass', 380, 1.6, null, 2400);
    n.filter.frequency.exponentialRampToValueAtTime(700, t + 0.38);
  };
  A.slam = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 95, t, 0.45, vol * 0.9, null, 38);
    osc('triangle', 60, t, 0.3, vol * 0.5, null, 30);
    noise(t, 0.22, vol * 0.7, 'lowpass', 500, 0.7);
    setTimeout(function () { A.rattle(vol * 0.5); }, 70);
  };
  A.thump = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 110, t, 0.2, vol * 0.7, null, 55);
    noise(t, 0.12, vol * 0.4, 'lowpass', 800, 0.7);
  };
  A.rumble = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    var n = noise(t, 1.5, vol * 0.5, 'lowpass', 260, 0.8);
    var lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
    lfo.frequency.value = 9; lg.gain.value = vol * 0.25;
    lfo.connect(lg); lg.connect(n.gain.gain);
    lfo.start(t); lfo.stop(t + 1.6);
    osc('sine', 150, t, 0.12, vol * 0.4, null, 90);
  };
  A.squeak = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 2900, t, 0.07, vol * 0.3, null, 3900);
    osc('sine', 3100, t + 0.1, 0.08, vol * 0.28, null, 4200);
  };
  A.hiss = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    noise(t, 0.3, vol * 0.45, 'highpass', 3200, 0.7);
    osc('sawtooth', 700, t, 0.18, vol * 0.08, null, 450);
  };
  A.snore = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    // inhale: rising airy rasp
    var n = noise(t, 1.1, vol * 0.35, 'bandpass', 420, 2.5, null, 900);
    n.gain.gain.cancelScheduledValues(t);
    n.gain.gain.setValueAtTime(0.0001, t);
    n.gain.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.95);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    // exhale snort: fluttering low buzz
    var t2 = t + 1.2;
    var o = A.ctx.createOscillator(), lp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(78, t2); o.frequency.exponentialRampToValueAtTime(52, t2 + 0.6);
    lp.type = 'lowpass'; lp.frequency.value = 420;
    env(g, t2, 0.03, vol * 0.5, 0.6);
    var am = A.ctx.createOscillator(), amg = A.ctx.createGain();
    am.frequency.value = 24; amg.gain.value = vol * 0.3;
    am.connect(amg); amg.connect(g.gain);
    o.connect(lp); lp.connect(g); g.connect(A.sfx);
    o.start(t2); o.stop(t2 + 0.7); am.start(t2); am.stop(t2 + 0.7);
    noise(t2, 0.45, vol * 0.3, 'bandpass', 300, 1.2);
  };
  A.trombone = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    var notes = [196, 185, 174.6, 164.8], durs = [0.32, 0.32, 0.32, 1.1];
    var at = t;
    for (var i = 0; i < 4; i++) {
      var o = A.ctx.createOscillator(), lp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(notes[i], at);
      if (i === 3) {
        var vib = A.ctx.createOscillator(), vg = A.ctx.createGain();
        vib.frequency.value = 6; vg.gain.value = 5; vib.connect(vg); vg.connect(o.frequency);
        vib.start(at); vib.stop(at + durs[i] + 0.1);
        o.frequency.linearRampToValueAtTime(notes[i] * 0.94, at + durs[i]);
      }
      lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(300, at); lp.frequency.linearRampToValueAtTime(1300, at + 0.1); lp.frequency.linearRampToValueAtTime(500, at + durs[i]);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol * 0.32, at + 0.04);
      g.gain.setValueAtTime(vol * 0.32, at + durs[i] - 0.06); g.gain.linearRampToValueAtTime(0.0001, at + durs[i]);
      o.connect(lp); lp.connect(g); g.connect(A.sfx);
      o.start(at); o.stop(at + durs[i] + 0.05);
      at += durs[i] + 0.04;
    }
  };
  A.fanfare = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    var seq = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < seq.length; i++) brass(seq[i], t + i * 0.11, 0.16, vol * 0.22);
    [523.25, 659.25, 783.99].forEach(function (f) { brass(f, t + 0.46, 0.75, vol * 0.16); });
    brass(1046.5, t + 0.46, 0.75, vol * 0.12);
  };
  function brass(f, t, dur, vol) {
    var o = A.ctx.createOscillator(), o2 = A.ctx.createOscillator(), lp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = f; o2.frequency.value = f * 1.003;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(3200, t + 0.05); lp.frequency.linearRampToValueAtTime(1800, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(A.sfx);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  A.coin = function (vol, i) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime, scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    var f = 1320 * Math.pow(2, scale[Math.min(scale.length - 1, i || 0)] / 12);
    osc('sine', f, t, 0.12, vol * 0.3);
    osc('triangle', f * 2, t, 0.08, vol * 0.12);
  };
  A.bell = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 1480, t, 1.1, vol * 0.4);
    osc('sine', 1480 * 2.41, t, 0.6, vol * 0.15);
    osc('sine', 1480 * 3.9, t, 0.3, vol * 0.08);
  };
  A.pop = function (vol, p) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 420 * (p || 1), t, 0.09, vol * 0.4, null, 900 * (p || 1));
  };
  A.stamp = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 140, t, 0.18, vol * 0.8, null, 60);
    noise(t, 0.08, vol * 0.5, 'bandpass', 1600, 0.8);
  };
  A.tick = function (vol, hi) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    noise(t, 0.035, vol * 0.5, 'bandpass', hi ? 3200 : 2200, 6);
  };
  A.crackle = function (vol) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    noise(t, 0.02 + Math.random() * 0.03, vol * (0.3 + Math.random() * 0.4), 'highpass', 1800 + Math.random() * 2000, 0.8);
  };
  A.glug = function (vol, p) {
    if (!ok(vol)) return;
    var t = A.ctx.currentTime;
    osc('sine', 340 * (p || 1), t, 0.1, vol * 0.3, null, 180 * (p || 1));
  };
})();
