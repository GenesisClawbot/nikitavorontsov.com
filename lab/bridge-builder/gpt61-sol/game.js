(function () {
  'use strict';
  const R = window.BridgeRules;
  const G = R.geometry;
  const W = G.width, H = G.height, SW = R.spanWidth;
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const screen = canvas.getContext('2d');
  let c = screen;
  const ui = {
    budgetLeft: $('budgetLeft'), budgetTotal: $('budgetTotal'), budgetFill: $('budgetFill'),
    budgetCard: $('budgetCard'), payload: $('payloadNumber'), contractLabel: $('contractLabel'),
    contractName: $('contractName'), cargo: $('cargoDescription'), hint: $('buildHint'),
    count: $('deckCount'), test: $('testButton'), testText: $('testButtonText'),
    testIcon: $('testButtonIcon'), clear: $('clearButton'), status: $('statusText'), dot: $('statusDot'),
    buildStep: $('buildStep'), testStep: $('testStep'), resultStep: $('resultStep'), attempt: $('attemptLabel'),
    verdict: $('verdict'), verdictTitle: $('verdictTitle'), verdictDetail: $('verdictDetail'),
    verdictQuip: $('verdictQuip'), verdictKicker: $('verdictKicker'), verdictStamp: $('verdictStamp'),
    sound: $('soundButton'), soundLabel: $('soundLabel'), soundWaves: $('soundWaves')
  };
  const toolButtons = Array.from(document.querySelectorAll('[data-tool]'));
  const spanButtons = Array.from(document.querySelectorAll('[data-span]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = '#28483e', PAPER = '#f3e8cc', GREEN = '#8eb391', GOLD = '#e7ae52', RED = '#b9573e';
  let level = 0, phase = 'build', spans = R.makeSpans(), selectedTool = 'wood', hoverBay = -1, attempt = 0;
  let clock = 0, lastTime = 0, audioContext = null, soundEnabled = false;
  let particles = [], floaters = [], bubble = ['I have a wrench.', 'This makes me qualified.'];
  let bubbleUntil = Infinity;
  let run = freshRun();

  function contract() { return R.contracts[level]; }
  function freshRun() {
    return { x: G.startX, y: G.deckY, angle: 0, elapsed: 0, loads: Array(G.bays).fill(0),
      damage: Array(G.bays).fill(0), broken: -1, failure: null, fallTime: 0,
      vx: 0, vy: 0, omega: 0, wet: false, loadKey: '0/0/0/0/0', soundTick: 0 };
  }
  function note(message) { if (ui.status.textContent !== message) ui.status.textContent = message; }
  function say(first, second, duration = 7) { bubble = [first, second].filter(Boolean); bubbleUntil = clock + duration; }
  function pad(number) { return String(number).padStart(2, '0'); }
  function bayCenter(index) { return G.left + (index + .5) * SW; }

  // All sounds are synthesized locally. The audio context is only created by a user gesture.
  function unlockAudio() {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext) audioContext = new Audio();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) { soundEnabled = false; updateSound(); }
  }
  function tone(frequency, duration = .1, type = 'triangle', volume = .045, delay = 0) {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const t = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(t); oscillator.stop(t + duration + .02);
  }
  function noise(duration = .15, volume = .035, pitch = 1500) {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const count = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, count, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const source = audioContext.createBufferSource(), gain = audioContext.createGain(), filter = audioContext.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = pitch;
    gain.gain.value = volume; source.connect(filter); filter.connect(gain); gain.connect(audioContext.destination);
    source.start();
  }
  function playBuild(tool) {
    if (tool === 'wood') { tone(180, .12, 'triangle', .07); noise(.08, .025, 950); }
    if (tool === 'iron') { tone(790, .23, 'triangle', .05); tone(1180, .16, 'sine', .025, .02); }
    if (tool === 'brace') { tone(350); tone(470, .13, 'triangle', .035, .065); }
    if (tool === 'erase') { tone(250, .1); tone(150, .12, 'triangle', .04, .07); }
  }
  function playFailure() {
    noise(.3, .10, 2500); tone(220, .2, 'sawtooth', .035); tone(140, .2, 'triangle', .065, .15); tone(85, .35, 'triangle', .08, .3);
  }
  function playSuccess() {
    [392, 494, 587, 784, 988].forEach((f, i) => tone(f, .23, 'triangle', .055, i * .105));
  }
  function updateSound() {
    ui.sound.setAttribute('aria-pressed', String(soundEnabled));
    ui.soundLabel.textContent = soundEnabled ? 'Sound on' : 'Sound off';
    ui.soundWaves.setAttribute('d', soundEnabled ? 'M17 8q5 4 0 8m3-11q8 7 0 14' : 'm17 9 5 6m0-6-5 6');
  }
  function toggleSound() { soundEnabled = !soundEnabled; unlockAudio(); updateSound(); if (soundEnabled) tone(520, .15); }

  function failureAdvice() {
    const f = run.failure;
    if (!f) return '';
    if (f.kind === 'gap') return `Span ${pad(f.index + 1)} needs a deck. Air is cheap, but does not support a cart.`;
    if (f.capacity + 4 >= contract().payload && !spans[f.index].braced) return `Span ${pad(f.index + 1)} held ${f.capacity}t, not ${contract().payload}t. A triangle adds 4t.`;
    if (contract().payload <= 8) return `Span ${pad(f.index + 1)} held ${f.capacity}t. Upgrade to iron: 8t, four bolts.`;
    return `Span ${pad(f.index + 1)} held ${f.capacity}t. Iron + a triangle holds 12t.`;
  }
  function updateUI() {
    const job = contract(), inspection = R.inspect(spans, job.payload), editable = phase === 'build';
    ui.contractLabel.textContent = `Delivery ${pad(level + 1)} / 03`;
    ui.contractName.textContent = job.name;
    ui.cargo.textContent = job.cargo;
    ui.budgetLeft.textContent = job.budget - inspection.cost;
    ui.budgetTotal.textContent = job.budget;
    ui.budgetFill.style.width = `${(job.budget - inspection.cost) / job.budget * 100}%`;
    ui.payload.textContent = job.payload;
    ui.count.textContent = `${G.bays - inspection.missing.length} / 5 DECKS`;
    ui.attempt.textContent = `ATTEMPT ${pad(attempt + (editable ? 1 : 0) || 1)}`;
    canvas.classList.toggle('running', !editable);
    toolButtons.forEach(button => {
      const selected = button.dataset.tool === selectedTool;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = !editable;
    });
    spanButtons.forEach((button, index) => {
      const span = spans[index], cap = R.capacity(span);
      button.querySelector('b').textContent = span.deck ? `${cap}t` : '—';
      button.classList.toggle('weak', !!span.deck && cap < job.payload);
      button.classList.toggle('safe', !!span.deck && cap >= job.payload);
      button.classList.toggle('hot', run.broken === index || (run.loads[index] > cap && cap > 0));
      button.classList.toggle('hovered', hoverBay === index && editable);
      button.disabled = !editable;
      button.setAttribute('aria-label', `Span ${index + 1}: ${span.deck ? R.materials[span.deck].name + (span.braced ? ' with a brace' : '') + ', holds ' + cap + ' tons' : 'empty'}. Use selected tool.`);
      button.title = `Span ${index + 1} · ${span.deck ? cap + 't capacity' : 'no deck'} · click to build`;
    });
    ui.hint.className = 'build-hint';
    if (editable) {
      if (inspection.missing.length === 5) ui.hint.textContent = job.hint;
      else if (inspection.missing.length) ui.hint.textContent = `${inspection.missing.length} ${inspection.missing.length === 1 ? 'deck' : 'decks'} missing. Braces add 4t; today’s cart weighs ${job.payload}t.`;
      else if (inspection.weak.length) {
        ui.hint.textContent = `${inspection.weak.length} ${inspection.weak.length === 1 ? 'span is' : 'spans are'} below ${job.payload}t. Add triangles or upgrade the decks.`;
        ui.hint.classList.add('bad');
      } else { ui.hint.textContent = `All five spans rated for ${job.payload}t. That’s the theory. Time for a test.`; ui.hint.classList.add('ready'); }
      ui.testText.textContent = 'SEND THE CART'; ui.testIcon.textContent = '→'; ui.clear.textContent = 'Clear blueprint';
    } else if (phase === 'testing' || phase === 'falling') {
      ui.hint.textContent = phase === 'falling' ? 'Gravity is conducting an unscheduled inspection.' : 'Watch the lit spans. The weight moves with the wheels. Overloaded decks crack.';
      ui.testText.textContent = phase === 'falling' ? 'CALCULATING CONSEQUENCES…' : 'CART IN MOTION…';
      ui.testIcon.textContent = '···'; ui.clear.textContent = 'Clear blueprint';
    } else if (phase === 'failure') {
      ui.hint.textContent = failureAdvice(); ui.hint.classList.add('bad');
      ui.testText.textContent = 'PATCH & RETRY'; ui.testIcon.textContent = '↻'; ui.clear.textContent = 'Start from scratch';
    } else {
      ui.hint.textContent = level === 2 ? 'Three deliveries. Zero casualties. One deeply unqualified engineer.' : 'Delivered under budget. A heavier cart is waiting. Naturally.';
      ui.hint.classList.add('ready');
      ui.testText.textContent = level < 2 ? 'NEXT DELIVERY' : 'ONE MORE ROUND'; ui.testIcon.textContent = level < 2 ? '→' : '↻'; ui.clear.textContent = 'Tinker with this bridge';
    }
    const moving = phase === 'testing' || phase === 'falling';
    ui.test.disabled = moving; ui.clear.disabled = moving;
    ui.buildStep.classList.toggle('active', editable);
    ui.testStep.classList.toggle('active', moving);
    ui.resultStep.classList.toggle('active', phase === 'failure' || phase === 'success');
    ui.dot.className = `status-dot ${phase}`;
    ui.verdict.hidden = phase !== 'success' && phase !== 'failure';
    ui.verdict.className = `verdict ${phase === 'failure' ? 'failure' : 'success'}`;
    if (phase === 'success') {
      ui.verdictKicker.textContent = level === 2 ? 'Employee of the minute' : 'Delivery complete';
      ui.verdictTitle.textContent = level === 2 ? 'GOBLIN GENIUS.' : 'IT HOLDS!';
      ui.verdictDetail.textContent = job.win;
      ui.verdictQuip.textContent = job.quip;
      ui.verdictStamp.textContent = level === 2 ? '3 for 3 · unlicensed' : 'Certified-ish';
    } else if (phase === 'failure') {
      const f = run.failure;
      ui.verdictKicker.textContent = 'Unscheduled water delivery';
      ui.verdictTitle.textContent = f.kind === 'gap' ? 'MIND THE GAP.' : 'OH, PLANK.';
      ui.verdictDetail.textContent = f.kind === 'gap' ? `Span ${pad(f.index + 1)} was missing. The cart noticed.` : `Span ${pad(f.index + 1)}: ${f.capacity}t capacity. ${job.payload}t of consequences.`;
      const quips = ['“The calculations were in goblin inches.”', '“That was the decorative load-bearing bit.”', '“Good news: the ravine is still working.”', '“We have invented the downward shortcut.”'];
      ui.verdictQuip.textContent = quips[(attempt - 1) % quips.length];
      ui.verdictStamp.textContent = 'Gravity: 1 · Bridge: 0';
    }
  }
  function syncHover(index) {
    if (hoverBay === index) return;
    hoverBay = index;
    spanButtons.forEach((button, i) => button.classList.toggle('hovered', i === index && phase === 'build'));
  }
  function chooseTool(tool) {
    if (phase !== 'build') return;
    selectedTool = tool; unlockAudio();
    const chatter = {
      wood: ['Cheap. Cheerful.', 'Extremely flammable.'],
      iron: ['Iron! For the goblin', 'with expensive taste.'],
      brace: ['Triangles. The only', 'honest polygon.'],
      erase: ['Undoing things is also', 'a form of engineering.']
    };
    say(...chatter[tool]); updateUI();
  }
  function applyTool(index, tool = selectedTool) {
    if (phase !== 'build') return;
    unlockAudio(); syncHover(index);
    const result = R.build(spans, index, tool, contract().budget);
    if (!result.ok) {
      if (result.reason === 'needsDeck') {
        note('A triangle needs something to cling to. Lay a deck on that span first.');
        say('Deck first.', 'Then triangular magic.'); pop('DECK FIRST!', bayCenter(index), G.deckY - 45, RED);
      } else if (result.reason === 'budget') {
        note(`You need ${result.need} more ${result.need === 1 ? 'bolt' : 'bolts'}. Replace iron with timber, remove a brace, or erase a span for a refund.`);
        say('The budget has spoken.', 'It said “no.”'); pop('OUT OF BOLTS', bayCenter(index), G.deckY - 45, RED);
        ui.budgetCard.classList.remove('nudge'); void ui.budgetCard.offsetWidth; ui.budgetCard.classList.add('nudge');
      }
      tone(115, .13, 'triangle', .055); return;
    }
    if (!result.changed) { note(tool === 'erase' ? 'Nothing here to unbuild. An excellent saving.' : 'That deck is already installed. Try a brace, a different deck, or another span.'); return; }
    const oldBrace = spans[index].braced;
    spans = result.next;
    playBuild(tool);
    const cap = R.capacity(spans[index]);
    if (tool === 'brace') {
      note(oldBrace ? `Brace removed from span ${pad(index + 1)}. One bolt refunded.` : `Span ${pad(index + 1)} now holds ${cap}t. Triangles: suspiciously effective.`);
      say(oldBrace ? 'Less triangle.' : 'A beautiful triangle.', oldBrace ? 'More budget.' : 'Almost professional.');
      pop(oldBrace ? '+1 BOLT' : '+4t!', bayCenter(index), G.deckY - 45, oldBrace ? INK : '#487453');
    } else if (tool === 'erase') {
      note(`Span ${pad(index + 1)} cleared. ${-result.delta} bolts refunded. The ravine remains.`);
      pop(`+${-result.delta} BOLTS`, bayCenter(index), G.deckY - 45, INK);
    } else {
      note(`${R.materials[tool].name} deck on span ${pad(index + 1)}. Capacity ${cap}t; cart ${contract().payload}t.${cap < contract().payload ? ' This one needs more support.' : ' Looks annoyingly sensible.'}`);
      pop(tool === 'wood' ? 'plonk.' : 'CLANG!', bayCenter(index), G.deckY - 45, INK);
    }
    for (let i = 0; i < 7; i++) particles.push({ kind: 'chip', x: bayCenter(index) + (Math.random() - .5) * 65, y: G.deckY + 4, vx: (Math.random() - .5) * 65, vy: -40 - Math.random() * 80, rotation: Math.random() * 6, vr: 3, life: .8, maxLife: .8, size: 3 + Math.random() * 3, color: tool === 'iron' ? '#849f93' : GOLD });
    updateUI();
  }
  function returnToBuild(clear = false) {
    phase = 'build'; if (clear) spans = R.makeSpans(); run = freshRun(); particles = []; floaters = [];
    say('Repairs are free.', 'My cousin knows a guy.');
    note(clear ? 'Blueprint cleared. Bolts refunded. Reputation not recoverable.' : 'Blueprint kept; damage patched for free. Change the nervous spans, then test again.');
    updateUI();
  }
  function beginContract(index) {
    level = index; attempt = 0; phase = 'build'; spans = R.makeSpans(); run = freshRun(); particles = []; floaters = []; hoverBay = -1;
    selectedTool = index === 0 ? 'wood' : 'iron';
    if (index === 0) { say('I have a wrench.', 'This makes me qualified.', Infinity); note('Lay five decks. Add support. Send the cart. Deny everything.'); }
    else if (index === 1) { say('Anvils. Marked fragile.', 'Clients are fascinating.', 12); note('New job, fresh bolts. Braced timber holds 7t, but these anvils weigh 8t.'); }
    else { say('The mayor’s golden ego.', 'He says it’s “life size.”', 12); note('Final job: an 11t statue. Iron plus a triangle holds 12t. There is probably a lesson here.'); }
    updateUI();
  }
  function startTest() {
    if (phase !== 'build') return;
    unlockAudio(); attempt++; phase = 'testing'; run = freshRun(); hoverBay = -1; floaters = [];
    say('Go, little lawsuit.', 'Go.');
    note(`${contract().payload} tons. Five spans. One very cheap insurance policy.`);
    tone(420, .18); tone(630, .2, 'triangle', .04, .14);
    updateUI();
  }
  function mainAction() {
    unlockAudio();
    if (phase === 'build') startTest();
    else if (phase === 'failure') returnToBuild();
    else if (phase === 'success') beginContract(level < 2 ? level + 1 : 0);
  }
  function fail(index, kind) {
    if (phase !== 'testing') return;
    const cap = R.capacity(spans[index]);
    phase = 'falling'; run.broken = index;
    run.failure = { index, kind, capacity: cap };
    run.fallTime = 0; run.vx = run.x < G.left + 25 ? 118 : run.x > G.right - 80 ? -56 : 58;
    run.vy = -32; run.omega = kind === 'gap' ? 1.65 : 2.4;
    note(kind === 'gap' ? `Span ${pad(index + 1)} was mostly imagination. Gravity prefers planks.` : `Span ${pad(index + 1)} snapped! ${contract().payload}t cart, ${cap}t capacity. Repairs are free. Pride is not.`);
    say('This is fine.', 'This is NOT fine.', 10);
    pop(kind === 'gap' ? 'NOPE!' : 'CRRRAACK!', bayCenter(index), G.deckY - 65, RED, 2.3);
    playFailure();
    if (kind !== 'gap') {
      for (let i = 0; i < 12; i++) particles.push({ kind: 'debris', x: bayCenter(index) + (Math.random() - .5) * SW, y: G.deckY + 10, vx: (Math.random() - .5) * 160, vy: -50 - Math.random() * 170, rotation: Math.random() * 6, vr: (Math.random() - .5) * 9, life: 4, maxLife: 4, size: 12 + Math.random() * 19, color: spans[index].deck === 'iron' ? '#9eada0' : '#c58e55' });
    }
    for (let i = 0; i < 6; i++) particles.push({ kind: contract().type === 'pickles' ? 'jar' : 'cargo', x: run.x + (Math.random() - .5) * 70, y: G.deckY - 80, vx: (Math.random() - .5) * 160, vy: -90 - Math.random() * 140, rotation: 0, vr: (Math.random() - .5) * 7, life: 4, maxLife: 4, size: 10, color: contract().type === 'statue' ? '#e4b85d' : '#78988a' });
    updateUI();
  }
  function win() {
    phase = 'success'; run.x = G.finishX; run.y = G.deckY; run.angle = 0;
    say('I knew it would work.', 'Please burn the notebook.', 20);
    note(level === 2 ? 'Three deliveries complete! You are now Engineer of the Minute. The minute is not renewable.' : 'Delivery complete! The client is impressed, which is medically worrying. Ready for a heavier cart?');
    playSuccess();
    const colors = ['#e8b35a', '#9eb996', '#e48755', '#ede6c9'];
    for (let i = 0; i < (reducedMotion ? 12 : 60); i++) particles.push({ kind: 'confetti', x: 910 + Math.random() * 110, y: 250, vx: (Math.random() - .5) * 250, vy: -90 - Math.random() * 230, rotation: Math.random() * 6, vr: (Math.random() - .5) * 8, life: 3.6, maxLife: 3.6, size: 3 + Math.random() * 4, color: colors[i % colors.length] });
    pop('DELIVERED!', 965, 195, '#466b4c', 2.8);
    updateUI();
  }
  function wheelSag(x) {
    const index = R.bayAt(x);
    if (index < 0 || !spans[index].deck || run.broken === index) return 0;
    const u = (x - G.left - index * SW) / SW;
    const cap = R.capacity(spans[index]);
    const sag = Math.min(14, run.loads[index] / cap * 7);
    return 4 * u * (1 - u) * sag;
  }
  function updateRun(dt) {
    if (phase === 'testing') {
      run.elapsed += dt; run.x += G.speed * dt;
      run.loads = R.loadsAt(run.x, contract().payload);
      for (let i = 0; i < G.bays; i++) {
        if (run.loads[i] && !spans[i].deck) { fail(i, 'gap'); return; }
        run.damage[i] = R.damageStep(run.damage[i], run.loads[i], R.capacity(spans[i]), dt);
        if (run.damage[i] >= 1) { fail(i, 'capacity'); return; }
      }
      const back = wheelSag(run.x - G.axleHalf), front = wheelSag(run.x + G.axleHalf);
      run.y = G.deckY + (back + front) / 2 + Math.sin(run.elapsed * 19) * .45;
      run.angle = Math.atan2(front - back, G.axleHalf * 2);
      const key = run.loads.join('/');
      if (key !== run.loadKey) {
        run.loadKey = key;
        let active = -1, hot = false;
        run.loads.forEach((load, i) => { if (load && (active === -1 || load > run.loads[active])) active = i; if (load > R.capacity(spans[i]) && load) hot = true; });
        if (hot) {
          const i = run.loads.findIndex((load, j) => load > R.capacity(spans[j]));
          note(`Span ${pad(i + 1)} is carrying ${run.loads[i]}t on ${R.capacity(spans[i])}t capacity. That noise is expensive.`);
          say('Creaking is just', 'wood applause. Right?'); noise(.12, .035, 1600);
        } else if (active !== -1) note(`Span ${pad(active + 1)}: ${run.loads[active]}t on ${R.capacity(spans[active])}t capacity. So far, suspiciously good.`);
        else if (run.x > G.right) note('Across the ravine! Now park the darn thing.');
        updateUI();
      }
      run.soundTick += dt;
      if (run.soundTick > .56) { run.soundTick = 0; tone(140 + Math.random() * 30, .055, 'triangle', .025); }
      if (run.x >= G.finishX) win();
    } else if (phase === 'falling') {
      run.elapsed += dt; run.fallTime += dt;
      if (!run.wet) {
        run.x += run.vx * dt; run.vy += 790 * dt; run.y += run.vy * dt; run.angle += run.omega * dt;
        if (run.y >= 600) {
          run.y = 600; run.wet = true; run.angle %= Math.PI * 2;
          for (let i = 0; i < 24; i++) particles.push({ kind: 'drop', x: run.x + (Math.random() - .5) * 90, y: 605, vx: (Math.random() - .5) * 180, vy: -130 - Math.random() * 200, rotation: 0, vr: 0, life: 1.1, maxLife: 1.1, size: 3 + Math.random() * 4, color: '#a9d0b6' });
          noise(.35, .09, 750); pop('splösh.', run.x, 543, '#c9dac2', 1.5);
        }
      }
      if (run.fallTime > 1.5) { phase = 'failure'; updateUI(); }
    }
  }
  function pop(message, x, y, color, life = 1) { floaters.push({ message, x, y, color, life, maxLife: life }); }
  function updateParticles(dt) {
    particles.forEach(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.vr * dt;
      p.vy += (p.kind === 'confetti' ? 165 : 580) * dt;
      if (p.kind === 'confetti') p.vx *= 1 - dt * .65;
      if (p.y > 618 && p.kind !== 'confetti') { p.y = 618; p.vy *= -.12; p.vx *= .92; }
    });
    particles = particles.filter(p => p.life > 0);
    floaters.forEach(p => { p.life -= dt; p.y -= dt * 20; });
    floaters = floaters.filter(p => p.life > 0);
  }

  // Illustration helpers: entirely local vector artwork, including the cargo and the goblin.
  function roundedPath(x, y, w, h, r = 0) {
    r = Math.min(r, w / 2, h / 2); c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function paint(fill, stroke = null, width = 2) { if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
  function box(x, y, w, h, r, fill, stroke = null, width = 2) { roundedPath(x, y, w, h, r); paint(fill, stroke, width); }
  function poly(points, fill, stroke = null, width = 2) {
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); paint(fill, stroke, width);
  }
  function line(points, color = INK, width = 2, dash = []) {
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
  }
  function oval(x, y, rx, ry, fill, stroke = null, width = 2) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); paint(fill, stroke, width); }
  function circle(x, y, radius, fill, stroke = null, width = 2) { oval(x, y, radius, radius, fill, stroke, width); }
  function text(message, x, y, size = 12, color = INK, align = 'left', weight = 'bold', family = "'Trebuchet MS', sans-serif") {
    c.font = `${weight} ${size}px ${family}`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = color; c.fillText(message, x, y);
  }
  let seed = 14789;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function shrub(x, y, size, color = '#73916c') {
    line([[x, y + 5], [x, y - size * .6]], '#52745c', 3);
    oval(x - size * .34, y - size * .25, size * .5, size * .32, color);
    oval(x + size * .3, y - size * .4, size * .42, size * .4, color);
    oval(x, y - size * .62, size * .37, size * .42, color);
    line([[x - size * .35, y - 1], [x + size * .4, y - size * .4]], '#53775a', 1.2);
  }
  function cloud(x, y, scale) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.beginPath(); c.moveTo(-60, 10); c.bezierCurveTo(-85, 5, -70, -15, -46, -15);
    c.bezierCurveTo(-45, -45, 1, -48, 12, -20); c.bezierCurveTo(45, -40, 76, -14, 65, 7);
    c.bezierCurveTo(90, 22, 60, 28, 30, 24); c.lineTo(-60, 24); c.closePath(); paint('#f4edd8');
    c.restore();
  }
  function cliff(points, right) {
    const gradient = c.createLinearGradient(0, 334, 0, 640); gradient.addColorStop(0, '#8ba483'); gradient.addColorStop(.45, '#64896e'); gradient.addColorStop(1, '#385e53');
    poly(points, gradient, '#456b54', 3);
    c.save(); c.clip();
    for (let i = 0; i < 19; i++) {
      const x = right ? 840 + random() * 310 : random() * 295;
      const y = 345 + random() * 300, size = 30 + random() * 90;
      poly([[x, y], [x + size, y - 7], [x + size * 1.3, y + size * .45], [x + size * .3, y + size * .64], [x - 17, y + 12]], i % 3 ? '#a8b49118' : '#254a4120');
      line([[x + 7, y + 4], [x + size * .8, y], [x + size, y + 14]], '#d4d4a943', 1);
    }
    for (let i = 0; i < 38; i++) {
      const x = right ? 836 + random() * 300 : random() * 300, y = 356 + random() * 275;
      line([[x, y], [x + 13 + random() * 30, y - 3]], '#244d403b', 1.1);
    }
    c.restore();
  }
  function paintBackground() {
    c.lineJoin = 'round'; c.lineCap = 'round';
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#e1e6cb'); sky.addColorStop(.55, '#b5c9aa'); sky.addColorStop(1, '#688d77');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    circle(900, 102, 53, '#efcf87');
    c.save(); c.setLineDash([2, 9]); circle(900, 102, 66, null, '#ebd497', 1.5); c.setLineDash([]); c.restore();
    c.globalAlpha = .8; cloud(850, 127, .9); cloud(513, 85, .72); cloud(686, 190, .5); c.globalAlpha = 1;
    poly([[0, 270], [63, 223], [134, 259], [231, 182], [341, 282], [425, 237], [563, 297], [694, 214], [793, 270], [882, 207], [1000, 265], [1120, 213], [1120, 396], [0, 396]], '#b2c3a4');
    poly([[0, 307], [127, 277], [230, 303], [306, 265], [418, 316], [548, 286], [681, 308], [773, 261], [909, 308], [1067, 276], [1120, 309], [1120, 485], [0, 485]], '#94b296');
    // Tiny, distant pines.
    for (let i = 0; i < 23; i++) {
      const x = i * 51 + 13, y = 304 + Math.sin(i * 2) * 12, h = 23 + random() * 29;
      poly([[x - 13, y], [x, y - h], [x + 13, y]], '#789b8157');
    }
    const mist = c.createLinearGradient(0, 355, 0, 610); mist.addColorStop(0, '#bdd1b065'); mist.addColorStop(1, '#355f53');
    c.fillStyle = mist; c.fillRect(250, 351, 635, 289);
    const falls = c.createLinearGradient(0, 367, 0, 620); falls.addColorStop(0, '#d5e2bf0a'); falls.addColorStop(.7, '#b9d3b632'); falls.addColorStop(1, '#a6c9b470');
    poly([[570, 365], [591, 365], [605, 620], [561, 620]], falls);
    line([[580, 382], [579, 535], [588, 597]], '#e0ead326', 3);
    cliff([[0, 326], [263, 326], [281, 365], [264, 412], [291, 458], [270, 518], [302, 580], [279, 640], [0, 640]], false);
    cliff([[853, 326], [1120, 326], [1120, 640], [830, 640], [859, 573], [837, 514], [874, 450], [848, 397]], true);
    // Mossy bank edges and little dirt roads.
    poly([[0, 309], [54, 311], [94, 306], [167, 314], [230, 314], [260, 319], [280, 334], [0, 334]], '#84a173', '#496f51', 2);
    poly([[840, 334], [855, 318], [929, 313], [982, 310], [1035, 315], [1120, 306], [1120, 334]], '#84a173', '#496f51', 2);
    box(0, 327, 278, 9, 2, '#cebd91'); box(842, 327, 278, 9, 2, '#cebd91');
    line([[0, 336], [278, 336]], '#3c604a', 3); line([[842, 336], [1120, 336]], '#3c604a', 3);
    for (let i = 0; i < 38; i++) {
      const right = i % 2, x = right ? 857 + random() * 258 : random() * 250;
      const y = 315 + random() * 9;
      line([[x - 3, y], [x, y - 6], [x + 3, y - 1]], '#527a55', 1.1);
      if (i % 6 === 0) circle(x, y - 7, 2, '#eed4a1');
    }
    shrub(22, 317, 34); shrub(260, 325, 17, '#9caf74'); shrub(865, 323, 20, '#9caf74'); shrub(1099, 318, 33);
    // The mushroom-shaped receiving office.
    oval(1007, 326, 81, 8, '#486b4930');
    box(961, 264, 88, 62, 7, '#dab987', INK, 2.5);
    box(982, 283, 28, 43, 12, '#587866', INK, 2);
    circle(1004, 308, 2, '#e6c577');
    box(1017, 283, 20, 18, 3, '#abc7a0', INK, 2); line([[1027, 283], [1027, 301]], INK, 1.5);
    c.beginPath(); c.moveTo(938, 270); c.bezierCurveTo(957, 213, 1037, 207, 1069, 269); c.bezierCurveTo(1030, 281, 971, 281, 938, 270); c.closePath(); paint('#ce8250', INK, 3);
    oval(975, 248, 12, 5, '#eeb880'); oval(1018, 239, 9, 5, '#eeb880'); oval(1043, 258, 10, 4, '#eeb880');
    box(953, 271, 105, 17, 2, '#f0d59f', INK, 1.8); text('DELIVERIES', 1006, 283, 10, INK, 'center');
    // Bank signage.
    c.save(); c.translate(54, 393); c.rotate(-.08); line([[0, 0], [0, 64]], '#455d42', 7);
    box(-44, -18, 88, 43, 3, '#dfb773', '#6d734b', 2); text('NO REFUNDS', 0, -1, 9, INK, 'center'); text('FROM GRAVITY', 0, 13, 9, INK, 'center'); circle(-36, -10, 2, '#707956'); circle(35, 17, 2, '#707956'); c.restore();
    c.save(); c.translate(981, 423); c.rotate(.05); line([[0, 0], [0, 77]], '#455d42', 7);
    box(-64, -23, 128, 47, 3, '#aab68b', '#49674b', 2); text('THE OTHER SIDE', 0, -5, 10, INK, 'center'); text('POPULATION: 1', 0, 11, 8, '#506d51', 'center'); c.restore();
    line([[221, 430], [221, 568]], '#c4ce9f70', 1.5, [3, 7]);
    line([[215, 430], [228, 430]], '#c4ce9f70', 1.5); line([[215, 568], [228, 568]], '#c4ce9f70', 1.5);
    text('DEPTH: NOPE', 207, 585, 8, '#c3cea6', 'right');
    // Water behind the foreground ripples.
    const water = c.createLinearGradient(0, 594, 0, H); water.addColorStop(0, '#45796b'); water.addColorStop(1, '#305e54');
    box(0, 604, W, 36, 0, water);
    oval(579, 608, 55, 6, '#9abd9c40');
    // A few flecks make the scene feel printed, without an external texture.
    for (let i = 0; i < 1100; i++) {
      const x = random() * W, y = random() * H;
      circle(x, y, .45 + random() * .4, y < 330 ? '#3d644918' : '#e4ddb917');
    }
    text('WORKSITE 001 · NO PERMIT', 31, 34, 9, '#678267');
    text('Pickle Gulch', 30, 79, 36, INK, 'left', 'bold', 'Georgia, serif');
    text('An inconvenient amount of ravine.', 32, 101, 12, '#6d856a', 'left', 'normal');
    text('DEPARTURES', 103, 359, 8, '#526d4f'); text('ARRIVALS', 1015, 359, 8, '#526d4f', 'center');
  }
  const background = document.createElement('canvas');
  background.width = W * 2; background.height = H * 2;
  c = background.getContext('2d'); c.scale(2, 2); paintBackground(); c = screen;

  function drawBrace(index, sag = 0, alpha = 1, warning = false) {
    const x = G.left + index * SW, middle = x + SW / 2, y = G.deckY + 13, bottom = y + 78 + sag * .2;
    c.save(); c.globalAlpha = alpha;
    poly([[x + 3, y], [middle, bottom], [x + SW - 3, y]], warning ? '#b9573e15' : '#e1b75914');
    line([[x + 3, y], [middle, bottom], [x + SW - 3, y]], warning ? RED : INK, 9);
    line([[x + 3, y], [middle, bottom], [x + SW - 3, y]], warning ? '#db9872' : '#d2a653', 5);
    line([[x + 7, y + 3], [middle, bottom - 5], [x + SW - 7, y + 3]], '#f0cf8170', 1.4);
    [[x + 3, y], [middle, bottom], [x + SW - 3, y]].forEach(p => circle(p[0], p[1], 4, '#d9bf7a', INK, 1.8));
    c.restore();
  }
  function deckPath(x, width, sag) {
    c.beginPath(); c.moveTo(x, G.deckY); c.quadraticCurveTo(x + width / 2, G.deckY + sag * 2, x + width, G.deckY);
    c.lineTo(x + width, G.deckY + 14); c.quadraticCurveTo(x + width / 2, G.deckY + sag * 2 + 14, x, G.deckY + 14); c.closePath();
  }
  function drawDeck(index, material, sag = 0, alpha = 1, danger = false, broken = false) {
    const x = G.left + index * SW, color = danger ? '#c48358' : material === 'wood' ? '#c4935f' : '#93afa0';
    c.save(); c.globalAlpha = alpha;
    if (broken) {
      poly([[x, G.deckY], [x + 23, G.deckY + 4], [x + 15, G.deckY + 10], [x + 26, G.deckY + 18], [x, G.deckY + 14]], color, INK, 2);
      poly([[x + SW, G.deckY], [x + SW - 22, G.deckY + 4], [x + SW - 17, G.deckY + 10], [x + SW - 25, G.deckY + 18], [x + SW, G.deckY + 14]], color, INK, 2);
      c.restore(); return;
    }
    deckPath(x, SW, sag); paint(color, danger ? RED : INK, 2.5);
    const profile = u => G.deckY + 4 * u * (1 - u) * sag;
    c.beginPath(); c.moveTo(x + 2, G.deckY + 2); c.quadraticCurveTo(x + SW / 2, G.deckY + 2 + sag * 2, x + SW - 2, G.deckY + 2); c.strokeStyle = material === 'wood' ? '#e3bb81' : '#c8d0b4'; c.lineWidth = 2; c.stroke();
    if (material === 'wood') {
      [.23, .48, .75].forEach(u => line([[x + SW * u, profile(u)], [x + SW * u + 1, profile(u) + 14]], '#725b3f', 1.2));
      for (let j = 0; j < 4; j++) {
        const u = (j + .5) / 4; line([[x + j * SW / 4 + 4, profile(u) + 8], [x + (j + 1) * SW / 4 - 6, profile(u) + 7]], '#8d6f4710', 1);
      }
      oval(x + SW * .37, profile(.37) + 8, 4, 1.5, null, '#8f6c42', 1);
    } else {
      [.18, .82].forEach(u => { circle(x + SW * u, profile(u) + 8, 3, '#c9ceb0', INK, 1); });
      line([[x + 35, profile(.3) + 7], [x + 74, profile(.7) + 7]], '#536f5e', 2);
    }
    if (danger || run.damage[index] > .08) {
      const m = x + SW * .53, yy = profile(.53);
      line([[m - 5, yy], [m + 2, yy + 4], [m - 3, yy + 9], [m + 5, yy + 14]], '#734532', 2.2);
    }
    c.restore();
  }
  function drawBridge() {
    const job = contract(), editable = phase === 'build';
    if (editable && hoverBay >= 0) box(G.left + hoverBay * SW + 2, G.deckY - 54, SW - 4, 195, 8, '#f2e7bb30', '#e2d1a180', 1.4);
    for (let i = 0; i < G.bays - 1; i++) {
      if (spans[i].braced && spans[i + 1].braced && run.broken !== i && run.broken !== i + 1) {
        const y = G.deckY + 91;
        line([[bayCenter(i), y], [bayCenter(i + 1), y]], INK, 7); line([[bayCenter(i), y], [bayCenter(i + 1), y]], '#c39b51', 3);
      }
    }
    spans.forEach((span, index) => {
      const cap = R.capacity(span), sag = cap ? Math.min(14, run.loads[index] / cap * 7) : 0;
      if (span.braced && run.broken !== index) drawBrace(index, sag);
      else if (span.braced && run.broken === index) {
        line([[G.left + index * SW + 3, G.deckY + 13], [bayCenter(index) - 20, G.deckY + 114]], INK, 6);
        line([[G.left + index * SW + 3, G.deckY + 13], [bayCenter(index) - 20, G.deckY + 114]], '#c39b51', 3);
      }
    });
    spans.forEach((span, index) => {
      const x = G.left + index * SW, middle = bayCenter(index), cap = R.capacity(span);
      const overloaded = run.loads[index] > cap && cap > 0;
      const broken = run.broken === index;
      const sag = cap ? Math.min(14, run.loads[index] / cap * 7) : 0;
      if (span.deck) drawDeck(index, span.deck, sag, 1, overloaded, broken);
      else {
        c.save(); c.setLineDash([5, 5]); box(x + 3, G.deckY, SW - 6, 15, 2, '#e6e3bb14', broken ? '#dbaa7c' : '#e0e1bba8', 1.5); c.setLineDash([]); c.restore();
        line([[middle - 5, G.deckY + 7], [middle + 5, G.deckY + 7]], '#e5e4bc', 1.5);
        line([[middle, G.deckY + 2], [middle, G.deckY + 12]], '#e5e4bc', 1.5);
      }
      circle(middle, G.deckY - 23, 11, broken ? RED : '#ebdfb8', broken ? '#873f32' : '#809074', 1.3);
      text(broken ? '!' : pad(index + 1), middle, G.deckY - 19, 9, broken ? PAPER : '#5a765b', 'center');
      const fill = broken ? '#d9a47b' : !span.deck ? '#99b1975c' : cap >= job.payload ? '#d2dfb6' : '#e7c68d';
      box(middle - 34, G.deckY + 111, 68, 25, 5, fill, broken ? '#a76044' : span.deck ? '#78956c' : '#a2b79655', 1.2);
      text(broken ? 'OOPS' : !span.deck ? 'AIR' : `${cap}t`, middle + (span.braced && !broken ? -6 : 0), G.deckY + 128, 11, broken ? '#7e4b35' : !span.deck ? '#dce4c3' : cap >= job.payload ? '#446b4c' : '#956637', 'center');
      if (span.braced && !broken) poly([[middle + 16, G.deckY + 118], [middle + 23, G.deckY + 128], [middle + 29, G.deckY + 118]], null, '#57764e', 1.4);
      if (phase === 'testing' && run.loads[index]) {
        box(middle - 34, G.deckY - 71, 68, 24, 5, overloaded ? '#b9573e' : '#3e6851', null);
        text(`${run.loads[index]}t ↓`, middle, G.deckY - 54, 12, PAPER, 'center');
        if (overloaded) {
          c.save(); c.globalAlpha = .3 + Math.sin(clock * 22) * .2; box(x + 1, G.deckY - 3, SW - 2, 23, 3, '#e46d4640', '#bc6348', 2); c.restore();
        }
      }
    });
    [G.left, G.right].forEach(x => { box(x - 7, G.deckY - 8, 14, 29, 4, '#7d9988', INK, 2); circle(x, G.deckY + 6, 4, '#ead29a', INK, 1.3); });
    if (editable && hoverBay >= 0) drawPreview();
    if (editable && spans.every(span => !span.deck) && hoverBay === -1) {
      text('CLICK A SPAN TO START', 560, 266, 11, '#658067', 'center');
      line([[560, 274], [560, 292]], '#658067', 1.5); line([[555, 287], [560, 292], [565, 287]], '#658067', 1.5);
    }
  }
  function drawPreview() {
    const index = hoverBay, span = spans[index], middle = bayCenter(index), result = R.build(spans, index, selectedTool, contract().budget);
    let message, bad = !result.ok;
    if (selectedTool === 'wood' || selectedTool === 'iron') {
      drawDeck(index, selectedTool, 0, .55);
      const delta = result.ok ? result.delta : R.materials[selectedTool].cost - (span.deck ? R.materials[span.deck].cost : 0);
      message = `${selectedTool === 'wood' ? 'TIMBER' : 'IRON'} · ${delta < 0 ? 'REFUND ' + -delta : delta + ' BOLTS'}`;
    } else if (selectedTool === 'brace') {
      if (span.deck) drawBrace(index, 0, .6, span.braced);
      message = span.braced ? 'REMOVE · REFUND 1' : 'BRACE · 1 BOLT';
    } else {
      box(G.left + index * SW + 4, G.deckY - 3, SW - 8, 107, 4, '#b9573e15', '#ad614a', 1.7);
      const refund = span.deck ? R.materials[span.deck].cost + (span.braced ? 1 : 0) : 0;
      message = `ERASE · REFUND ${refund}`;
    }
    if (result.reason === 'needsDeck') message = 'LAY A DECK FIRST';
    if (result.reason === 'budget') message = `NEED ${result.need} MORE BOLTS`;
    const x = Math.max(260, Math.min(780, middle - 78));
    box(x, G.deckY - 90, 156, 27, 5, bad ? '#af6448' : '#f0e4bd', bad ? '#8c4935' : '#87966e', 1.5);
    text(message, x + 78, G.deckY - 72, 9, bad ? PAPER : '#3e654c', 'center');
  }

  function drawGoblin(x, ground, scale, pose) {
    c.save(); c.translate(x, ground + (pose === 'success' && !reducedMotion ? -Math.abs(Math.sin(clock * 7)) * 4 : 0)); c.scale(scale, scale);
    const raised = pose === 'failure' || pose === 'falling' || pose === 'success';
    oval(0, 0, 31, 5, '#31563e25');
    // Arms behind the body.
    const leftHand = raised ? [-34, -95] : [-33, -52], rightHand = raised ? [34, -98] : [32, -66];
    line([[-16, -53], [-29, raised ? -76 : -43], leftHand], INK, 12);
    line([[-16, -53], [-29, raised ? -76 : -43], leftHand], '#d7a55e', 7);
    line([[17, -53], [29, raised ? -79 : -44], rightHand], INK, 12);
    line([[17, -53], [29, raised ? -79 : -44], rightHand], '#d7a55e', 7);
    circle(leftHand[0], leftHand[1], 7, GREEN, INK, 2); circle(rightHand[0], rightHand[1], 7, GREEN, INK, 2);
    poly([[-19, -34], [-17, -9], [-4, -9], [0, -29], [5, -9], [18, -9], [19, -36]], '#486c55', INK, 2.3);
    box(-22, -10, 20, 10, 4, '#3b5040', INK, 2); box(3, -10, 21, 10, 4, '#3b5040', INK, 2);
    box(-20, -60, 40, 32, 10, '#daa955', INK, 2.3);
    line([[-12, -60], [-10, -30]], '#55745c', 6); line([[12, -60], [10, -30]], '#55745c', 6);
    box(-13, -44, 26, 16, 3, '#55745c', INK, 1.5); circle(-9, -49, 2, '#ead59e'); circle(9, -49, 2, '#ead59e');
    poly([[-21, -95], [-42, -103], [-35, -81], [-19, -76]], GREEN, INK, 2.3);
    poly([[21, -95], [42, -103], [35, -81], [19, -76]], GREEN, INK, 2.3);
    line([[-35, -96], [-29, -85]], '#6c946c', 2); line([[35, -96], [29, -85]], '#6c946c', 2);
    box(-23, -105, 46, 42, 17, GREEN, INK, 2.5);
    oval(-16, -76, 6, 4, '#abbd86'); oval(16, -76, 6, 4, '#abbd86');
    box(-20, -96, 18, 13, 4, '#e9e3bd', INK, 2.8); box(3, -96, 18, 13, 4, '#e9e3bd', INK, 2.8);
    line([[-2, -90], [3, -90]], INK, 2);
    const blink = !reducedMotion && clock % 6.8 < .1;
    if (blink) { line([[-15, -89], [-7, -89]], INK, 2); line([[7, -89], [15, -89]], INK, 2); }
    else { circle(-9, -89, 2.8, INK); circle(12, -89, 2.8, INK); }
    line([[-17, -92], [-14, -94]], '#fff8da', 1.4); line([[6, -92], [9, -94]], '#fff8da', 1.4);
    poly([[-3, -84], [3, -88], [14, -77], [1, -75]], '#a2bc87', INK, 1.5);
    if (pose === 'failure' || pose === 'falling') oval(0, -69, 5, 6, INK);
    else { c.beginPath(); c.moveTo(-9, -69); c.quadraticCurveTo(0, pose === 'success' ? -60 : -64, 10, -70); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); poly([[-5, -68], [-2, -61], [1, -68]], PAPER); }
    c.beginPath(); c.moveTo(-26, -103); c.quadraticCurveTo(-26, -125, 0, -126); c.quadraticCurveTo(24, -125, 27, -103); c.closePath(); paint('#d88446', INK, 2.5);
    line([[0, -123], [0, -108]], '#8c613c', 2.5); line([[-17, -113], [-13, -118]], '#f0b56e', 2);
    box(-29, -105, 58, 8, 3, '#e1a955', INK, 2.3);
    // A very small wrench.
    const wx = rightHand[0], wy = rightHand[1];
    line([[wx, wy + 7], [wx + 6, wy - 11]], INK, 6); line([[wx, wy + 7], [wx + 6, wy - 11]], '#a6b4a0', 3);
    poly([[wx + 1, wy - 10], [wx + 2, wy - 18], [wx + 7, wy - 20], [wx + 6, wy - 13], [wx + 11, wy - 13], [wx + 12, wy - 20], [wx + 16, wy - 15], [wx + 12, wy - 8]], '#a6b4a0', INK, 1.5);
    if (!raised) {
      c.save(); c.translate(leftHand[0] - 5, leftHand[1] + 3); c.rotate(-.2);
      box(-20, -12, 35, 25, 2, '#d7e0bd', INK, 1.5);
      poly([[-14, -5], [-3, 8], [9, -5]], null, '#6c947e', 1.2); line([[-14, -5], [9, -5]], '#6c947e', 1.2); c.restore();
    }
    c.restore();
  }
  function drawBubble() {
    if (clock > bubbleUntil) return;
    c.save();
    box(37, 144, 215, 62, 10, '#f4edda', '#849776', 1.8);
    poly([[190, 205], [211, 222], [209, 205]], '#f4edda');
    line([[190, 206], [211, 222], [209, 206]], '#849776', 1.8);
    bubble.forEach((message, i) => text(message, 54, 169 + i * 17, 12, '#516d50', 'left', i === 0 ? 'bold' : 'normal'));
    c.restore();
  }
  function drawReceiver() {
    const x = 904, y = 333 + (phase === 'success' && !reducedMotion ? Math.sin(clock * 7) * 2 : 0);
    c.save(); c.translate(x, y);
    oval(0, 0, 19, 4, '#345c4425');
    line([[-9, -5], [-9, -18]], INK, 7); line([[9, -5], [9, -18]], INK, 7);
    box(-16, -44, 32, 29, 7, '#a17653', INK, 2);
    line([[-14, -37], [-23, phase === 'success' ? -60 : -27]], '#688f67', 6); line([[14, -37], [22, phase === 'success' ? -61 : -28]], '#688f67', 6);
    oval(0, -52, 24, 17, '#8db58c', INK, 2);
    [-13, 13].forEach(v => { circle(v, -63, 10, '#8db58c', INK, 1.7); circle(v, -63, 6, '#edebc9'); circle(v - 2, -63, 2.3, INK); });
    c.beginPath(); c.moveTo(-12, -49); c.quadraticCurveTo(0, -41, 12, -49); c.strokeStyle = INK; c.lineWidth = 1.7; c.stroke();
    box(-20, -76, 40, 7, 2, '#6a8764', INK, 1.8); box(-11, -86, 25, 12, 4, '#6a8764', INK, 1.8);
    line([[0, -39], [0, -22]], '#d5c38c', 1); circle(4, -30, 1.5, '#dbca91');
    c.restore();
  }
  function drawJar(x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    box(-11, -28, 22, 27, 5, '#b3c99a', INK, 1.7);
    box(-8, -23, 16, 17, 3, '#89a969');
    line([[-4, -19], [-2, -9]], '#5e844d', 4); line([[4, -20], [5, -10]], '#5e844d', 3.5);
    line([[-7, -24], [-7, -17]], '#e9e9c6', 1.5);
    box(-12, -31, 24, 5, 2, '#dfa05c', INK, 1.5); c.restore();
  }
  function drawAnvil(x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    poly([[-24, -29], [16, -29], [28, -35], [35, -34], [26, -23], [13, -19], [9, -5], [20, -3], [20, 2], [-18, 2], [-18, -3], [-7, -6], [-11, -20], [-24, -21]], '#6c9182', INK, 2);
    line([[-22, -27], [15, -27]], '#b2c6a5', 2); c.restore();
  }
  function drawStatue() {
    box(-29, -89, 58, 17, 3, '#c99b45', INK, 2);
    poly([[-27, -92], [-20, -108], [-9, -113], [9, -113], [22, -107], [28, -92]], '#dcb354', INK, 2);
    poly([[-17, -133], [-35, -147], [-25, -123], [-13, -122]], '#e9c569', INK, 2);
    poly([[17, -133], [35, -147], [25, -123], [13, -122]], '#e9c569', INK, 2);
    oval(0, -132, 21, 22, '#e9c569', INK, 2);
    poly([[-19, -147], [-21, -163], [-9, -155], [0, -169], [9, -155], [21, -163], [18, -147]], '#dbac4d', INK, 2);
    circle(-8, -134, 2.5, '#916938'); circle(8, -134, 2.5, '#916938');
    line([[-7, -120], [8, -120]], '#916938', 2); poly([[-3, -131], [7, -124], [-3, -124]], '#c99b45', '#916938', 1);
    line([[-16, -140], [-13, -144]], '#fae4a0', 2); text('ME', 0, -78, 9, '#8f692e', 'center');
  }
  function drawCart() {
    const bob = phase === 'failure' ? Math.sin(clock * 2.5) * 1.3 : 0;
    if (phase === 'build') oval(run.x, G.deckY + 1, 72, 7, '#3f63352b');
    c.save(); c.translate(run.x, run.y + bob); c.rotate(run.angle);
    line([[-73, -34], [-50, -27], [63, -27], [74, -33]], INK, 5);
    // Cargo is drawn behind the front panel.
    if (contract().type === 'pickles') {
      box(-49, -86, 63, 29, 2, '#a78951', INK, 2);
      drawJar(-37, -82, 1.05); drawJar(-10, -81, 1); drawJar(18, -69, 1.05);
      line([[-45, -87], [11, -87]], '#d9c18b', 2);
    } else if (contract().type === 'anvils') {
      drawAnvil(-25, -75, 1.07); drawAnvil(20, -78, .8);
      drawAnvil(-6, -105, .78);
    } else drawStatue();
    // The cart's unpaid intern, peeping over the side.
    poly([[35, -84], [26, -91], [29, -78]], GREEN, INK, 1.3);
    oval(43, -83, 13, 12, GREEN, INK, 1.5); circle(47, -84, 2, INK);
    box(29, -97, 28, 7, 3, '#dfa64f', INK, 1.5); line([[48, -75], [54, -72]], INK, 1.4);
    box(-63, -68, 126, 40, 5, '#c9985b', INK, 3);
    line([[-62, -57], [61, -57]], '#8c6d43', 1.4); line([[-62, -42], [61, -42]], '#8c6d43', 1.4);
    box(-59, -67, 10, 39, 2, '#8ca38c', INK, 1.5); box(49, -67, 10, 39, 2, '#8ca38c', INK, 1.5);
    [-55, 54].forEach(x => { circle(x, -61, 2, '#dfe0b9', INK, .8); circle(x, -34, 2, '#dfe0b9', INK, .8); });
    c.save(); c.translate(-2, -48); c.rotate(-.04);
    box(-33, -11, 66, 22, 2, '#ecd7a4', '#8e754c', 1);
    text(contract().type === 'pickles' ? 'NOT GLASS' : contract().type === 'anvils' ? 'FRAGILE' : 'VERY HUMBLE', 0, -1, 8, '#675b3c', 'center');
    text(`${contract().payload} TONNES`, 0, 8, 7, '#857450', 'center'); c.restore();
    line([[-52, -25], [51, -25]], INK, 5);
    [-G.axleHalf, G.axleHalf].forEach(x => {
      circle(x, -13, 15, '#4a5d43', INK, 2.5); circle(x, -13, 11, '#c5b580', '#718166', 1.5);
      c.save(); c.translate(x, -13); c.rotate((run.x - G.startX) / 15);
      for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; line([[0, 0], [Math.cos(a) * 10, Math.sin(a) * 10]], '#5d6f51', 2); }
      circle(0, 0, 3, '#e6cea1', INK, 1); c.restore();
    });
    c.restore();
  }
  function drawAmbient() {
    const t = reducedMotion ? 0 : clock;
    // Two slow birds above the gulch.
    for (let i = 0; i < 2; i++) {
      const x = 658 + i * 41 + Math.sin(t * .3 + i) * 20, y = 123 + i * 16 + Math.sin(t * .6 + i) * 3;
      c.beginPath(); c.moveTo(x - 7, y - 2); c.quadraticCurveTo(x - 2, y - 5, x, y); c.quadraticCurveTo(x + 3, y - 5, x + 8, y - 2); c.strokeStyle = '#739375'; c.lineWidth = 1.5; c.stroke();
    }
    // A pennant by the receiving office.
    line([[1081, 238], [1081, 173]], '#627e58', 3);
    poly([[1082, 176], [1113, 184 + Math.sin(t * 2.2) * 3], [1082, 194]], '#dca55c', '#8c7f4f', 1.2);
    // Tiny dust motes over the water.
    if (!reducedMotion) for (let i = 0; i < 7; i++) { const x = 349 + i * 71 + Math.sin(t * .7 + i) * 10, y = 526 + Math.sin(t * .8 + i * 2) * 24; circle(x, y, 1.2, '#c5d4a95c'); }
  }
  function drawWater() {
    const t = reducedMotion ? 0 : clock;
    // Foreground water partially hides the crashed cart.
    c.beginPath(); c.moveTo(0, 614);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 613 + Math.sin(x / 33 + t * 1.5) * 2);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); paint('#3d7164d9');
    for (let i = 0; i < 16; i++) {
      const x = 260 + (i * 57 + t * 9) % 625, y = 610 + (i % 4) * 7;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 9, y + 2, x + 21, y); c.strokeStyle = i % 3 ? '#8eb89b45' : '#b3cba566'; c.lineWidth = 1.4; c.stroke();
    }
    // An extremely disinterested ravine resident.
    oval(726, 611, 32, 5, '#476e4d');
    for (const x of [711, 728]) { oval(x, 607, 7, 5, '#6e9470'); circle(x + 1, 606, 2, '#d8d8a4'); circle(x + 1, 606, 1, INK); }
  }
  function drawParticles() {
    particles.forEach(p => {
      c.save(); c.globalAlpha = Math.min(1, p.life * 2); c.translate(p.x, p.y); c.rotate(p.rotation);
      if (p.kind === 'debris') { box(-p.size / 2, -4, p.size, 8, 1, p.color, INK, 1.2); line([[-p.size / 2 + 3, -1], [p.size / 2 - 3, -1]], '#e7bd8170', 1); }
      else if (p.kind === 'jar') drawJar(0, 12, .55);
      else if (p.kind === 'cargo') { box(-8, -6, 16, 13, 2, p.color, INK, 1); }
      else if (p.kind === 'drop') oval(0, 0, p.size * .5, p.size, p.color);
      else box(-p.size / 2, -p.size / 2, p.size, p.kind === 'confetti' ? p.size * 1.7 : p.size, 1, p.color);
      c.restore();
    });
  }
  function drawFloaters() {
    floaters.forEach(p => {
      c.save(); c.globalAlpha = Math.min(1, p.life * 3);
      c.font = `bold ${p.message.length > 10 ? 15 : 20}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.lineWidth = 4; c.strokeStyle = p.color === '#c9dac2' ? '#365d4f' : '#eadfbd'; c.strokeText(p.message, p.x, p.y);
      c.fillStyle = p.color; c.fillText(p.message, p.x, p.y); c.restore();
    });
  }
  function render() {
    const scale = canvas.width / W;
    c = screen; c.setTransform(scale, 0, 0, scale, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    c.clearRect(0, 0, W, H); c.drawImage(background, 0, 0, W, H);
    drawAmbient(); drawBridge(); drawReceiver();
    drawGoblin(226, G.deckY, .84, phase);
    drawCart(); drawParticles(); drawWater(); drawFloaters();
    if (phase === 'build' || phase === 'testing' || phase === 'falling') drawBubble();
    if (phase === 'testing') {
      box(438, 20, 234, 27, 14, '#e9e0bf', '#9fa982', 1);
      circle(453, 33, 3.5, '#d59348'); text('LIVE TEST · HOLD YOUR BREATH', 568, 37, 9, '#5f7955', 'center');
    }
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.width * H / W * dpr));
    render();
  }
  function frame(timestamp) {
    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, .04) : 0;
    lastTime = timestamp; clock += dt;
    updateRun(dt); updateParticles(dt); render();
    window.requestAnimationFrame(frame);
  }
  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * W, y: (event.clientY - bounds.top) / bounds.height * H };
  }
  function hitBay(point) { return point.y >= G.deckY - 66 && point.y <= G.deckY + 154 ? R.bayAt(point.x) : -1; }
  canvas.addEventListener('pointermove', event => { if (phase === 'build' && event.pointerType !== 'touch') syncHover(hitBay(canvasPoint(event))); });
  canvas.addEventListener('pointerleave', () => syncHover(-1));
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || phase !== 'build') return;
    const index = hitBay(canvasPoint(event));
    if (index !== -1) { event.preventDefault(); if (event.pointerType !== 'touch') canvas.focus({ preventScroll: true }); applyTool(index); }
  });
  canvas.addEventListener('contextmenu', event => { event.preventDefault(); const index = hitBay(canvasPoint(event)); if (index !== -1) applyTool(index, 'erase'); });
  toolButtons.forEach(button => button.addEventListener('click', () => chooseTool(button.dataset.tool)));
  spanButtons.forEach((button, index) => {
    button.addEventListener('click', () => applyTool(index));
    button.addEventListener('pointerenter', () => { if (phase === 'build') syncHover(index); });
    button.addEventListener('pointerleave', () => syncHover(-1));
    button.addEventListener('focus', () => { if (phase === 'build') syncHover(index); });
    button.addEventListener('blur', () => syncHover(-1));
  });
  ui.test.addEventListener('click', mainAction);
  ui.clear.addEventListener('click', () => { unlockAudio(); if (phase === 'build' || phase === 'failure') returnToBuild(true); else if (phase === 'success') returnToBuild(); });
  ui.sound.addEventListener('click', toggleSound);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (event.code === 'Space') { event.preventDefault(); mainAction(); }
    else if (['1', '2', '3', '4'].includes(key)) { event.preventDefault(); chooseTool(['wood', 'iron', 'brace', 'erase'][Number(key) - 1]); }
    else if (key === 'r') { event.preventDefault(); unlockAudio(); if (phase !== 'build') returnToBuild(); else note('Your blueprint is ready to edit. Space sends the cart; Clear blueprint refunds every bolt.'); }
    else if (key === 'm') { event.preventDefault(); toggleSound(); }
    else if ((key === 'arrowleft' || key === 'arrowright') && phase === 'build' && (event.target === canvas || event.target === document.body)) {
      event.preventDefault(); syncHover(hoverBay < 0 ? 0 : (hoverBay + (key === 'arrowright' ? 1 : G.bays - 1)) % G.bays);
    } else if (key === 'enter' && event.target === canvas && phase === 'build') { event.preventDefault(); applyTool(hoverBay < 0 ? 0 : hoverBay); }
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { lastTime = 0; });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  updateUI(); updateSound(); resize(); window.requestAnimationFrame(frame);
})();
