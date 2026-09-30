(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const deliveries = [
    {
      name: 'EMOTIONAL TURNIPS', kicker: 'THE LIGHT ONE', short: 'turnips', peak: '4.7',
      budget: 12, need: [2.0, 3.25, 4.7, 4.7, 3.25, 2.0],
      winTitle: 'TURNIPS, DELIVERED.',
      winLine: 'The vegetables are only slightly more emotional now.'
    },
    {
      name: 'BUBBLING SOUP', kicker: 'THE SPILLY ONE', short: 'soup', peak: '6.4',
      budget: 16, need: [2.2, 4.8, 6.4, 6.4, 4.8, 2.2],
      winTitle: 'SOUP, UNSPILLED.',
      winLine: 'Not a drop lost. The soup has filed a complaint.'
    },
    {
      name: 'ONE ROYAL ANVIL', kicker: 'THE RIDICULOUS ONE', short: 'anvil', peak: '8.1',
      budget: 22, need: [2.4, 6.4, 8.1, 8.1, 6.4, 2.4],
      winTitle: 'CERTIFIED (ISH).',
      winLine: 'Three carts crossed. The goblin is now a licensed bridge.'
    }
  ];
  const parts = {
    scrap: { name: 'SCRAP', cost: 1, hold: 2.5 },
    beam:  { name: 'BEAM',  cost: 2, hold: 4.4 },
    iron:  { name: 'IRON',  cost: 3, hold: 6.2 }
  };
  const BRACE_COST = 2;
  const BRACE_BONUS = 1.6;
  const toolNames = ['scrap', 'beam', 'iron', 'truss'];
  const el = {
    jobNumber: document.getElementById('jobNumber'), cargoStamp: document.getElementById('cargoStamp'),
    cargoKicker: document.getElementById('cargoKicker'), cargoName: document.getElementById('cargoName'),
    peakLoad: document.getElementById('peakLoad'), phaseBadge: document.getElementById('phaseBadge'),
    phaseText: document.getElementById('phaseText'), boltsLeft: document.getElementById('boltsLeft'),
    budgetTotal: document.getElementById('budgetTotal'), safety: document.getElementById('safety'),
    safetyText: document.getElementById('safetyText'), inspection: document.getElementById('inspection'),
    inspectionText: document.getElementById('inspectionText'), toast: document.getElementById('toast'),
    result: document.getElementById('result'), resultKicker: document.getElementById('resultKicker'),
    resultSeal: document.getElementById('resultSeal'), resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'), resultAction: document.getElementById('resultAction'),
    resultReset: document.getElementById('resultReset'), testButton: document.getElementById('testButton'),
    testButtonText: document.getElementById('testButtonText'), resetButton: document.getElementById('resetButton'),
    tools: [...document.querySelectorAll('.part')], steps: [...document.querySelectorAll('.progress-step')]
  };

  let stage = 0;
  let phase = 'build'; // build, test, falling, failed, celebrating, won
  let selected = 'beam';
  let deck = Array(6).fill('scrap');
  let braces = Array(5).fill(false); // brace j connects spans j and j+1
  let hover = null;
  let lastFailure = null;
  let failureIndex = -1;
  let failureX = 0;
  let failureTime = 0;
  let celebrationTime = 0;
  let testTime = 0;
  let passedSpan = -1;
  let drawing = false;
  let strokeVisits = new Set();
  let particles = [];
  let worldTime = 0;
  let lastFrame = 0;
  let W = 800, H = 410, dpr = 1;
  let g = { left: 110, right: 690, step: 580 / 6, deckY: 220 };
  let toastTimer = 0;
  let audio = null;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gutter = W < 500 ? Math.max(38, W * .135) : clamp(W * .135, 65, 142);
    g = { left: gutter, right: W - gutter, step: (W - 2 * gutter) / 6, deckY: H * .53 };
  }

  function spent() {
    return deck.reduce((sum, p) => sum + parts[p].cost, 0) + braces.filter(Boolean).length * BRACE_COST;
  }
  function remaining() { return deliveries[stage].budget - spent(); }
  function strength(i) {
    return parts[deck[i]].hold + (i > 0 && braces[i - 1] ? BRACE_BONUS : 0)
      + (i < 5 && braces[i] ? BRACE_BONUS : 0);
  }
  function needed(i) { return deliveries[stage].need[i]; }
  function unsafe(i) { return strength(i) + .001 < needed(i); }
  function weakCount() { return deck.reduce((n, _, i) => n + (unsafe(i) ? 1 : 0), 0); }
  function startX() { return g.left - Math.min(70, g.left * .58); }
  function endX() { return g.right + Math.min(70, (W - g.right) * .58); }
  function cartX() {
    if (phase === 'build') return startX();
    if (phase === 'test') return mix(startX(), endX(), clamp(testTime / 5.25, 0, 1));
    if (phase === 'falling' || phase === 'failed') return failureX;
    return endX();
  }

  function setInspection(text, kind = '') {
    el.inspectionText.textContent = text;
    el.inspection.classList.toggle('alert', kind === 'alert');
    el.inspection.classList.toggle('good', kind === 'good');
  }
  function updateInspection() {
    if (phase === 'test' || phase === 'falling') {
      setInspection('LIVE TEST: the cart is rolling. Each span bends under its own load…');
      return;
    }
    if (phase === 'failed') {
      setInspection(`Span ${failureIndex + 1} snapped. Keep your bridge, change a part, and try again.`, 'alert');
      return;
    }
    if (phase === 'celebrating' || phase === 'won') {
      setInspection('A real crossing! The goblin is writing himself a five-star review.', 'good');
      return;
    }
    if (hover && hover.type === 'span') {
      const i = hover.index;
      setInspection(`SPAN ${i + 1} · ${parts[deck[i]].name} holds ${strength(i).toFixed(1)}; this cart needs ${needed(i).toFixed(1)}. ${unsafe(i) ? 'CRUNCH RISK.' : 'Looks crossable.'}`, unsafe(i) ? 'alert' : 'good');
    } else if (hover && hover.type === 'joint') {
      const i = hover.index;
      setInspection(`JOINT ${i + 1} · ${braces[i] ? 'Tap to REMOVE the truss and refund 2 bolts.' : `Tap to ADD a truss: +1.6 strength to spans ${i + 1} and ${i + 2} (2 bolts).`}`);
    } else if (lastFailure && lastFailure.stage === stage && unsafe(lastFailure.index)) {
      setInspection(`Span ${lastFailure.index + 1} broke: ${strength(lastFailure.index).toFixed(1)} strength vs ${needed(lastFailure.index).toFixed(1)} load. Try iron or a truss.`, 'alert');
    } else {
      const weak = weakCount();
      const starter = stage === 0 && spent() === 6 ? 'Six scrap planks came pre-laid. ' : '';
      setInspection(weak ? `${starter}${weak} orange span${weak === 1 ? '' : 's'} look weak. Swaps refund the old plank; tap round joints for trusses.` : 'All spans look sturdy! Send the cart over, or test a different design.', weak ? '' : 'good');
    }
  }

  function updateUI() {
    const job = deliveries[stage];
    el.jobNumber.textContent = `0${stage + 1} / 03`;
    el.cargoStamp.textContent = `0${stage + 1}`;
    el.cargoKicker.textContent = job.kicker;
    el.cargoName.textContent = job.name;
    el.peakLoad.textContent = job.peak;
    el.boltsLeft.textContent = String(remaining());
    el.budgetTotal.textContent = `/ ${job.budget}`;
    const weak = weakCount();
    el.safetyText.textContent = weak ? `${weak} SHAKY SPAN${weak === 1 ? '' : 'S'}` : 'LOOKS CROSSABLE';
    el.safety.classList.toggle('safe', weak === 0);
    el.safety.classList.toggle('warning', weak !== 0);
    el.safety.querySelector('.status-icon').textContent = weak ? '!' : '✓';
    el.steps.forEach((step, i) => {
      step.classList.toggle('done', i < stage || (phase === 'won' && stage === 2));
      step.classList.toggle('active', i === stage && !(phase === 'won' && stage === 2));
    });
    const busy = phase === 'test' || phase === 'falling' || phase === 'celebrating';
    el.phaseBadge.className = 'phase' + (busy ? ' testing' : phase === 'failed' ? ' failed' : phase === 'won' ? ' finished' : '');
    el.phaseText.textContent = phase === 'build' ? 'BUILD PHASE' : busy ? 'LIVE LOAD TEST' : phase === 'failed' ? 'BRIDGE DOWN' : 'DELIVERED!';
    el.testButton.disabled = busy;
    el.resetButton.disabled = phase !== 'build';
    el.testButtonText.textContent = phase === 'build' ? 'TEST THE BRIDGE' : busy ? 'CART ROLLING…'
      : phase === 'failed' ? 'PATCH & RETRY' : stage === 2 ? 'PLAY AGAIN' : 'NEXT DELIVERY';
    el.tools.forEach(btn => {
      const on = btn.dataset.tool === selected;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.disabled = phase !== 'build';
    });
    updateInspection();
  }

  function toast(message, bad = false) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.toggle('bad', bad);
    el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2100);
  }
  function hideResult() {
    el.result.hidden = true;
    el.result.classList.remove('failure', 'success');
  }
  function showResult(succeeded) {
    el.toast.classList.remove('show');
    el.result.classList.add(succeeded ? 'success' : 'failure');
    el.result.classList.remove(succeeded ? 'failure' : 'success');
    el.result.hidden = false;
    if (succeeded) {
      el.resultKicker.textContent = stage === 2 ? 'THREE OUT OF THREE DELIVERED' : 'DELIVERY STAMP: APPROVED';
      el.resultSeal.textContent = '✓';
      el.resultTitle.textContent = deliveries[stage].winTitle;
      el.resultMessage.textContent = deliveries[stage].winLine + (stage < 2 ? ' The next cart is heavier; keep this design and get more bolts.' : ' Go again? The turnips miss you.');
      el.resultAction.innerHTML = stage === 2 ? 'PLAY AGAIN <span aria-hidden="true">↺</span>' : 'NEXT DELIVERY <span aria-hidden="true">→</span>';
    } else {
      const i = failureIndex;
      el.resultKicker.textContent = 'OFFICIAL ACCIDENT REPORT';
      el.resultSeal.textContent = '!';
      el.resultTitle.textContent = 'CARTASTROPHE!';
      el.resultMessage.textContent = `Span ${i + 1} held ${strength(i).toFixed(1)}, but the ${deliveries[stage].short} needed ${needed(i).toFixed(1)}. Beef up that plank or add a truss beside it.`;
      el.resultAction.innerHTML = 'PATCH & RETRY <span aria-hidden="true">→</span>';
    }
    el.resultAction.focus({ preventScroll: true });
    updateUI();
  }

  function selectTool(name) {
    if (phase !== 'build' || !toolNames.includes(name)) return;
    selected = name;
    sound('select');
    updateUI();
  }
  function changeSpan(i, name) {
    if (deck[i] === name) return;
    const change = parts[name].cost - parts[deck[i]].cost;
    if (change > remaining()) {
      toast(`Need ${change} bolts; only ${remaining()} left. Downgrade a plank or remove a truss.`, true);
      sound('no');
      return;
    }
    deck[i] = name;
    sprinkle(g.left + (i + .5) * g.step, g.deckY - 12, 7, 'spark');
    sound(name === 'iron' ? 'iron' : 'place');
    updateUI();
  }
  function toggleBrace(i) {
    if (!braces[i] && remaining() < BRACE_COST) {
      toast('A truss costs 2 bolts. Reuse a pricier plank or remove another truss.', true);
      sound('no');
      return;
    }
    braces[i] = !braces[i];
    sprinkle(g.left + (i + 1) * g.step, g.deckY + 53, 8, 'spark');
    sound('brace');
    updateUI();
  }
  function applyHit(hit) {
    if (phase !== 'build' || !hit) return;
    if (hit.type === 'joint') {
      toggleBrace(hit.index);
    } else if (selected === 'truss') {
      toast('Trusses snap onto the round joints BELOW the planks.');
      sound('no');
    } else changeSpan(hit.index, selected);
  }
  function resetPlan() {
    if (phase !== 'build' && phase !== 'failed' && phase !== 'won') return;
    if (phase === 'won') { stage = 0; }
    phase = 'build';
    deck = Array(6).fill('scrap');
    braces = Array(5).fill(false);
    selected = 'beam';
    lastFailure = null;
    failureIndex = -1;
    particles = [];
    hover = null;
    hideResult();
    sound('reset');
    updateUI();
    toast('Back to six highly questionable scrap planks.');
  }
  function startTest() {
    if (phase !== 'build') return;
    phase = 'test';
    testTime = 0;
    passedSpan = -1;
    failureIndex = -1;
    lastFailure = null;
    hover = null;
    hideResult();
    sound('go');
    updateUI();
  }
  function nextAction() {
    ensureAudio();
    if (phase === 'build') startTest();
    else if (phase === 'failed') {
      phase = 'build';
      hideResult();
      sound('select');
      updateUI();
      toast('Same bridge, fresh cart. Patch the crunchy bit!');
    } else if (phase === 'won') {
      if (stage === 2) {
        stage = 0;
        phase = 'build';
        deck = Array(6).fill('scrap');
        braces = Array(5).fill(false);
        selected = 'beam';
        particles = [];
        toast('New shift! Six fresh scraps and a cartful of bad decisions.');
      } else {
        stage++;
        phase = 'build';
        selected = stage === 1 ? 'iron' : 'truss';
        toast('Heavier cargo! Your bridge stays, and you have a bigger bolt budget.');
      }
      lastFailure = null;
      failureIndex = -1;
      hover = null;
      hideResult();
      sound('next');
      updateUI();
    }
  }
  function breakSpan(i, x) {
    failureIndex = i;
    failureX = x;
    failureTime = 0;
    phase = 'falling';
    lastFailure = { stage, index: i };
    sprinkle(g.left + (i + .5) * g.step, g.deckY, 27, 'wood');
    sound('break');
    updateUI();
  }
  function finishCrossing() {
    phase = 'celebrating';
    celebrationTime = 0;
    sprinkle(g.right + Math.min(24, (W - g.right) * .5), H * .27, reducedMotion ? 20 : 56, 'confetti');
    sound('win');
    updateUI();
  }

  // Sound is synthesized locally, and the audio context is only created after a click or keypress.
  function ensureAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audio = new AudioContextClass();
    } catch (_) { audio = null; }
  }
  function tone(freq, duration, wave = 'triangle', volume = .045, end = freq, delay = 0) {
    if (!audio) return;
    try {
      const now = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(Math.max(30, freq), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + .01);
    } catch (_) { /* Audio is entirely optional. */ }
  }
  function hiss(duration = .18) {
    if (!audio) return;
    try {
      const length = Math.floor(audio.sampleRate * duration);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1300;
      const gain = audio.createGain();
      gain.gain.value = .075;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start();
    } catch (_) { /* Silent fallback. */ }
  }
  function sound(kind) {
    if (!audio) return;
    if (kind === 'select') tone(570, .055, 'sine', .018, 620);
    else if (kind === 'place') { tone(240, .105, 'triangle', .045, 165); tone(380, .05, 'square', .012, 270, .035); }
    else if (kind === 'iron') { tone(810, .23, 'sine', .032, 470); tone(560, .19, 'sine', .021, 370, .04); }
    else if (kind === 'brace') { tone(310, .09, 'square', .023, 240); tone(490, .13, 'triangle', .027, 385, .065); }
    else if (kind === 'no') tone(175, .12, 'sawtooth', .019, 120);
    else if (kind === 'go') { tone(480, .18, 'sine', .045, 720); tone(650, .22, 'triangle', .025, 940, .11); }
    else if (kind === 'tick') tone(140, .065, 'triangle', .018, 100);
    else if (kind === 'break') { hiss(.23); tone(210, .44, 'sawtooth', .07, 43); tone(350, .17, 'square', .027, 80); }
    else if (kind === 'win') { [392, 523, 659, 784].forEach((n, i) => tone(n, .22, 'triangle', .043, n * 1.015, i * .105)); }
    else if (kind === 'reset') tone(460, .13, 'triangle', .026, 230);
    else if (kind === 'next') { tone(330, .11, 'sine', .03, 400); tone(530, .12, 'sine', .03, 620, .1); }
  }

  function sprinkle(x, y, amount, kind) {
    for (let i = 0; i < amount; i++) {
      const angle = rnd(-Math.PI, 0);
      const speed = kind === 'confetti' ? rnd(35, 125) : rnd(35, 140);
      particles.push({
        x, y, vx: Math.cos(angle) * speed + (kind === 'confetti' ? rnd(-85, 35) : 0),
        vy: Math.sin(angle) * speed - (kind === 'confetti' ? 20 : 0),
        gravity: kind === 'confetti' ? rnd(55, 100) : rnd(190, 340),
        spin: rnd(-7, 7), rotation: rnd(0, Math.PI * 2),
        size: kind === 'wood' ? rnd(3, 9) : kind === 'confetti' ? rnd(4, 9) : rnd(2, 4),
        life: kind === 'confetti' ? rnd(1.65, 3.0) : kind === 'wood' ? rnd(.75, 1.35) : rnd(.25, .55),
        maxLife: 0, kind,
        color: kind === 'wood' ? ['#985c3b', '#e5ad68', '#4f6f60'][i % 3]
          : kind === 'confetti' ? ['#ffcc62', '#ed8060', '#b1d666', '#74aaa2', '#fff5d6'][i % 5] : '#ffe39a'
      });
      particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
    }
  }
  function advance(dt) {
    if (phase === 'test') {
      testTime += dt;
      const x = cartX();
      for (let i = passedSpan + 1; i < 6; i++) {
        if (x < g.left + (i + .69) * g.step) break;
        passedSpan = i;
        if (unsafe(i)) { breakSpan(i, x); break; }
        sound('tick');
      }
      if (phase === 'test' && testTime >= 5.25) finishCrossing();
    } else if (phase === 'falling') {
      failureTime += dt;
      if (failureTime > 1.12) {
        phase = 'failed';
        showResult(false);
      }
    } else if (phase === 'celebrating') {
      celebrationTime += dt;
      if (celebrationTime > .64) {
        phase = 'won';
        showResult(true);
      }
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - dt * (p.kind === 'confetti' ? .35 : .8);
      p.rotation += p.spin * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0 && p.y < H + 60);
  }

  function location(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height };
  }
  function hitTest(x, y) {
    if (x >= g.left && x <= g.right && y >= g.deckY - 35 && y <= g.deckY + 37) {
      return { type: 'span', index: clamp(Math.floor((x - g.left) / g.step), 0, 5) };
    }
    if (y >= g.deckY + 38 && y <= g.deckY + 105) {
      let best = -1, dist = Infinity;
      for (let j = 0; j < 5; j++) {
        const d = Math.abs(x - (g.left + (j + 1) * g.step));
        if (d < dist) { dist = d; best = j; }
      }
      if (dist < Math.max(19, Math.min(31, g.step * .43))) return { type: 'joint', index: best };
    }
    return null;
  }
  function hitKey(hit) { return hit ? hit.type + hit.index : ''; }
  function handlePointer(event, isDown = false) {
    if (phase !== 'build') return;
    const p = location(event);
    const h = hitTest(p.x, p.y);
    if (hitKey(h) !== hitKey(hover)) { hover = h; updateInspection(); }
    if (isDown || drawing) {
      const key = hitKey(h);
      if (key && !strokeVisits.has(key)) {
        strokeVisits.add(key);
        applyHit(h);
      }
    }
  }
  canvas.addEventListener('pointerdown', event => {
    if (phase !== 'build' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    ensureAudio();
    drawing = true;
    strokeVisits = new Set();
    try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* Mouse still works. */ }
    handlePointer(event, true);
  });
  canvas.addEventListener('pointermove', event => handlePointer(event));
  canvas.addEventListener('pointerup', () => { drawing = false; strokeVisits.clear(); });
  canvas.addEventListener('pointercancel', () => { drawing = false; strokeVisits.clear(); });
  canvas.addEventListener('lostpointercapture', () => { drawing = false; strokeVisits.clear(); });
  canvas.addEventListener('pointerleave', () => {
    if (!drawing) { hover = null; updateInspection(); }
  });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (phase !== 'build') return;
    const p = location(event), hit = hitTest(p.x, p.y);
    if (!hit) return;
    ensureAudio();
    if (hit.type === 'span') changeSpan(hit.index, 'scrap');
    else if (braces[hit.index]) toggleBrace(hit.index);
  });
  canvas.addEventListener('focus', () => { if (phase === 'build' && !hover) { hover = { type: 'span', index: 2 }; updateInspection(); } });
  canvas.addEventListener('keydown', e => {
    if (phase !== 'build') return;
    const k = e.key;
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      const h = hover || { type: 'span', index: 2 };
      if (k === 'ArrowDown') hover = { type: 'joint', index: clamp(h.index, 0, 4) };
      else if (k === 'ArrowUp') hover = { type: 'span', index: h.type === 'joint' ? h.index + 1 : h.index };
      else hover = { type: h.type, index: clamp(h.index + (k === 'ArrowRight' ? 1 : -1), 0, h.type === 'joint' ? 4 : 5) };
      updateInspection();
    } else if (k === ' ') { e.preventDefault(); ensureAudio(); applyHit(hover || { type: 'span', index: 2 }); }
  });
  el.tools.forEach(btn => btn.addEventListener('click', () => { ensureAudio(); selectTool(btn.dataset.tool); }));
  el.testButton.addEventListener('click', nextAction);
  el.resultAction.addEventListener('click', nextAction);
  el.resetButton.addEventListener('click', () => { ensureAudio(); resetPlan(); });
  el.resultReset.addEventListener('click', () => { ensureAudio(); resetPlan(); });
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const inButton = event.target instanceof HTMLElement && !!event.target.closest('button');
    if (/^[1-4]$/.test(event.key) && !inButton) {
      ensureAudio(); selectTool(toolNames[Number(event.key) - 1]);
    } else if (event.key.toLowerCase() === 'r' && !inButton && phase === 'build') {
      ensureAudio(); resetPlan();
    } else if (event.key === 'Enter' && !inButton && ['build', 'failed', 'won'].includes(phase)) {
      event.preventDefault(); nextAction();
    }
  });

  function rounded(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function oval(x, y, rx, ry, fill, stroke = null, lw = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function cloud(cx, cy, scale, alpha = .65) {
    ctx.save(); ctx.globalAlpha = alpha;
    oval(cx, cy, 47 * scale, 12 * scale, '#fff6df');
    oval(cx - 19 * scale, cy - 7 * scale, 18 * scale, 15 * scale, '#fff6df');
    oval(cx + 8 * scale, cy - 13 * scale, 24 * scale, 20 * scale, '#fff6df');
    oval(cx + 28 * scale, cy - 4 * scale, 18 * scale, 13 * scale, '#fff6df');
    ctx.restore();
  }
  function mountain(y, color, a, offset) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 10) {
      const yy = y + Math.sin(x * .014 + offset) * a + Math.sin(x * .033 + offset * 2.1) * a * .27;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function drawCliff(leftSide) {
    const edge = leftSide ? g.left : g.right;
    const dir = leftSide ? -1 : 1;
    const D = g.deckY;
    ctx.beginPath();
    if (leftSide) ctx.moveTo(0, D + 7); else ctx.moveTo(W, D + 7);
    ctx.lineTo(edge, D + 7);
    ctx.lineTo(edge + dir * 2, D + 22);
    ctx.lineTo(edge - dir * 4, D + 38);
    ctx.lineTo(edge + dir * 8, D + 54);
    ctx.lineTo(edge + dir * 3, D + 74);
    ctx.lineTo(edge + dir * 13, D + 98);
    ctx.lineTo(edge + dir * 8, D + 120);
    ctx.lineTo(edge + dir * 21, H + 4);
    ctx.lineTo(leftSide ? 0 : W, H + 4);
    ctx.closePath(); ctx.fillStyle = '#b67854'; ctx.fill();
    // The angular face and strata make the gap look like a cutaway.
    ctx.beginPath(); ctx.moveTo(edge, D + 11);
    ctx.lineTo(edge + dir * 10, D + 50); ctx.lineTo(edge + dir * 15, H);
    ctx.strokeStyle = '#84543e'; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.strokeStyle = '#df9c67'; ctx.lineWidth = 2; ctx.globalAlpha = .8;
    for (let k = 0; k < 5; k++) {
      const yy = D + 35 + k * 36;
      const far = leftSide ? 0 : W;
      const x0 = mix(edge + dir * 15, far, .15 + (k % 2) * .2);
      line(x0, yy, mix(edge + dir * 15, far, .75), yy + 4, '#db9a70', 2);
    }
    ctx.restore();
    // Grassy rim.
    line(leftSide ? 0 : edge, D + 7, leftSide ? edge : W, D + 7, '#466c4c', 12);
    line(leftSide ? 0 : edge, D + 3, leftSide ? edge : W, D + 3, '#a8c56a', 6);
    for (let j = 0; j < 7; j++) {
      const xx = leftSide ? 11 + j * (Math.max(10, edge - 17) / 6) : edge + 10 + j * (Math.max(10, W - edge - 18) / 6);
      const h = 5 + ((j * 7) % 5);
      line(xx, D + 3, xx - 2, D - h, '#62864c', 1.5);
      line(xx, D + 2, xx + 2, D - h * .7, '#62864c', 1.5);
    }
    // Pebbles along the face.
    for (let j = 0; j < 7; j++) {
      const xx = leftSide ? (edge * .17 + ((j * 31) % Math.max(18, edge * .66))) : (edge + 10 + ((j * 19) % Math.max(12, (W - edge) * .65)));
      const yy = D + 33 + j * 25;
      oval(xx, yy, 3 + (j % 3), 1.8, '#d39568');
    }
  }
  function drawBackground() {
    const D = g.deckY;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f1ba91'); sky.addColorStop(.54, '#fce2ab'); sky.addColorStop(1, '#f3d59e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sunX = W * .69, sunY = H * .185;
    const glow = ctx.createRadialGradient(sunX, sunY, 9, sunX, sunY, Math.max(85, W * .15));
    glow.addColorStop(0, '#fff8d5bd'); glow.addColorStop(1, '#fff8d500');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, D + 90);
    oval(sunX, sunY, 27, 27, '#ffe9ab', '#efb982', 2);
    mountain(D * .68, '#dcb78c', 21, .5);
    mountain(D * .81, '#bdb58d', 18, 2.7);
    mountain(D * .99, '#a7b18a', 13, 1.2);
    cloud((W * .23 + (reducedMotion ? 0 : worldTime * 3)) % (W + 125) - 45, H * .16, W < 500 ? .62 : .9, .68);
    cloud(W * .85 - (reducedMotion ? 0 : worldTime * 1.7) % 50, H * .31, .6, .45);
    // The dark empty ravine sits behind the two cliff faces.
    const abyss = ctx.createLinearGradient(0, D + 8, 0, H);
    abyss.addColorStop(0, '#4c6157'); abyss.addColorStop(.25, '#334c4b'); abyss.addColorStop(1, '#142c34');
    ctx.fillStyle = abyss; ctx.fillRect(g.left - 21, D + 6, g.right - g.left + 42, H - D);
    ctx.save(); ctx.beginPath(); ctx.rect(g.left - 18, D + 10, g.right - g.left + 36, H - D); ctx.clip();
    for (let j = 0; j < 6; j++) {
      const yy = D + 24 + j * 30;
      ctx.beginPath(); ctx.moveTo(g.left - 10, yy);
      for (let x = g.left; x <= g.right + 10; x += 12) ctx.lineTo(x, yy + Math.sin(x * .024 + j) * 5);
      ctx.strokeStyle = j % 2 ? '#54736a68' : '#82927b44'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (let j = 0; j < 11; j++) {
      const xx = g.left + 24 + ((j * 97 + 13) % Math.max(45, g.right - g.left - 45));
      const yy = D + 40 + ((j * 53) % Math.max(50, H - D - 50));
      oval(xx, yy, 1.4, 1.4, '#b5c39550');
    }
    // A tiny ravine inhabitant approves of very few designs.
    if (W > 500) {
      const eyeY = H - 42, eyeX = (g.left + g.right) * .52;
      oval(eyeX - 8, eyeY, 5, 5, '#e4e3ab'); oval(eyeX + 8, eyeY, 5, 5, '#e4e3ab');
      oval(eyeX - 7, eyeY + 1, 2, 2.5, '#263b39'); oval(eyeX + 9, eyeY + 1, 2, 2.5, '#263b39');
      ctx.font = 'bold 9px "Trebuchet MS",sans-serif'; ctx.fillStyle = '#adc3ad'; ctx.textAlign = 'center';
      ctx.fillText('RAVINE RESIDENT', eyeX, H - 13);
    }
    ctx.restore();
    drawCliff(true); drawCliff(false);
    // Finish pennant, just beyond the right bank.
    const flagX = g.right + Math.min(17, (W - g.right) * .37);
    line(flagX, D + 1, flagX, D - 100, '#5c5641', 3);
    ctx.beginPath(); ctx.moveTo(flagX, D - 97); ctx.lineTo(flagX - 42, D - 85);
    ctx.lineTo(flagX, D - 70); ctx.closePath(); ctx.fillStyle = '#ee8659'; ctx.fill();
    ctx.strokeStyle = '#794d39'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff9d9'; ctx.font = 'bold 11px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('GO!', flagX - 17, D - 81);
  }

  function drawSupports() {
    const D = g.deckY, step = g.step;
    for (let j = 0; j < 5; j++) {
      const x = g.left + (j + 1) * step;
      const socketY = D + 63;
      const active = braces[j];
      const hovering = phase === 'build' && hover && hover.type === 'joint' && hover.index === j;
      const spread = step * .37;
      if (active) {
        ctx.beginPath(); ctx.moveTo(x - spread, D + 11);
        ctx.lineTo(x, socketY); ctx.lineTo(x + spread, D + 11);
        ctx.strokeStyle = '#294941'; ctx.lineWidth = clamp(step * .095, 6, 10); ctx.lineJoin = 'round'; ctx.stroke();
        ctx.strokeStyle = '#8cb45e'; ctx.lineWidth = clamp(step * .044, 3, 5); ctx.stroke();
        line(x - spread * .55, D + 40, x + spread * .55, D + 40, '#47735b', 4);
        oval(x - spread, D + 11, 5, 5, '#ffd47b', '#2e4d44', 2);
        oval(x + spread, D + 11, 5, 5, '#ffd47b', '#2e4d44', 2);
        oval(x, socketY, hovering ? 17 : 14, hovering ? 17 : 14, hovering ? '#fff0a8' : '#e5bf69', '#294941', 3);
        ctx.fillStyle = '#334d41'; ctx.font = 'bold 16px Arial,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('✓', x, socketY + 5);
      } else if (phase === 'build') {
        ctx.save(); ctx.setLineDash([4, 5]); ctx.beginPath();
        ctx.moveTo(x - spread, D + 11); ctx.lineTo(x, socketY); ctx.lineTo(x + spread, D + 11);
        ctx.strokeStyle = hovering ? '#ffe392' : '#c5c89b99'; ctx.lineWidth = hovering ? 3 : 2; ctx.stroke();
        ctx.setLineDash([]);
        oval(x, socketY, hovering ? 18 : 15, hovering ? 18 : 15, hovering ? '#ffe6a1' : '#e6dcac', '#647963', 2);
        line(x - 5, socketY, x + 5, socketY, '#657e64', 2);
        line(x, socketY - 5, x, socketY + 5, '#657e64', 2);
        ctx.restore();
      }
    }
  }
  function sagAtSpan(i) {
    if (phase !== 'test' && phase !== 'falling' && phase !== 'celebrating') return 0;
    const x = cartX();
    const mid = g.left + (i + .5) * g.step;
    const influence = clamp(1 - Math.abs(x - mid) / (g.step * 1.3), 0, 1);
    const stress = needed(i) / strength(i);
    return influence * (2 + clamp((stress - .62) * 19, 0, 18));
  }
  function deckHeightAt(x) {
    if (x < g.left || x > g.right) return 0;
    const p = clamp((x - g.left) / g.step - .5, 0, 5);
    const i = Math.floor(p), f = p - i;
    return mix(sagAtSpan(i), sagAtSpan(Math.min(5, i + 1)), f);
  }
  function drawSpan(i) {
    const D = g.deckY, step = g.step;
    const cx = g.left + (i + .5) * step;
    const ww = step - 3.2;
    const failed = (phase === 'falling' || phase === 'failed') && i === failureIndex;
    ctx.save();
    ctx.translate(cx, D + sagAtSpan(i) + (failed ? Math.min(155, failureTime * failureTime * 190) : 0));
    if (failed) ctx.rotate(clamp(failureTime * 1.25, 0, 1.25) * (i % 2 ? 1 : -1));
    if (phase === 'build' && hover && hover.type === 'span' && hover.index === i) {
      rounded(-ww / 2 - 4, -17, ww + 8, 38, 5); ctx.fillStyle = '#fff1a780'; ctx.fill();
      ctx.strokeStyle = '#ffde7f'; ctx.lineWidth = 3; ctx.stroke();
    }
    rounded(-ww / 2, -6, ww, 24, 3); ctx.fillStyle = '#493e31a6'; ctx.fill();
    if (deck[i] === 'scrap') {
      for (let k = 0; k < 2; k++) {
        const shift = ((i + k) % 3 - 1) * 2;
        rounded(-ww / 2 + 1 + shift, -10 + k * 9, ww - 3, 10, 2);
        ctx.fillStyle = k ? '#ba7848' : '#cb8851'; ctx.fill();
        ctx.strokeStyle = '#664631'; ctx.lineWidth = 2; ctx.stroke();
        line(-ww / 2 + 8, -7 + k * 9, ww / 2 - 8, -7 + k * 9, '#e5a36588', 1.5);
      }
      if (ww > 48) {
        line(-ww * .2, -6, -ww * .24, -1, '#754b35', 1.5);
        line(ww * .23, 4, ww * .26, 9, '#754b35', 1.5);
      }
    } else if (deck[i] === 'beam') {
      rounded(-ww / 2, -11, ww, 26, 3); ctx.fillStyle = '#794b33'; ctx.fill();
      ctx.strokeStyle = '#453e31'; ctx.lineWidth = 2; ctx.stroke();
      rounded(-ww / 2 + 3, -9, ww - 6, 17, 2); ctx.fillStyle = '#b97847'; ctx.fill();
      line(-ww / 2 + 7, -6, ww / 2 - 7, -6, '#edb072', 2);
      line(-ww * .34, 12, ww * .32, -6, '#e3ae6c', 3);
      line(-ww * .33, -6, ww * .32, 12, '#e3ae6c', 3);
      rounded(-ww / 2 + 3, -8, 8, 18, 2); ctx.fillStyle = '#53665a'; ctx.fill();
      rounded(ww / 2 - 11, -8, 8, 18, 2); ctx.fill();
    } else {
      rounded(-ww / 2, -12, ww, 25, 3); ctx.fillStyle = '#35585b'; ctx.fill();
      ctx.strokeStyle = '#263e42'; ctx.lineWidth = 2.5; ctx.stroke();
      rounded(-ww / 2 + 3, -10, ww - 6, 16, 2); ctx.fillStyle = '#6a9e9e'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(-ww / 2 + 5, -9, ww - 10, 13); ctx.clip();
      for (let k = -ww / 2 - 12; k < ww / 2 + 14; k += 14) line(k, 5, k + 15, -11, '#a5c3b0a1', 2);
      ctx.restore();
      line(-ww / 2 + 4, 9, ww / 2 - 4, 9, '#a6b9a6', 2);
    }
    const nailColor = deck[i] === 'iron' ? '#d0dec0' : '#f2cb83';
    for (const side of [-1, 1]) {
      oval(side * (ww / 2 - 10), -3, 2.6, 2.6, nailColor, '#5b5945', 1);
    }
    ctx.fillStyle = deck[i] === 'iron' ? '#e2f1d1' : '#fff3ce';
    ctx.font = `900 ${clamp(step * .13, 9, 12)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText(String(i + 1), 0, 5);
    ctx.restore();
    if (phase === 'build' && unsafe(i)) {
      const by = D - 29 + (hover && hover.type === 'span' && hover.index === i ? -2 : 0);
      ctx.save(); ctx.translate(cx, by); ctx.rotate(Math.PI / 4);
      rounded(-7, -7, 14, 14, 2); ctx.fillStyle = lastFailure && lastFailure.index === i ? '#dd6650' : '#ee8b50'; ctx.fill();
      ctx.strokeStyle = '#fff5d8'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#fff9df'; ctx.font = '900 12px Arial,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', cx, by + 4);
    }
  }

  function drawCargo(which, t) {
    if (which === 0) {
      for (let i = 0; i < 3; i++) {
        const x = -19 + i * 19, y = -43 - (i % 2) * 4;
        oval(x, y, 11, 13, i === 1 ? '#f8e7b8' : '#e7ddaf', '#7e7951', 1.4);
        line(x, y - 11, x, y - 20, '#476c43', 2);
        oval(x - 4, y - 18, 5, 2.4, '#75a653'); oval(x + 4, y - 19, 5, 2.4, '#87b15b');
      }
      oval(-3, -43, 1.5, 2, '#354a40'); oval(3, -43, 1.5, 2, '#354a40');
      line(-2, -36, 4, -36, '#735b48', 1);
    } else if (which === 1) {
      oval(0, -47, 29, 20, '#454b54', '#2c3b40', 2);
      oval(0, -58, 25, 7, '#253a3c', '#aeb7a8', 3);
      oval(0, -58, 18, 3.5, '#d6b36b');
      line(-29, -48, -36, -52, '#b9b5a0', 3); line(29, -48, 36, -52, '#b9b5a0', 3);
      for (let i = -1; i <= 1; i++) {
        const wiggle = Math.sin(t * 5 + i * 2) * 3;
        ctx.beginPath(); ctx.moveTo(i * 11 - 1, -65); ctx.quadraticCurveTo(i * 11 + wiggle + 6, -75, i * 11, -83);
        ctx.strokeStyle = '#fff8deaa'; ctx.lineWidth = 2; ctx.stroke();
      }
      oval(-11, -52, 2, 2, '#f3d38b'); oval(14, -55, 2.5, 2.5, '#f3d38b');
    } else {
      ctx.beginPath(); ctx.moveTo(-27, -58); ctx.lineTo(27, -58); ctx.lineTo(21, -51);
      ctx.lineTo(16, -51); ctx.lineTo(12, -34); ctx.lineTo(-17, -34); ctx.lineTo(-13, -48);
      ctx.lineTo(-27, -49); ctx.closePath(); ctx.fillStyle = '#899e9e'; ctx.fill();
      ctx.strokeStyle = '#314b51'; ctx.lineWidth = 3; ctx.stroke();
      line(-20, -55, 20, -55, '#d4dbbc', 2);
      rounded(-16, -35, 36, 7, 2); ctx.fillStyle = '#475e62'; ctx.fill();
      // The royal anvil wears a tiny, completely unnecessary crown.
      ctx.beginPath(); ctx.moveTo(-9, -59); ctx.lineTo(-10, -72); ctx.lineTo(-4, -66);
      ctx.lineTo(0, -75); ctx.lineTo(5, -66); ctx.lineTo(11, -72); ctx.lineTo(9, -59);
      ctx.closePath(); ctx.fillStyle = '#ffd361'; ctx.fill(); ctx.strokeStyle = '#8b6743'; ctx.lineWidth = 1.5; ctx.stroke();
      oval(0, -66, 2, 2, '#e88058');
    }
  }
  function drawCart(x, deckY, tilt = 0, falling = false) {
    const scale = clamp(g.step / 78, .72, 1.08);
    ctx.save(); ctx.translate(x, deckY - 14); ctx.rotate(tilt); ctx.scale(scale, scale);
    // Shadow, under the running gear.
    if (!falling) oval(0, 16, 42, 4, '#263c3c44');
    line(-24, -17, -24, 0, '#494b3f', 5); line(24, -17, 24, 0, '#494b3f', 5);
    drawCargo(stage, worldTime);
    ctx.beginPath(); ctx.moveTo(-38, -39); ctx.lineTo(38, -39); ctx.lineTo(33, -16);
    ctx.lineTo(-33, -16); ctx.closePath(); ctx.fillStyle = '#ba633e'; ctx.fill();
    ctx.strokeStyle = '#3c4036'; ctx.lineWidth = 3; ctx.stroke();
    line(-34, -32, 34, -32, '#ed9e5b', 3);
    line(-31, -19, 31, -19, '#724c38', 3);
    for (let i = -1; i <= 1; i++) {
      line(i * 17, -37, i * 17, -18, '#da8350', 2);
      oval(i * 16, -27, 2, 2, '#f4c979');
    }
    const spin = (x - startX()) * .11 + (falling ? failureTime * 6 : 0);
    for (const wx of [-24, 24]) {
      oval(wx, 0, 12, 12, '#303d3e', '#192f32', 2);
      oval(wx, 0, 7.4, 7.4, '#b3a982', '#ead49c', 1.5);
      for (let j = 0; j < 4; j++) {
        const a = spin + j * Math.PI / 2;
        line(wx, 0, wx + Math.cos(a) * 6, Math.sin(a) * 6, '#536967', 2);
      }
      oval(wx, 0, 2.4, 2.4, '#f5df9d');
    }
    ctx.restore();
  }
  function drawGoblin() {
    const D = g.deckY;
    const room = W - g.right;
    const x = g.right + room * .51;
    const s = W < 530 ? .73 : .95;
    const worried = phase === 'falling' || phase === 'failed';
    const pleased = phase === 'celebrating' || phase === 'won';
    const wave = reducedMotion ? 0 : Math.sin(worldTime * (phase === 'test' ? 11 : 3)) * (pleased ? 7 : 3);
    ctx.save(); ctx.translate(x, D + 4); ctx.scale(s, s);
    // Boots, vest, waving arm and clipboard.
    rounded(-14, -4, 12, 7, 2); ctx.fillStyle = '#403c32'; ctx.fill();
    rounded(4, -4, 13, 7, 2); ctx.fill();
    line(-7, -6, -8, -21, '#526d43', 5); line(8, -6, 7, -21, '#526d43', 5);
    rounded(-14, -37, 28, 22, 7); ctx.fillStyle = '#ed9853'; ctx.fill(); ctx.strokeStyle = '#4c5139'; ctx.lineWidth = 2; ctx.stroke();
    line(-4, -34, -3, -18, '#f8d681', 3); line(5, -34, 5, -18, '#f8d681', 3);
    line(12, -31, 20, -26 + (worried ? 7 : wave), '#72a44d', 5);
    oval(20, -25 + (worried ? 7 : wave), 4, 4, '#99c85c');
    line(-12, -31, -21, -15, '#72a44d', 5);
    rounded(-30, -22, 15, 19, 2); ctx.fillStyle = '#ded1ad'; ctx.fill(); ctx.strokeStyle = '#566059'; ctx.lineWidth = 1.5; ctx.stroke();
    line(-26, -16, -19, -16, '#aeb6a1', 1);
    oval(-1, -50, 19, 19, '#a5cf61', '#375641', 2.5);
    ctx.beginPath(); ctx.moveTo(-15, -55); ctx.lineTo(-31, -60); ctx.lineTo(-20, -41); ctx.closePath(); ctx.fillStyle = '#a5cf61'; ctx.fill(); ctx.strokeStyle = '#375641'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, -55); ctx.lineTo(31, -60); ctx.lineTo(20, -41); ctx.closePath(); ctx.fillStyle = '#a5cf61'; ctx.fill(); ctx.stroke();
    oval(-8, -51, 6, 7, '#fff6d7', '#456145', 1); oval(7, -51, 6, 7, '#fff6d7', '#456145', 1);
    oval(-6 + (worried ? 1 : -1), -50, worried ? 2.3 : 2, 2.5, '#283e38');
    oval(9 + (worried ? 1 : -1), -50, worried ? 2.3 : 2, 2.5, '#283e38');
    ctx.beginPath(); ctx.moveTo(1, -49); ctx.lineTo(-1, -43); ctx.lineTo(6, -44); ctx.closePath(); ctx.fillStyle = '#7baf4d'; ctx.fill(); ctx.strokeStyle = '#426540'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath();
    if (worried) ctx.arc(1, -34, 4, Math.PI, Math.PI * 2);
    else ctx.arc(1, -39, pleased ? 7 : 4, .1, Math.PI - .1);
    ctx.strokeStyle = '#355344'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-19, -63); ctx.quadraticCurveTo(-18, -78, -2, -78);
    ctx.quadraticCurveTo(14, -78, 17, -63); ctx.closePath(); ctx.fillStyle = '#ffcf5b'; ctx.fill();
    ctx.strokeStyle = '#3d5943'; ctx.lineWidth = 2; ctx.stroke();
    rounded(-8, -81, 13, 7, 2); ctx.fillStyle = '#ed9153'; ctx.fill();
    line(-21, -63, 20, -63, '#8d7348', 3);
    ctx.restore();
    // Comic speech bubble; kept above the bridge and inside the frame.
    const word = worried ? 'UH-OH' : pleased ? 'HA!' : phase === 'test' ? '…' : 'HMM';
    const by = D - (W < 530 ? 92 : 113);
    const bx = clamp(x, 34, W - 34);
    rounded(bx - 27, by - 14, 54, 27, 11);
    ctx.fillStyle = '#fff8dc'; ctx.fill(); ctx.strokeStyle = '#5d705a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 1, by + 13); ctx.lineTo(bx + 6, by + 20); ctx.lineTo(bx + 9, by + 12);
    ctx.fillStyle = '#fff8dc'; ctx.fill();
    ctx.font = '900 11px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#42584a'; ctx.fillText(word, bx, by + 4);
  }
  function drawBoardLabels() {
    const D = g.deckY;
    rounded(14, 13, W < 470 ? 147 : 188, 31, 7);
    ctx.fillStyle = '#263e3bcf'; ctx.fill();
    ctx.fillStyle = '#fff4d7'; ctx.font = `900 ${W < 470 ? 10 : 11}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'left';
    const label = phase === 'build' ? (W < 470 ? '✎  TAP TO REINFORCE' : '✎  GOBLIN BLUEPRINT MODE') :
      phase === 'test' || phase === 'falling' ? '●  LIVE LOAD TEST' : '★  OFFICIAL RESULTS';
    ctx.fillText(label, 24, 33);
    if (phase === 'test' || phase === 'falling') {
      rounded(14, 51, W - 28, 7, 3);
      ctx.fillStyle = '#253c3b99'; ctx.fill();
      rounded(14, 51, (W - 28) * clamp(testTime / 5.25, .004, 1), 7, 3);
      ctx.fillStyle = '#f5d378'; ctx.fill();
    } else if (phase === 'build' && W > 570) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#664e3ab9';
      ctx.font = '900 10px "Trebuchet MS",sans-serif';
      ctx.fillText('THE MIDDLE TAKES THE HIT ↓', W - 22, 32);
    }
    if (phase === 'build') {
      ctx.save();
      ctx.textAlign = 'center'; ctx.fillStyle = '#e6e1c5';
      ctx.font = `900 ${W < 520 ? 9 : 11}px "Trebuchet MS",sans-serif`;
      const y = clamp(D + 123, D + 110, H - 19);
      ctx.fillText(W < 460 ? 'TAP THE CIRCLES TO ADD TRUSSES' : 'ROUND JOINTS = TRUSSES  •  CLICK AGAIN TO REMOVE', (g.left + g.right) / 2, y);
      ctx.restore();
    }
  }
  function drawHoverTooltip() {
    if (phase !== 'build' || !hover) return;
    const isSpan = hover.type === 'span';
    const cx = isSpan ? g.left + (hover.index + .5) * g.step : g.left + (hover.index + 1) * g.step;
    const tw = W < 440 ? 162 : 198;
    const xx = clamp(cx - tw / 2, 8, W - tw - 8);
    const yy = g.deckY - 91;
    const danger = isSpan && unsafe(hover.index);
    rounded(xx, yy, tw, 41, 6);
    ctx.fillStyle = danger ? '#fff0dd' : '#fff9df'; ctx.fill();
    ctx.strokeStyle = danger ? '#bd6745' : '#536b58'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clamp(cx, xx + 9, xx + tw - 9) - 6, yy + 41);
    ctx.lineTo(clamp(cx, xx + 9, xx + tw - 9), yy + 47);
    ctx.lineTo(clamp(cx, xx + 9, xx + tw - 9) + 6, yy + 41);
    ctx.fillStyle = danger ? '#fff0dd' : '#fff9df'; ctx.fill();
    ctx.fillStyle = danger ? '#ae5b3c' : '#345949'; ctx.textAlign = 'left';
    ctx.font = `900 ${W < 440 ? 10 : 11}px "Trebuchet MS",sans-serif`;
    const top = isSpan ? `SPAN ${hover.index + 1}  ·  ${danger ? 'SHAKY!' : 'STURDY'}` :
      `JOINT ${hover.index + 1}  ·  ${braces[hover.index] ? 'REMOVE TRUSS' : 'ADD TRUSS'}`;
    ctx.fillText(top, xx + 9, yy + 17);
    ctx.font = `bold ${W < 440 ? 9 : 10}px "Trebuchet MS",sans-serif`;
    ctx.fillStyle = '#53695c';
    const bottom = isSpan ? `HOLDS ${strength(hover.index).toFixed(1)}  /  NEEDS ${needed(hover.index).toFixed(1)}`
      : `+1.6 TO SPANS ${hover.index + 1} AND ${hover.index + 2}`;
    ctx.fillText(bottom, xx + 9, yy + 32);
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / Math.min(.35, p.maxLife), 0, 1);
      ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') oval(0, 0, p.size, p.size * .7, p.color);
      else ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.kind === 'wood' ? p.size * .55 : p.size * .72);
      ctx.restore();
    }
  }
  function drawComic() {
    if (phase !== 'falling' && phase !== 'failed') return;
    const x = g.left + (failureIndex + .5) * g.step;
    const y = g.deckY - 69;
    ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `900 ${clamp(g.step * .26, 17, 28)}px Impact,"Arial Black",sans-serif`;
    ctx.strokeStyle = '#263b39'; ctx.lineWidth = 5;
    ctx.strokeText('KRR-ACK!', x, y);
    ctx.fillStyle = '#ffe47a'; ctx.fillText('KRR-ACK!', x, y);
    if (failureTime > .35) {
      ctx.font = '900 15px Impact,"Arial Black",sans-serif';
      ctx.strokeText('...WHOOPS.', x, Math.min(H - 22, g.deckY + 110));
      ctx.fillStyle = '#fff4d1'; ctx.fillText('...WHOOPS.', x, Math.min(H - 22, g.deckY + 110));
    }
    ctx.restore();
  }
  function draw() {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawSupports();
    for (let i = 0; i < 6; i++) drawSpan(i);
    let cx = cartX();
    let y = g.deckY + deckHeightAt(cx);
    let tilt = 0;
    if (phase === 'test') {
      tilt = clamp((deckHeightAt(cx + g.step * .16) - deckHeightAt(cx - g.step * .16)) * .022, -.17, .17);
      if (!reducedMotion) y += Math.sin(worldTime * 20) * 1.2;
    } else if (phase === 'falling' || phase === 'failed') {
      y += Math.min(failureTime, 1.3) ** 2 * 272;
      tilt = Math.min(failureTime * 2.1, 2.4);
    }
    if (phase !== 'failed' || y < H + 55) drawCart(cx, y, tilt, phase === 'falling');
    drawGoblin();
    drawParticles();
    drawComic();
    drawBoardLabels();
    drawHoverTooltip();
    // Inked edge of the postcard scene.
    ctx.strokeStyle = '#253d3a44'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }
  function frame(time) {
    const dt = Math.min(.04, Math.max(0, (time - (lastFrame || time)) / 1000));
    lastFrame = time;
    worldTime += dt;
    advance(dt);
    draw();
    window.requestAnimationFrame(frame);
  }

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  updateUI();
  window.requestAnimationFrame(frame);
})();
