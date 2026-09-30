/* Tipsy Tray — DOM UI: title, HUD, hints, receipt */
(function () {
  'use strict';
  var TT = window.TT;
  var U = (TT.ui = {});
  var $ = function (id) { return document.getElementById(id); };

  U.RANKS = [
    { min: 0, name: 'Mop Duty', col: '#8a6a4a' },
    { min: 150, name: 'Dish Goblin', col: '#5f9a3f' },
    { min: 250, name: 'Tray Trotter', col: '#2b8fbf' },
    { min: 350, name: 'Slosh Master', col: '#8e44c9' },
    { min: 460, name: 'Legend of the Griffin', col: '#d4901c' }
  ];
  U.rankFor = function (score) {
    var r = U.RANKS[0];
    for (var i = 0; i < U.RANKS.length; i++) if (score >= U.RANKS[i].min) r = U.RANKS[i];
    return r;
  };
  U.nextRank = function (score) {
    for (var i = 0; i < U.RANKS.length; i++) if (score < U.RANKS[i].min) return U.RANKS[i];
    return null;
  };

  U.init = function () {
    U.hud = $('hud'); U.title = $('title'); U.result = $('result');
    U.hint = $('hint'); U.flash = $('flash');
    U.meters = {};
    var ms = document.querySelectorAll('.dm');
    for (var i = 0; i < ms.length; i++) {
      var el = ms[i];
      U.meters[el.getAttribute('data-id')] = { el: el, fill: el.querySelector('.fill'), pct: el.querySelector('.pct'), last: 100, flashT: 0 };
    }
    U.timerNum = $('timerNum'); U.timerRing = $('timerRing'); U.timerEl = $('timer');
    U.tipsNum = $('tipsNum'); U.tipsEl = $('tips');
    U.progMe = $('progMe'); U.progGhost = $('progGhost'); U.progFill = $('progFill');
    U.hintT = 0;
    var logo = $('logo');
    if (logo && !logo.dataset.split) {
      var text = logo.textContent.trim(); logo.textContent = '';
      for (var k = 0; k < text.length; k++) {
        var sp = document.createElement('span');
        sp.textContent = text[k] === ' ' ? '\u00a0' : text[k];
        sp.style.animationDelay = (k * 0.07).toFixed(2) + 's';
        if (text[k] === ' ') sp.className = 'gap';
        logo.appendChild(sp);
      }
      logo.dataset.split = '1';
    }
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    var fine = !!(window.matchMedia && matchMedia('(pointer:fine)').matches);
    U.touch = touch && !fine;
    var verb = document.querySelectorAll('[data-verb]');
    for (var v = 0; v < verb.length; v++) verb[v].textContent = U.touch ? 'touch & hold' : 'hold SPACE';
    U.showBest();
  };

  U.showBest = function () {
    var best = TT.storage.get('tt_best', 0);
    var el = $('titleBest');
    if (!el) return;
    if (best > 0) {
      var r = U.rankFor(best);
      el.innerHTML = 'Best tip: <b>' + best + '</b> <span class="mini-coin"></span> &middot; <i style="color:' + r.col + '">' + r.name + '</i>';
      el.style.display = '';
    } else el.style.display = 'none';
  };

  U._timers = [];
  function later(fn, ms) { U._timers.push(setTimeout(fn, ms)); }
  U.clearReceipt = function () {
    for (var i = 0; i < U._timers.length; i++) clearTimeout(U._timers[i]);
    U._timers.length = 0;
    U.countUp = null;
  };
  U.show = function (which) {
    if (which !== 'result' && which !== 'result-hud') U.clearReceipt();
    U.title.classList.toggle('hidden', which !== 'title');
    U.result.classList.toggle('hidden', which !== 'result');
    U.hud.classList.toggle('hidden', which !== 'hud' && which !== 'result-hud');
  };

  // the "serve again" prompt appears once a restart is accepted
  U.armAgain = function () {
    var el = document.querySelector('#result .again');
    if (!el) return;
    el.classList.remove('ready');
    later(function () { el.classList.add('ready'); }, 900);
  };

  U.showHint = function (text, dur) {
    U.hint.textContent = text;
    U.hint.classList.add('on');
    U.hintT = dur || 3;
  };
  U.hideHint = function () { U.hint.classList.remove('on'); U.hintT = 0; };

  U.flashScreen = function (kind) {
    var f = U.flash;
    f.className = '';
    void f.offsetWidth;
    f.className = 'go ' + (kind || 'hit');
  };

  U.update = function (dt, g) {
    if (U.hintT > 0) { U.hintT -= dt; if (U.hintT <= 0) U.hint.classList.remove('on'); }
    if (!g) return;
    // drinks
    for (var i = 0; i < g.cups.length; i++) {
      var c = g.cups[i], m = U.meters[c.def.id];
      if (!m) continue;
      var pct = Math.max(0, Math.round(c.frac * 100));
      if (pct !== m.last) {
        m.fill.style.transform = 'scaleY(' + Math.max(0, c.frac).toFixed(3) + ')';
        m.pct.textContent = pct + '%';
        if (pct < m.last - 0.5) { m.el.classList.remove('spill'); void m.el.offsetWidth; m.el.classList.add('spill'); }
        m.last = pct;
        m.el.classList.toggle('low', pct < 40);
        m.el.classList.toggle('empty', pct <= 2);
      }
      m.el.classList.toggle('danger', c.st.near > 0.75 && g.mode === 'play');
    }
    // timer
    var tl = Math.max(0, g.timeLeft);
    var secs = Math.ceil(tl);
    if (U._secs !== secs) { U._secs = secs; U.timerNum.textContent = secs; }
    var frac = tl / g.timeLimit;
    U.timerRing.style.strokeDashoffset = (1 - frac) * 176;
    U.timerEl.classList.toggle('hurry', tl <= 15 && g.mode === 'play');
    // tips
    if (U._tips !== g.bonusTips) {
      U._tips = g.bonusTips; U.tipsNum.textContent = g.bonusTips;
      U.tipsEl.classList.remove('bump'); void U.tipsEl.offsetWidth; U.tipsEl.classList.add('bump');
    }
    // progress
    var p = TT.clamp(g.progress, 0, 1);
    U.progMe.style.left = (p * 100).toFixed(2) + '%';
    U.progFill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    if (g.ghostProgress != null) { U.progGhost.style.display = ''; U.progGhost.style.left = (TT.clamp(g.ghostProgress, 0, 1) * 100).toFixed(2) + '%'; }
    else U.progGhost.style.display = 'none';
  };

  U.resetMeters = function () {
    for (var k in U.meters) {
      var m = U.meters[k];
      m.last = 100; m.fill.style.transform = 'scaleY(1)'; m.pct.textContent = '100%';
      m.el.classList.remove('spill', 'low', 'empty', 'danger');
    }
    U._tips = -1; U._secs = -1;
  };

  // ---- receipt ------------------------------------------------------------
  U.showReceipt = function (res, audio) {
    var R = $('result');
    var lines = $('rLines'), total = $('rTotal'), stamp = $('rStamp'), best = $('rBest'), next = $('rNext'), head = $('rHead');
    lines.innerHTML = ''; stamp.className = 'stamp'; stamp.textContent = '';
    best.textContent = ''; next.textContent = ''; total.textContent = '0';
    R.classList.toggle('failed', !!res.fail);
    head.textContent = res.fail ? res.failTitle : 'Order delivered!';
    var items = res.lines;
    var t0 = 250, step = 260;
    U.clearReceipt();
    items.forEach(function (it, idx) {
      later(function () {
        var row = document.createElement('div');
        row.className = 'rl' + (it.cls ? ' ' + it.cls : '');
        row.innerHTML = '<span class="k">' + it.k + '</span><span class="dots"></span><span class="v">' + it.v + '</span>';
        lines.appendChild(row);
        if (audio) audio.coin(0.5, idx + 1);
      }, t0 + idx * step);
    });
    var tEnd = t0 + items.length * step + 150;
    // count-up total
    later(function () {
      var start = performance.now(), dur = 700, target = res.total;
      var token = U.countUp = {};
      var tick = function () {
        if (U.countUp !== token) return;
        var k = Math.min(1, (performance.now() - start) / dur);
        total.textContent = Math.round(target * TT.easeOutCubic(k));
        if (k < 1) requestAnimationFrame(tick);
      };
      tick();
      if (audio && target > 0) audio.play('coins', 0.7);
    }, tEnd);
    later(function () {
      stamp.textContent = res.rank.name;
      stamp.style.color = res.fail ? '#b8322a' : res.rank.col;
      stamp.style.borderColor = stamp.style.color;
      stamp.className = 'stamp in';
      if (audio) audio.stamp(0.9);
      if (res.newBest) { best.innerHTML = '<span class="nb">NEW BEST!</span>'; if (audio) audio.fanfare(0.6); }
      else if (res.best > 0) best.textContent = 'Best: ' + res.best;
      var nx = U.nextRank(res.total);
      if (!res.fail && nx) next.textContent = (nx.min - res.total) + ' more tips to become ' + nx.name + '!';
      else if (res.fail) next.textContent = res.failTip || '';
      else next.textContent = 'You are a legend. Can you beat your own ghost?';
    }, tEnd + 820);
    U.receiptReadyAt = performance.now() + tEnd + 900;
  };
})();
