(() => {
  'use strict';
  const M = window.BridgeModel;
  const $ = id => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = 1000, H = 560, ROAD = 306, TRUSS = 374, WATER = 518;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bayButtons = [...document.querySelectorAll('.bay-slot')];
  const toolButtons = [...document.querySelectorAll('[data-tool]')];
  const state = {
    phase: 'build', design: Array(5).fill(null), tool: 'wood', history: [], hover: -1,
    attempt: 0, run: null, broken: -1, previousBreak: -1, clock: 0, phaseTime: 0,
    particles: [], fall: null, shake: 0, splash: false, noticeUntil: 0,
    speech: '“Planks are free. Gravity isn’t.”', speechUntil: 0, runQuip: 0,
    sound: true, lastCreak: 0, reportShown: false
  };
  let audio = null, audioMaster = null;
  let accumulator = 0, lastTime = 0, lastUI = 0;
  let scaleX = 1, scaleY = 1;
  const background = document.createElement('canvas');
  background.width = W * 2;
  background.height = H * 2;
  const bg = background.getContext('2d');
  bg.scale(2, 2);

  function randomSource(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  const artRandom = randomSource(4817);
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function polygon(c, points, fill, stroke, width = 1) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); }
  }
  function line(c, points, color, width = 1, dash = []) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    c.setLineDash(dash); c.stroke(); c.setLineDash([]);
  }
  function circle(c, x, y, r, fill, stroke, width = 1) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); }
  }
  function ellipse(c, x, y, rx, ry, fill, rotation = 0) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  }
  function roundRect(c, x, y, w, h, r, fill, stroke, width = 1) {
    r = Math.min(r, Math.min(w, h) / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function text(c, words, x, y, size, color, weight = '400', align = 'left', family = 'Arial, sans-serif') {
    c.font = `${weight} ${size}px ${family}`; c.fillStyle = color; c.textAlign = align;
    c.textBaseline = 'alphabetic'; c.fillText(words, x, y);
  }
  function wrapped(c, words, x, y, maxWidth, size, color, leading = 19) {
    c.font = `italic ${size}px Georgia, serif`;
    const lines = []; let current = '';
    words.split(' ').forEach(word => {
      const next = current ? current + ' ' + word : word;
      if (current && c.measureText(next).width > maxWidth) { lines.push(current); current = word; }
      else current = next;
    });
    if (current) lines.push(current);
    lines.forEach((s, i) => text(c, s, x, y + i * leading, size, color, 'italic', 'left', 'Georgia, serif'));
  }

  // Original vector scenery, painted once. All assets live in this file.
  function pine(c, x, y, height, color, trunk = '#6b7050') {
    line(c, [[x, y], [x, y - height * 0.9]], trunk, Math.max(1, height / 30));
    for (let i = 0; i < 3; i++) {
      const top = y - height + i * height * .19;
      const wide = height * (.19 + .045 * i);
      polygon(c, [[x, top], [x + wide, top + height * .52], [x, top + height * .47], [x - wide, top + height * .52]], color);
    }
  }
  function tuft(c, x, y, size, color) {
    line(c, [[x - size, y - size * .8], [x, y], [x - size * .2, y - size * 1.5]], color, 1.6);
    line(c, [[x, y], [x + size, y - size]], color, 1.6);
  }
  function cloud(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = .57;
    ellipse(c, 0, 0, 35, 9, '#f8f3da'); ellipse(c, -12, -5, 17, 11, '#f8f3da');
    ellipse(c, 10, -8, 19, 14, '#f8f3da'); c.restore();
  }
  function drawBackground(c) {
    const sky = c.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#c7d9bf'); sky.addColorStop(1, '#8da894');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    circle(c, 756, 111, 45, '#ecdd9e');
    circle(c, 756, 111, 54, null, '#dfdca470', 1);
    cloud(c, 127, 79, 1.25); cloud(c, 438, 112, 1.05); cloud(c, 871, 78, .75);
    c.beginPath(); c.moveTo(0, 196); c.bezierCurveTo(111, 161, 130, 210, 236, 162);
    c.bezierCurveTo(331, 124, 389, 198, 483, 178); c.bezierCurveTo(565, 161, 598, 204, 674, 164);
    c.bezierCurveTo(782, 116, 840, 145, 1000, 184); c.lineTo(1000, H); c.lineTo(0, H); c.closePath(); c.fillStyle = '#aac1a5'; c.fill();
    polygon(c, [[0, 236], [98, 215], [164, 231], [245, 202], [335, 216], [409, 264], [506, 221], [570, 238], [655, 209], [729, 237], [827, 197], [906, 221], [1000, 210], [1000, 560], [0, 560]], '#89a98f');
    for (let i = 0; i < 34; i++) {
      const x = i * 32 + artRandom() * 14;
      const y = 263 + Math.sin(x * .015) * 16;
      pine(c, x, y, 30 + artRandom() * 42, '#759b83', '#819b7e');
    }
    polygon(c, [[0, 269], [180, 254], [270, 287], [366, 331], [461, 342], [530, 311], [615, 334], [722, 280], [860, 251], [1000, 273], [1000, 560], [0, 560]], '#527e6b');
    polygon(c, [[245, 317], [344, 346], [413, 343], [460, 371], [474, 432], [426, 479], [415, 560], [0, 560]], '#426d5d');
    polygon(c, [[760, 302], [660, 358], [613, 351], [579, 394], [609, 424], [631, 460], [728, 505], [757, 560], [1000, 560]], '#3e6958');
    // The creek gets wider toward the viewer.
    c.beginPath(); c.moveTo(537, 332); c.bezierCurveTo(533, 366, 500, 372, 518, 408);
    c.bezierCurveTo(540, 445, 486, 455, 461, 484); c.bezierCurveTo(415, 506, 313, 491, 288, 528); c.lineTo(277, 560);
    c.lineTo(765, 560); c.bezierCurveTo(785, 500, 780, 496, 568, 480);
    c.bezierCurveTo(528, 448, 569, 433, 552, 405); c.bezierCurveTo(532, 373, 561, 361, 548, 332); c.closePath();
    c.fillStyle = '#86b6a3'; c.fill();
    c.beginPath(); c.moveTo(542, 349); c.bezierCurveTo(535, 385, 538, 383, 537, 411);
    c.bezierCurveTo(533, 459, 522, 460, 515, 484); c.bezierCurveTo(507, 515, 593, 548, 595, 560);
    c.strokeStyle = '#b3cdac55'; c.lineWidth = 14; c.stroke();
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0;
      const x = left ? 315 + artRandom() * 111 : 649 + artRandom() * 108;
      pine(c, x, 370 + artRandom() * 134, 24 + artRandom() * 46, left ? '#355f4f' : '#365f50', '#44694e');
    }
    // Cliff faces and the diagonal strata in the sandstone.
    polygon(c, [[0, 297], [251, 293], [278, 313], [268, 343], [283, 374], [257, 412], [276, 444], [260, 480], [286, 521], [274, 560], [0, 560]], '#ad855a', '#6d7150', 2);
    polygon(c, [[0, 315], [193, 316], [231, 345], [226, 386], [199, 406], [214, 450], [192, 476], [225, 516], [218, 560], [0, 560]], '#c19b69');
    polygon(c, [[224, 305], [275, 315], [260, 346], [274, 374], [244, 410], [260, 443], [241, 479], [269, 520], [258, 560], [219, 560], [225, 516], [194, 476], [216, 450], [200, 406], [227, 387], [232, 345]], '#916c4b');
    polygon(c, [[788, 296], [1000, 294], [1000, 560], [760, 560], [777, 528], [763, 496], [790, 464], [780, 435], [800, 401], [786, 366], [799, 336]], '#c19a69', '#6d7150', 2);
    polygon(c, [[790, 309], [832, 308], [848, 344], [829, 372], [851, 403], [830, 429], [846, 458], [820, 489], [824, 517], [803, 560], [760, 560], [777, 528], [763, 496], [790, 464], [780, 435], [800, 401], [786, 366], [799, 336]], '#9e7750');
    const strata = [341, 374, 410, 447, 489, 531];
    strata.forEach((y, i) => {
      line(c, [[0, y + 5], [70, y - 1], [139, y + 4], [193, y - 3], [232, y + 4]], i % 2 ? '#a17d52' : '#d7b784', 2);
      line(c, [[838, y - 3], [881, y + 3], [938, y - 6], [1000, y - 2]], i % 2 ? '#a47f54' : '#d6b684', 2);
    });
    line(c, [[64, 343], [82, 366], [76, 373]], '#9c8057', 1.5);
    line(c, [[150, 414], [143, 434], [160, 447], [154, 466]], '#a08054', 1.5);
    line(c, [[937, 413], [922, 427], [928, 447]], '#a08054', 1.5);
    // Soft moss patches on the rock faces.
    [[18, 322, 52], [211, 329, 33], [247, 426, 22], [23, 488, 35], [829, 386, 26], [961, 477, 42], [868, 525, 36]].forEach(([x, y, r]) => {
      ellipse(c, x, y, r, r * .16, '#7e8953');
      line(c, [[x + r * .4, y], [x + r * .35, y + 10]], '#77864e', 2);
    });
    // Grass caps, with a clear pale road.
    polygon(c, [[0, 288], [229, 287], [265, 293], [277, 302], [249, 311], [217, 308], [0, 309]], '#647b41', '#4b643b', 2);
    polygon(c, [[789, 292], [818, 287], [1000, 288], [1000, 309], [836, 308], [785, 310], [775, 302]], '#687e42', '#4b643b', 2);
    polygon(c, [[0, 292], [226, 293], [273, 300], [267, 306], [0, 301]], '#dcc69b');
    polygon(c, [[784, 301], [844, 293], [1000, 292], [1000, 301], [785, 306]], '#e0c99c');
    for (let i = 0; i < 23; i++) {
      const x = i < 12 ? artRandom() * 235 : 805 + artRandom() * 195;
      const y = 289 + artRandom() * 3;
      tuft(c, x, y, 3 + artRandom() * 4, '#657b43');
    }
    pine(c, 25, 289, 107, '#3c6848', '#645e39');
    pine(c, 59, 287, 72, '#4d754e', '#625f3d');
    pine(c, 972, 291, 112, '#3d6848', '#645e39');
    pine(c, 1001, 296, 84, '#527952', '#625f3d');
    // Tiny roadside flowers and mushrooms.
    [[87, 290], [96, 291], [845, 290], [851, 287]].forEach(([x, y]) => {
      line(c, [[x, y], [x + 2, y - 11]], '#697f45', 1.2); circle(c, x + 2, y - 11, 2.2, '#e9d991');
    });
    [[45, 307], [56, 308], [955, 308]].forEach(([x, y], i) => {
      line(c, [[x, y], [x, y - 5]], '#e0d3ac', 2.3); ellipse(c, x, y - 6, i === 1 ? 4 : 6, 3, '#b36040');
      circle(c, x - 1, y - 7, .8, '#eee5bc');
    });
    // A goal worth the journey.
    line(c, [[907, 294], [907, 187]], '#5f5939', 6);
    line(c, [[909, 291], [909, 190]], '#a38c52', 2);
    polygon(c, [[857, 174], [946, 174], [959, 193], [946, 212], [857, 212]], '#efe0b1', '#5a6543', 2);
    text(c, 'OTHER SIDE', 901, 190, 10, '#596441', '700', 'center');
    text(c, '(probably safer)', 901, 204, 8, '#8a8c65', 'italic', 'center', 'Georgia, serif');
    line(c, [[842, 288], [842, 244]], '#66764e', 3);
    polygon(c, [[843, 244], [866, 248], [864, 265], [843, 262]], '#e9d69a', '#66764e', 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) {
      c.fillStyle = '#647b4b'; c.fillRect(844 + i * 6, 247 + j * 7, 6, 7);
    }
    // Decorative survey marks and an old safety sign.
    c.save(); c.translate(153, 460); c.rotate(-.12);
    roundRect(c, -37, -15, 74, 30, 2, '#d5b578', '#866c45', 1.5);
    text(c, 'NO REFUNDS', 0, -2, 8, '#7c6140', '700', 'center');
    text(c, 'BELOW THIS LINE', 0, 8, 5.8, '#91734b', '700', 'center'); c.restore();
    [[497, 159], [517, 151]].forEach(([x, y]) => {
      c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 2, y - 3, x, y + 1); c.quadraticCurveTo(x + 3, y - 3, x + 6, y - 1);
      c.strokeStyle = '#68836b'; c.lineWidth = 1.4; c.stroke();
    });
    // Sparse grain keeps the scene closer to printed illustration than glossy UI.
    c.save(); c.globalAlpha = .055;
    for (let i = 0; i < 6400; i++) {
      const x = artRandom() * W, y = artRandom() * H;
      c.fillStyle = i % 3 === 0 ? '#fff8d0' : '#253e2d';
      c.fillRect(x, y, .7 + artRandom() * 1.2, .6 + artRandom());
    }
    c.restore();
  }

  function prepareAudio() {
    if (!state.sound) return;
    try {
      if (!audio) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) { audio = new Audio(); audioMaster = audio.createGain(); audioMaster.gain.value = 1; audioMaster.connect(audio.destination); }
      }
      if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) { /* A silent goblin is still an engineer. */ }
  }
  function tone(frequency, duration, type = 'sine', volume = .05, delay = 0, endFrequency = null) {
    if (!state.sound || !audio || audio.state !== 'running') return;
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(audioMaster); osc.start(now); osc.stop(now + duration + .02);
  }
  function noise(duration, volume, lowpass, delay = 0) {
    if (!state.sound || !audio || audio.state !== 'running') return;
    const n = Math.ceil(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, n, audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const source = audio.createBufferSource(), gain = audio.createGain(), filter = audio.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = lowpass;
    gain.gain.value = volume; source.connect(filter); filter.connect(gain); gain.connect(audioMaster);
    source.start(audio.currentTime + delay);
  }
  function sfx(kind) {
    if (kind === 'wood') { tone(220, .11, 'triangle', .085, 0, 95); noise(.085, .065, 950); tone(155, .09, 'triangle', .045, .065); }
    if (kind === 'iron') { tone(760, .18, 'triangle', .06, 0, 680); tone(1420, .11, 'sine', .03, .025); }
    if (kind === 'remove') tone(330, .11, 'triangle', .04, 0, 180);
    if (kind === 'no') { tone(130, .1, 'triangle', .035); tone(115, .15, 'triangle', .035, .1); }
    if (kind === 'go') { tone(440, .1, 'triangle', .045); tone(660, .16, 'triangle', .045, .13); }
    if (kind === 'crack') { noise(.35, .18, 1600); tone(120, .3, 'sawtooth', .035, 0, 40); tone(520, .15, 'triangle', .02, .02, 100); }
    if (kind === 'splash') { noise(.65, .21, 950); tone(130, .4, 'sine', .035, .05, 65); }
    if (kind === 'win') [392, 494, 587, 784].forEach((f, i) => tone(f, .3, 'triangle', .045, i * .12));
  }

  function say(words, duration = 3.5) { state.speech = words; state.speechUntil = state.clock + duration; }
  function notify(message, duration = 2.6) {
    $('scene-notice').textContent = message;
    $('scene-notice').classList.add('show'); state.noticeUntil = state.clock + duration;
  }
  function showPanel(name) {
    ['build', 'run', 'result'].forEach(key => { $(key + '-panel').hidden = key !== name; });
    const index = { build: '01', run: '02', result: '03' }[name];
    $('phase-number').textContent = index;
    $('phase-title').textContent = { build: 'THE BUILD', run: 'THE TEST', result: 'THE PAPERWORK' }[name];
  }
  function updateBuildUI() {
    const left = M.remaining(state.design);
    $('budget-value').textContent = left;
    [...$('budget-blocks').children].forEach((block, i) => block.classList.toggle('spent', i >= left));
    toolButtons.forEach(button => {
      const selected = button.dataset.tool === state.tool;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    bayButtons.forEach((button, i) => {
      const material = state.design[i];
      button.classList.toggle('wood', material === 'wood');
      button.classList.toggle('iron', material === 'iron');
      button.classList.toggle('was-broken', state.previousBreak === i && state.phase === 'build');
      button.disabled = state.phase !== 'build';
      button.querySelector('.bay-name').textContent = material === 'iron' ? 'iron' : material === 'wood' ? 'timber' : '+ brace';
      const current = material ? M.MATERIALS[material].name : 'empty';
      const action = material === state.tool ? 'remove this truss' : 'place ' + M.MATERIALS[state.tool].name.toLowerCase();
      button.setAttribute('aria-label', `Bay ${i + 1}, ${current}. Click to ${action}.`);
      button.title = `Bay ${i + 1} · ${current}. Click to ${action}. Right-click to reclaim.`;
    });
    $('undo-button').disabled = state.history.length === 0;
    $('clear-button').disabled = !state.design.some(Boolean);
  }
  function chooseTool(tool) {
    if (state.phase !== 'build') return;
    prepareAudio(); state.tool = tool; updateBuildUI();
    tone(tool === 'wood' ? 260 : 440, .065, 'triangle', .024);
  }
  function build(index, remove = false) {
    if (state.phase !== 'build') return;
    prepareAudio();
    const before = state.design[index];
    if (remove && !before) return;
    const next = M.place(state.design, index, remove ? null : state.tool);
    if (!next) {
      sfx('no'); notify('Not enough bolts. Reclaim a truss or use timber.');
      say('“The budget has filed a complaint.”');
      const budget = document.querySelector('.budget-row'); budget.classList.remove('shake-budget');
      void budget.offsetWidth; budget.classList.add('shake-budget'); return;
    }
    state.history.push(state.design.slice()); state.design = next;
    const after = next[index];
    if (after) {
      sfx(after); constructionDust(index, after);
      if (state.design.every(Boolean)) say('“Five trusses. Basically a university.”', 5);
      else if (after === 'iron') say('“Found it. Legally, probably.”');
      else say('“That tree died for infrastructure.”');
    } else { sfx('remove'); say('“Recycling. Very professional.”'); }
    if (state.previousBreak === index || (state.previousBreak >= 0 && Math.abs(state.previousBreak - index) === 1)) state.previousBreak = -1;
    updateBuildUI();
    const action = after ? M.MATERIALS[after].name + ' fitted' : 'truss reclaimed';
    $('scene-notice').textContent = `Bay ${index + 1}: ${action}. ${M.remaining(state.design)} bolts left.`;
  }
  function undo() {
    if (state.phase !== 'build' || !state.history.length) return;
    prepareAudio(); state.design = state.history.pop(); state.previousBreak = -1;
    updateBuildUI(); sfx('remove'); notify('Last questionable decision undone.', 1.6);
  }
  function clearBridge() {
    if (state.phase !== 'build' || !state.design.some(Boolean)) return;
    prepareAudio(); state.history.push(state.design.slice()); state.design = Array(5).fill(null);
    state.previousBreak = -1; updateBuildUI(); sfx('remove'); say('“A clean slate. The same river.”');
    notify('All trusses reclaimed. All 12 bolts returned.', 2);
  }
  function startTest() {
    if (state.phase === 'run' || state.phase === 'fall') return;
    prepareAudio();
    state.run = M.createRun(state.design); state.phase = 'run'; state.phaseTime = 0;
    state.attempt++; state.hover = -1; state.broken = -1; state.previousBreak = -1;
    state.particles = []; state.fall = null; state.splash = false; state.reportShown = false;
    state.runQuip = 0; state.lastCreak = -10; accumulator = 0;
    state.noticeUntil = 0; $('scene-notice').classList.remove('show');
    $('attempt-counter').textContent = 'TEST ' + String(state.attempt).padStart(2, '0');
    $('run-heading').textContent = 'Moment of truth.';
    $('run-description').textContent = 'Please keep your limbs and opinions off the bridge.';
    $('scene-status').textContent = 'THE CART IS ROLLING'; $('scene-status').className = 'scene-status running';
    $('scene-instruction').innerHTML = '<b>Watch the load.</b> Long overloads snap trusses.';
    document.querySelector('.caption-key').textContent = 'Creaking is complimentary';
    showPanel('run'); updateBuildUI(); updateRunUI();
    $('abort-button').focus({ preventScroll: true });
    say('“Safety third. Turnips first.”', 20); sfx('go');
  }
  function returnToBuild() {
    const oldBroken = state.broken;
    state.phase = 'build'; state.phaseTime = 0; state.run = null; state.broken = -1;
    state.previousBreak = oldBroken; state.fall = null; state.particles = []; state.shake = 0;
    state.splash = false; state.hover = -1; accumulator = 0;
    $('scene-status').textContent = oldBroken >= 0 ? 'BACK TO THE DRAWING BOARD' : 'AWAITING A BAD IDEA';
    $('scene-status').className = 'scene-status';
    $('scene-instruction').innerHTML = '<b>Click a bay</b> to brace it. Click again to remove.';
    document.querySelector('.caption-key').innerHTML = '<kbd>1</kbd> – <kbd>5</kbd> work too';
    showPanel('build'); updateBuildUI();
    $(state.tool + '-tool').focus({ preventScroll: true });
    say(oldBroken >= 0 ? '“Prototype. That was a prototype.”' : '“What if we made it even cheaper?”', 6);
    if (oldBroken >= 0) notify(`Bay ${oldBroken + 1} broke. Your design is restored — try stronger support.`, 4);
    else notify('Back on the bench. All your trusses and bolts are intact.', 2.7);
  }
  function updateRunUI() {
    if (!state.run) return;
    $('progress-value').textContent = Math.round(state.run.progress * 100) + '%';
    $('progress-fill').style.width = (state.run.progress * 100) + '%';
    const rows = $('stress-list').children;
    for (let i = 0; i < 5; i++) {
      const ratio = state.run.ratios[i];
      rows[i].classList.toggle('warn', ratio > .83 && ratio <= 1);
      rows[i].classList.toggle('danger', ratio > 1 || state.broken === i);
      rows[i].querySelector('.stress-fill').style.width = clamp(ratio / 1.5 * 100, 0, 100) + '%';
      rows[i].querySelector('.stress-number').textContent = state.broken === i ? '×' : Math.round(ratio * 100) + '%';
    }
  }
  function showReport(won) {
    if (state.reportShown) return;
    state.reportShown = true; state.phase = won ? 'won' : 'lost'; state.phaseTime = 0;
    showPanel('result');
    $('result-stamp').className = 'result-stamp' + (won ? '' : ' failed');
    $('result-stamp').innerHTML = won ? 'CERTIFIED<br>GOOD ENOUGH' : 'GRAVITY<br>WINS AGAIN';
    $('result-kicker').textContent = won ? 'AN UNEXPECTED SUCCESS' : 'A VALUABLE LEARNING SPLASH';
    $('result-title').textContent = won ? 'It actually held.' : 'A very wet delivery.';
    $('result-bolts').innerHTML = `${M.cost(state.design)} <small>/ 12</small>`;
    $('result-stat-label').textContent = won ? 'CARGO SAVED' : 'FAILED BAY';
    $('result-stat').innerHTML = won ? '100<small>%</small>' : `<small>№ </small>${state.broken + 1}`;
    $('retry-button').querySelector('span').textContent = won ? 'Back to the workbench' : 'Patch it up';
    if (won) {
      $('result-description').textContent = 'The turnips are across. Your engineering license remains entirely fictional.';
      const left = M.remaining(state.design);
      $('result-advice').textContent = left > 0 ? `And ${left} bolt${left === 1 ? '' : 's'} left over. Grub calls that his “consulting fee.”` : 'Exactly on budget. Suspiciously competent. Try getting across with a bolt to spare.';
      $('scene-status').textContent = 'CARGO DELIVERED'; $('scene-status').className = 'scene-status success';
      $('scene-instruction').innerHTML = '<b>Delivery delivered.</b> The turnips send their lukewarm regards.';
      say('“Put that on my very real résumé.”', 1000); sfx('win');
      celebrate();
      notify('SUCCESS — every turnip made it across!', 4);
    } else {
      const material = state.design[state.broken];
      $('result-description').textContent = `Bay ${state.broken + 1} gave up under the cart. The river has signed for your delivery.`;
      $('result-advice').textContent = !material ? 'That bay had no truss. Free road planks are not enough — brace all five bays.' : material === 'wood' ? 'Try iron in the failed bay, or strengthen its neighbors. Click a new material onto a truss to swap it.' : 'Strong metal still needs backup. Reinforce the neighboring bays to share the load.';
      $('scene-status').textContent = 'UNSCHEDULED RIVER DELIVERY'; $('scene-status').className = 'scene-status failed';
      $('scene-instruction').innerHTML = '<b>Bridge failed.</b> Fortunately, replacement carts are a business expense.';
      say('“The river has accepted delivery.”', 1000);
      notify(`FAILED — bay ${state.broken + 1} snapped. Rebuild for an immediate retry.`, 4);
    }
    document.querySelector('.caption-key').textContent = 'R to rebuild';
    updateBuildUI(); $('retry-button').focus({ preventScroll: true });
  }

  function particle(p) {
    state.particles.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, gravity: 330, rotation: 0, spin: 0,
      life: 1, maxLife: 1, size: 4, color: '#dbb376', kind: 'dust', wet: false }, p));
  }
  function constructionDust(i, material) {
    if (reducedMotion) return;
    const x = M.START + M.SPAN * (i + .5);
    for (let k = 0; k < 9; k++) {
      particle({ x: x + (Math.random() - .5) * 75, y: ROAD + 15 + Math.random() * 48,
        vx: (Math.random() - .5) * 52, vy: -30 - Math.random() * 48, gravity: 170,
        life: .6, maxLife: .6, size: 1 + Math.random() * 2, color: material === 'wood' ? '#e2bb7d' : '#d7e0bd' });
    }
  }
  function collapse() {
    const run = state.run;
    state.broken = run.broken; state.phase = 'fall'; state.phaseTime = 0; state.shake = reducedMotion ? 0 : 7;
    state.fall = { x: run.x, y: ROAD - 6 + cartSag(run.x), vx: run.broken === 4 ? 25 : 64, vy: 15, rotation: .03, splashed: false };
    const x0 = M.START + run.broken * M.SPAN;
    const wood = state.design[run.broken] !== 'iron';
    const color = wood ? '#be8a4c' : '#8aaba2';
    for (let i = 0; i < 7; i++) {
      particle({ kind: 'beam', x: x0 + i * 15, y: ROAD + 3, vx: (Math.random() - .45) * 90,
        vy: -35 + Math.random() * 30, rotation: (Math.random() - .5) * .4,
        spin: (Math.random() - .5) * 7, life: 2.2, maxLife: 2.2, size: 18, color });
    }
    if (state.design[run.broken]) {
      [-1, 1].forEach(side => particle({ kind: 'beam', x: x0 + 51 + side * 25, y: ROAD + 30,
        vx: side * 35, vy: 25, size: 62, rotation: side * .9, spin: side * 2,
        color, life: 2.2, maxLife: 2.2 }));
    }
    for (let i = 0; i < 6; i++) {
      particle({ kind: i < 2 ? 'crate' : 'turnip', x: run.x - 24 + i * 11, y: ROAD - 55 - Math.random() * 21,
        vx: -36 + Math.random() * 129, vy: -125 - Math.random() * 50, size: i < 2 ? 21 : 7,
        spin: (Math.random() - .5) * 8, life: 3, maxLife: 3, color: '#eee0b3' });
    }
    for (let i = 0; i < 15; i++) particle({ x: x0 + 50, y: ROAD + 12, vx: (Math.random() - .5) * 160,
      vy: (Math.random() - .5) * 120, gravity: 120, life: .6, maxLife: .6, size: 2 + Math.random() * 5, color: '#ded1a2' });
    $('run-heading').textContent = 'Unscheduled descent.';
    $('run-description').textContent = `Bay ${state.broken + 1} has resigned. Effective immediately.`;
    $('scene-status').textContent = 'PLEASE REMAIN UNCALM'; $('scene-status').className = 'scene-status failed';
    say('“That was a load-bearing noise.”', 20); sfx('crack'); updateRunUI();
  }
  function makeSplash(x) {
    state.splash = true;
    sfx('splash'); state.shake = reducedMotion ? 0 : 3;
    for (let i = 0; i < (reducedMotion ? 8 : 28); i++) particle({
      kind: 'drop', x, y: WATER, vx: (Math.random() - .5) * 245, vy: -65 - Math.random() * 185,
      gravity: 390, life: .5 + Math.random() * .5, maxLife: 1,
      size: 2 + Math.random() * 4, color: i % 3 ? '#b9d7bb' : '#ebead1'
    });
  }
  function celebrate() {
    if (reducedMotion) return;
    for (let i = 0; i < 45; i++) particle({ kind: 'confetti', x: 876 + Math.random() * 35, y: 236,
      vx: (Math.random() - .5) * 210, vy: -70 - Math.random() * 175, gravity: 95, spin: (Math.random() - .5) * 8,
      life: 2.5 + Math.random() * .8, maxLife: 3.3, size: 3 + Math.random() * 2,
      color: ['#e5bd57', '#e88549', '#eae5b4', '#92ae69'][i % 4] });
  }
  function updateParticles(dt) {
    state.particles.forEach(p => {
      p.life -= dt;
      if (!p.wet) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.rotation += p.spin * dt;
        if (p.y > WATER + 2 && ['beam', 'turnip', 'crate'].includes(p.kind)) {
          p.wet = true; p.y = WATER + Math.random() * 5; p.vy = 0; p.vx *= .1; p.spin *= .1; p.life = Math.min(p.life, 1.1);
        }
      } else { p.x += p.vx * dt; p.y += Math.sin(state.clock * 2 + p.x) * dt * 2; p.rotation += p.spin * dt; }
    });
    state.particles = state.particles.filter(p => p.life > 0 && p.y < H + 40);
  }
  function update(dt) {
    state.clock += dt; state.phaseTime += dt;
    if (state.noticeUntil && state.clock > state.noticeUntil) {
      $('scene-notice').classList.remove('show'); state.noticeUntil = 0;
    }
    if (state.phase === 'build' && state.speechUntil && state.clock > state.speechUntil) {
      state.speechUntil = 0;
      state.speech = state.design.every(Boolean) ? '“Looks like a bridge. Send it?”' : '“Planks are free. Gravity isn’t.”';
    }
    if (state.phase === 'run') {
      accumulator += dt;
      while (accumulator >= 1 / 120 && state.phase === 'run') {
        M.step(state.run, 1 / 120); accumulator -= 1 / 120;
        if (state.run.done) { if (state.run.success) showReport(true); else collapse(); }
      }
      if (state.phase === 'run') {
        if (state.run.x > 374 && state.runQuip < 1) { state.runQuip = 1; say('“That creak means it’s working.”', 20); }
        if (state.run.x > 602 && state.runQuip < 2) { state.runQuip = 2; say('“I never doubted me for a second.”', 20); }
        const stress = Math.max(...state.run.ratios);
        if (stress > .82 && state.clock - state.lastCreak > .7) {
          state.lastCreak = state.clock;
          tone(85 + stress * 55, .18, 'triangle', .015, 0, 72);
          noise(.085, .012, 350);
        }
      }
      if (state.clock - lastUI > .08) { updateRunUI(); lastUI = state.clock; }
    } else if (state.phase === 'fall') {
      const f = state.fall;
      if (!f.splashed) {
        f.vy += 370 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        f.rotation += dt * 1.1;
        if (f.y >= WATER + 12) { f.splashed = true; makeSplash(f.x); }
      }
      if (state.phaseTime > 2.1) showReport(false);
    }
    state.shake = Math.max(0, state.shake - dt * 12);
    updateParticles(dt);
  }

  function baySag(i) {
    if (!state.run) return 0;
    const ratio = state.phase === 'won' ? state.run.ratios[i] * Math.exp(-state.phaseTime * 3) : state.run.ratios[i];
    const damaged = state.run.damage[i];
    const pulse = state.phase === 'run' && !reducedMotion ? Math.sin(state.clock * 17 + i * 1.7) * ratio * .75 : 0;
    return Math.min(19, ratio * 4 + damaged * 6 + pulse);
  }
  function nodeSag(i) {
    if (i === 0 || i === 5) return 0;
    let sag = (baySag(i - 1) + baySag(i)) * .48;
    if (state.broken >= 0 && (i === state.broken || i === state.broken + 1)) sag += 9;
    return sag;
  }
  function roadAt(x) {
    if (x < M.START || x >= M.END) return 0;
    const position = (x - M.START) / M.SPAN, i = Math.floor(position);
    return lerp(nodeSag(i), nodeSag(i + 1), position - i);
  }
  function cartSag(x) { return (roadAt(x - 32) + roadAt(x + 32)) / 2; }

  function drawBeam(x1, y1, x2, y2, material, ratio = 0, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const iron = material === 'iron';
    const dark = iron ? '#3c5752' : '#60482e';
    let main = iron ? '#91b1a4' : '#bf9456';
    if (state.phase === 'run' && ratio > 1.02) main = iron ? '#c29b68' : '#d39a54';
    line(ctx, [[x1, y1], [x2, y2]], dark, iron ? 10 : 12);
    line(ctx, [[x1, y1], [x2, y2]], main, iron ? 6 : 8);
    line(ctx, [[x1 - 1, y1 - 1], [x2 - 1, y2 - 1]], iron ? '#d4d9b88c' : '#edc88788', 1);
    if (!iron) {
      const dx = x2 - x1, dy = y2 - y1;
      line(ctx, [[x1 + dx * .24, y1 + dy * .24 + 2], [x1 + dx * .56, y1 + dy * .56 + 2]], '#a6784199', 1);
    }
    ctx.restore();
  }
  function drawBolt(x, y, material, size = 4) {
    if (material === 'iron') roundRect(ctx, x - 6, y - 6, 12, 12, 2, '#66847a', '#3c5752', 1.5);
    circle(ctx, x, y, size, material === 'iron' ? '#d0d8b9' : '#715f3d', '#3f4931', 1);
    line(ctx, [[x - 1.5, y - .5], [x + 1.5, y + .5]], '#566247', 1);
  }
  function drawBridge() {
    const mids = state.design.map((_, i) => ({ x: M.START + (i + .5) * M.SPAN, y: TRUSS + (nodeSag(i) + nodeSag(i + 1)) * .5 }));
    // Lower chords automatically join adjacent trusses: their support is shared in the model.
    for (let i = 0; i < 4; i++) {
      if (i === state.broken || i + 1 === state.broken) continue;
      if (state.design[i] && state.design[i + 1]) {
        const material = state.design[i] === 'iron' && state.design[i + 1] === 'iron' ? 'iron' : 'wood';
        drawBeam(mids[i].x, mids[i].y, mids[i + 1].x, mids[i + 1].y, material);
      } else if (state.phase === 'build') {
        line(ctx, [[mids[i].x, mids[i].y], [mids[i + 1].x, mids[i + 1].y]], '#c5d5ad55', 1, [4, 6]);
      }
    }
    for (let i = 0; i < 5; i++) {
      if (i === state.broken) continue;
      const x = M.START + i * M.SPAN;
      const ly = ROAD + 7 + nodeSag(i), ry = ROAD + 7 + nodeSag(i + 1);
      const mid = mids[i], material = state.design[i];
      const hovered = state.phase === 'build' && state.hover === i;
      if (material) {
        polygon(ctx, [[x, ly], [mid.x, mid.y], [x + M.SPAN, ry]], material === 'iron' ? '#8cb3a21c' : '#ddc28a16');
        const ratio = state.run ? state.run.ratios[i] : 0;
        drawBeam(x + 1, ly, mid.x, mid.y, material, ratio);
        drawBeam(mid.x, mid.y, x + M.SPAN - 1, ry, material, ratio);
        drawBolt(mid.x, mid.y, material);
        if (state.run && state.run.damage[i] > .15 && material === 'wood') {
          line(ctx, [[x + 26, ly + 25], [x + 31, ly + 26], [x + 27, ly + 33], [x + 33, ly + 34]], '#6b402e', 1.8);
        }
      } else if (state.phase === 'build') {
        polygon(ctx, [[x + 4, ly + 4], [mid.x, mid.y - 1], [x + M.SPAN - 4, ry + 4]], hovered ? '#e9e7b724' : '#d7dfb40a');
        line(ctx, [[x + 4, ly + 4], [mid.x, mid.y], [x + M.SPAN - 4, ry + 4]], hovered ? '#f4eac9' : '#d2ddba8c', hovered ? 2.4 : 1.8, [5, 6]);
        circle(ctx, mid.x, mid.y, 5, '#719175', '#dce3bd99', 1.3);
        line(ctx, [[mid.x - 2.5, mid.y], [mid.x + 2.5, mid.y]], '#dce3bd', 1.2);
        line(ctx, [[mid.x, mid.y - 2.5], [mid.x, mid.y + 2.5]], '#dce3bd', 1.2);
      }
      if (hovered && material !== state.tool) {
        const canAfford = M.remaining(state.design) + (M.MATERIALS[material]?.cost || 0) >= M.MATERIALS[state.tool].cost;
        if (canAfford) {
          drawBeam(x + 1, ly, mid.x, mid.y, state.tool, 0, .42);
          drawBeam(mid.x, mid.y, x + M.SPAN - 1, ry, state.tool, 0, .42);
        }
      }
      if (hovered) {
        line(ctx, [[x + 12, ROAD - 10], [x + M.SPAN - 12, ROAD - 10]], '#ede4b3', 2);
      }
    }
    // Deck planks follow the deflected joints; a snapped span is visibly missing.
    for (let i = 0; i < 5; i++) {
      const x = M.START + i * M.SPAN;
      const y1 = ROAD + nodeSag(i), y2 = ROAD + nodeSag(i + 1);
      if (i === state.broken) continue;
      line(ctx, [[x, y1 + 5], [x + M.SPAN, y2 + 5]], '#52482e', 10);
      line(ctx, [[x, y1 + 3], [x + M.SPAN, y2 + 3]], '#ae8248', 5);
      for (let j = 0; j < 6; j++) {
        const f0 = j / 6, f1 = (j + 1) / 6;
        const left = lerp(x, x + M.SPAN, f0), right = lerp(x, x + M.SPAN, f1) - 1;
        const a = lerp(y1, y2, f0), b = lerp(y1, y2, f1);
        polygon(ctx, [[left, a - 4], [right, b - 4], [right, b + 2], [left, a + 2]], (i + j) % 3 === 0 ? '#d7af6d' : '#c6a060', '#77613b', .8);
        line(ctx, [[left + 4, a - 3], [right - 3, b - 3]], '#e6c889', .75);
      }
      if (state.design[i]) {
        drawBolt(x + 4, y1 + 7, state.design[i], 3);
        drawBolt(x + M.SPAN - 4, y2 + 7, state.design[i], 3);
      }
    }
    // Solid anchors on both banks. The uprights are survey stakes, not a magic support.
    [M.START - 5, M.END + 5].forEach((x, i) => {
      roundRect(ctx, x - 9, ROAD - 3, 18, 18, 2, '#66715a', '#3e503b', 1.5);
      circle(ctx, x - 3, ROAD + 2, 2, '#c3c3a0'); circle(ctx, x + 3, ROAD + 10, 2, '#c3c3a0');
      line(ctx, [[x + (i ? 8 : -8), ROAD], [x + (i ? 8 : -8), ROAD - 37]], '#675838', 5);
      line(ctx, [[x + (i ? 8 : -8), ROAD - 33], [x + (i ? 8 : -8), ROAD - 20]], '#e5c17b', 6);
    });
    if (state.phase === 'build' && !state.design.some(Boolean)) {
      roundRect(ctx, 419, 231, 213, 30, 15, '#eff0d8b8', '#83966c', 1);
      text(ctx, '↓  CLICK A BAY TO BRACE IT', 525, 250, 9.5, '#60724b', '700', 'center');
      line(ctx, [[525, 266], [525, 287]], '#788b5d', 1.2, [3, 3]);
    }
  }

  function drawGoblin() {
    const x = 218, y = ROAD + 7;
    const celebrating = state.phase === 'won';
    const sad = state.phase === 'lost' || state.phase === 'fall';
    const idle = reducedMotion ? 0 : Math.sin(state.clock * 2.5) * .65;
    ctx.save(); ctx.translate(x, y);
    ellipse(ctx, 0, 1, 22, 4, '#29422e2b');
    // Boots and overalls.
    roundRect(ctx, -12, -15, 10, 14, 3, '#3e4536', '#2c4130', 1.5);
    roundRect(ctx, 3, -15, 11, 14, 3, '#3e4536', '#2c4130', 1.5);
    ellipse(ctx, -8, -2, 9, 3.5, '#3c3f2f'); ellipse(ctx, 11, -2, 9, 3.5, '#3c3f2f');
    ctx.translate(0, idle);
    polygon(ctx, [[-13, -48], [12, -48], [19, -19], [-18, -19]], '#df9e45', '#334b32', 2);
    polygon(ctx, [[-5, -48], [4, -48], [9, -20], [-8, -20]], '#56674b');
    line(ctx, [[-14, -32], [16, -32]], '#f5d585', 4);
    line(ctx, [[-12, -47], [-13, -20]], '#f3d282', 3);
    line(ctx, [[10, -46], [14, -22]], '#f3d282', 3);
    // Pointed ears, broad nose, two slightly untrustworthy teeth.
    polygon(ctx, [[-13, -63], [-32, -68], [-23, -49], [-12, -48]], '#89ae57', '#344b32', 1.8);
    polygon(ctx, [[12, -63], [32, -69], [25, -49], [14, -48]], '#91b761', '#344b32', 1.8);
    polygon(ctx, [[-20, -58], [-28, -64], [-23, -53]], '#b7c77d');
    polygon(ctx, [[21, -58], [29, -65], [25, -54]], '#b7c77d');
    ellipse(ctx, 0, -58, 19, 20, '#a2c271');
    ctx.beginPath(); ctx.ellipse(0, -58, 19, 20, 0, 0, Math.PI * 2); ctx.strokeStyle = '#334b32'; ctx.lineWidth = 1.8; ctx.stroke();
    const blink = !sad && !celebrating && Math.sin(state.clock * .77) > .995;
    if (blink) {
      line(ctx, [[-12, -60], [-6, -59]], '#334b32', 1.7); line(ctx, [[6, -59], [12, -60]], '#334b32', 1.7);
    } else {
      ellipse(ctx, -8, -59, 4.5, 5, '#f6ecc6'); ellipse(ctx, 9, -59, 4.5, 5, '#f6ecc6');
      circle(ctx, -6, -59, 2, '#2c4330'); circle(ctx, 11, -59, 2, '#2c4330');
    }
    line(ctx, [[-13, -66], [-5, -64]], '#405434', 2.1); line(ctx, [[5, -64], [14, -66]], '#405434', 2.1);
    ellipse(ctx, 1, -53, 6, 4, '#88ab56');
    line(ctx, [[-7, -45], [0, sad ? -48 : -43], [9, -45]], '#334b32', 1.7);
    polygon(ctx, [[-5, -45], [-3, -40], [-1, -45]], '#f8e7b9');
    // Orange hard hat.
    ctx.beginPath(); ctx.ellipse(0, -72, 19, 12, 0, Math.PI, Math.PI * 2); ctx.lineTo(19, -70); ctx.lineTo(-19, -70); ctx.closePath();
    ctx.fillStyle = '#e5a33f'; ctx.fill(); ctx.strokeStyle = '#4e5430'; ctx.lineWidth = 2; ctx.stroke();
    roundRect(ctx, -23, -73, 47, 6, 2, '#efb44a', '#515831', 1.7);
    roundRect(ctx, -3, -86, 7, 16, 2, '#f3c465', '#aa803c', 1);
    line(ctx, [[-13, -80], [-12, -76]], '#f5cb6b', 1.5);
    // The clipboard is also his qualification.
    if (celebrating) {
      line(ctx, [[-15, -42], [-27, -63]], '#49643b', 8); line(ctx, [[16, -42], [30, -65]], '#49643b', 8);
      circle(ctx, -28, -64, 5, '#a1bd69', '#3e5435', 1.5); circle(ctx, 31, -66, 5, '#a1bd69', '#3e5435', 1.5);
      line(ctx, [[30, -68], [35, -90]], '#a8b79d', 5); line(ctx, [[31, -89], [36, -85], [41, -90]], '#b4c0a4', 4);
    } else if (sad) {
      line(ctx, [[-14, -41], [-21, -48], [-10, -67]], '#7e9f53', 8); circle(ctx, -10, -66, 6, '#a2bd69', '#3f5736', 1);
      line(ctx, [[14, -41], [23, -25]], '#829f53', 8);
      roundRect(ctx, 14, -31, 20, 25, 2, '#d4bb82', '#6b6640', 2);
    } else {
      line(ctx, [[-16, -41], [-20, -23]], '#8ba953', 8);
      line(ctx, [[15, -40], [22, -28]], '#8ba953', 8);
      ctx.save(); ctx.translate(25, -34); ctx.rotate(-.14);
      roundRect(ctx, -12, -17, 26, 32, 2, '#9d7944', '#525b39', 1.5);
      roundRect(ctx, -9, -13, 20, 25, 1, '#e8dfb9');
      line(ctx, [[-6, 5], [-2, -4], [2, 5], [7, -5]], '#809374', 1.2); line(ctx, [[-6, 5], [8, 5]], '#809374', 1);
      roundRect(ctx, -4, -18, 11, 5, 1, '#72846c');
      circle(ctx, -10, 3, 4, '#a1b765', '#566341', 1); ctx.restore();
    }
    ctx.restore();
  }

  function crate(c, x, y, size, label = false) {
    roundRect(c, x - size / 2, y - size / 2, size, size, 2, '#b49153', '#5b5232', 1.5);
    line(c, [[x - size * .35, y - size * .35], [x + size * .35, y + size * .35]], '#d4b06b', 4);
    line(c, [[x - size * .35, y + size * .35], [x + size * .35, y - size * .35]], '#d4b06b', 4);
    line(c, [[x - size / 2 + 3, y - size / 2 + 3], [x + size / 2 - 3, y - size / 2 + 3]], '#e3c180', 1);
    if (label) { roundRect(c, x - 9, y - 5, 18, 11, 1, '#e8ddb2', '#b09d66', .7); text(c, '↑↑', x, y + 3, 9, '#5e6a45', '700', 'center'); }
  }
  function turnip(c, x, y, size) {
    line(c, [[x, y - size / 2], [x - size * .5, y - size * 1.2]], '#65844b', 2);
    line(c, [[x, y - size / 2], [x + size * .6, y - size * 1.4]], '#6f8c4e', 2);
    line(c, [[x, y - size / 2], [x, y - size * 1.5]], '#8b9f55', 2);
    ellipse(c, x, y, size, size * .8, '#ddd5b8'); ellipse(c, x, y - size * .35, size * .88, size * .39, '#bfb798');
    line(c, [[x, y + size * .55], [x + 1, y + size * 1.12]], '#dfd8b6', 1.3);
  }
  function wheel(c, x, y, rotation) {
    circle(c, x, y, 13, '#526047', '#364c35', 3);
    circle(c, x, y, 9.5, '#c19c5a', '#a8874e', 2);
    for (let i = 0; i < 5; i++) {
      const a = rotation + i / 5 * Math.PI * 2;
      line(c, [[x, y], [x + Math.cos(a) * 8, y + Math.sin(a) * 8]], '#6b613b', 2);
    }
    circle(c, x, y, 3.5, '#e5cc86', '#626540', 1.5);
  }
  function drawCart(x, y, angle = 0, cargo = true) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (x < M.START - 30 || x > M.END + 30) ellipse(ctx, 0, -1, 57, 5, '#45533b22');
    const wheelAngle = x / 13;
    line(ctx, [[-36, -21], [35, -21]], '#4e5537', 5);
    wheel(ctx, -32, -11, wheelAngle); wheel(ctx, 32, -11, wheelAngle);
    if (cargo) {
      crate(ctx, -22, -55, 33, true);
      crate(ctx, 9, -59, 37, true);
      // An overfull sack, secured with the cheapest available rope.
      ctx.beginPath(); ctx.moveTo(26, -45); ctx.bezierCurveTo(18, -54, 24, -73, 33, -79);
      ctx.lineTo(30, -86); ctx.lineTo(44, -84); ctx.lineTo(41, -77);
      ctx.bezierCurveTo(52, -68, 58, -53, 49, -43); ctx.closePath(); ctx.fillStyle = '#aaa06a'; ctx.fill(); ctx.strokeStyle = '#555d3d'; ctx.lineWidth = 1.7; ctx.stroke();
      line(ctx, [[30, -78], [43, -76]], '#6d7645', 2); line(ctx, [[44, -71], [48, -55]], '#c4b77e', 2);
      // Turnips peeking from the top crate.
      [-23, -9, 7, 20].forEach((tx, i) => turnip(ctx, tx, -76 - (i % 2) * 5, 5.5));
      line(ctx, [[-38, -73], [-22, -43], [17, -45], [46, -82]], '#e0cd91', 1.5);
    }
    // Red-brown cart sides, rivets, planks, and a wonderfully unnecessary label.
    polygon(ctx, [[-49, -48], [47, -48], [42, -25], [-43, -25]], '#a95334', '#56492e', 2);
    line(ctx, [[-47, -40], [45, -40]], '#ca7950', 1.5);
    line(ctx, [[-44, -32], [43, -32]], '#864830', 1.3);
    line(ctx, [[-36, -47], [-33, -26]], '#d19f59', 5); line(ctx, [[33, -47], [31, -26]], '#d19f59', 5);
    [[-37, -45], [-34, -29], [33, -45], [31, -29]].forEach(([a, b]) => circle(ctx, a, b, 1.5, '#665b3d'));
    roundRect(ctx, -23, -44, 47, 15, 2, '#e2c287', '#caa468', 1);
    text(ctx, 'TURNIPS', .5, -33.5, 8.3, '#685a3a', '700', 'center');
    line(ctx, [[46, -29], [61, -27]], '#695d3a', 4);
    // Wheel hubs are in front of the side board.
    circle(ctx, -32, -11, 3.2, '#d3b374', '#59613e', 1); circle(ctx, 32, -11, 3.2, '#d3b374', '#59613e', 1);
    ctx.restore();
  }

  function drawSpeech() {
    const x = 53, y = 113, width = 247, height = 73;
    // A paper speech balloon, pinned near the engineer.
    polygon(ctx, [[205, y + height - 2], [226, 210], [235, y + height - 2]], '#f4efd7', '#819271', 1.2);
    roundRect(ctx, x, y, width, height, 8, '#f4efd7', '#819271', 1.2);
    line(ctx, [[209, y + height], [232, y + height]], '#f4efd7', 2);
    text(ctx, 'GRUB · CHIEF-ISH ENGINEER', x + 16, y + 20, 8, '#919775', '700');
    wrapped(ctx, state.speech, x + 16, y + 42, width - 29, 14.5, '#526341', 18);
    circle(ctx, x + width - 13, y + 13, 2.5, '#c9b67c');
  }
  function drawRiverMotion() {
    ctx.save(); ctx.globalAlpha = .27;
    for (let i = 0; i < 8; i++) {
      const y = 467 + i * 12 + Math.sin(state.clock * .8 + i) * 1.4;
      const x = 503 + i * 12 + Math.sin(state.clock * .5 + i * 2) * 18;
      line(ctx, [[x - 16, y], [x, y - 1], [x + 15, y]], '#d5ddbd', 1.2);
    }
    if (state.splash && state.fall) {
      const age = state.phase === 'fall' ? state.phaseTime : state.phaseTime + 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(state.fall.x, WATER + 3, 18 + i * 20 + (age % 2) * 14, 3 + i * 3, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#ecedc7'; ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawParticles() {
    state.particles.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.globalAlpha = clamp(p.life / Math.min(.6, p.maxLife), 0, 1);
      if (p.kind === 'beam') {
        roundRect(ctx, -p.size / 2, -3, p.size, 6, 1, p.color, '#5b5a3d', 1);
        line(ctx, [[-p.size / 2 + 3, -1], [p.size / 2 - 3, -1]], '#e0c58d', .7);
      } else if (p.kind === 'crate') crate(ctx, 0, 0, p.size);
      else if (p.kind === 'turnip') turnip(ctx, 0, 0, p.size);
      else if (p.kind === 'drop') ellipse(ctx, 0, 0, p.size * .65, p.size, p.color);
      else if (p.kind === 'confetti') { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); }
      else circle(ctx, 0, 0, p.size, p.color);
      ctx.restore();
    });
  }
  function drawFloatingCargo() {
    if (state.phase !== 'lost' || !state.fall) return;
    const x = state.fall.x;
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 35 + Math.sin(state.clock * .3 + i) * 7;
      const fy = WATER + 2 + i * 8 + Math.sin(state.clock * 1.6 + i) * 2;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(state.clock + i) * .1);
      turnip(ctx, 0, 0, 6);
      line(ctx, [[-12, 4], [-4, 4]], '#d0dbc080', 1); line(ctx, [[5, 4], [13, 4]], '#d0dbc080', 1); ctx.restore();
    }
    ctx.save(); ctx.translate(x + 57, WATER + 15 + Math.sin(state.clock * 1.2) * 1.5); ctx.rotate(.18);
    roundRect(ctx, -14, -4, 28, 7, 1, '#b87b48', '#6a6845', 1);
    line(ctx, [[-10, -1], [10, -1]], '#d3a669', 1); ctx.restore();
  }
  function drawOutcomeHeading() {
    if (state.phase !== 'won' && state.phase !== 'lost') return;
    const won = state.phase === 'won';
    const alpha = reducedMotion ? 1 : clamp(state.phaseTime * 1.7, 0, 1);
    ctx.save(); ctx.globalAlpha = alpha;
    text(ctx, won ? 'REMARKABLY, A BRIDGE.' : 'IT WAS ALMOST A BRIDGE.', 556, 105, 18, '#426249', '700', 'center', 'Georgia, serif');
    text(ctx, won ? 'One small crossing. One enormous ego.' : 'The creek is now 80% turnip.', 556, 124, 10, '#6d8462', 'italic', 'center', 'Georgia, serif');
    line(ctx, [[435, 137], [677, 137]], '#869d7177', 1);
    ctx.restore();
  }
  function render() {
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (state.shake > 0 && !reducedMotion) ctx.translate(Math.sin(state.clock * 70) * state.shake, Math.cos(state.clock * 91) * state.shake * .45);
    ctx.drawImage(background, 0, 0, W, H);
    drawRiverMotion(); drawFloatingCargo(); drawBridge();
    if (state.phase === 'fall') {
      if (!state.fall.splashed) drawCart(state.fall.x, state.fall.y, state.fall.rotation, false);
    } else if (state.phase !== 'lost') {
      const x = state.run ? state.run.x : M.CART_START;
      const sag = cartSag(x);
      const lean = Math.atan2(roadAt(x + 32) - roadAt(x - 32), 64);
      const bob = state.phase === 'run' && !reducedMotion ? Math.sin(state.run.x * .19) * .5 : 0;
      drawCart(x, ROAD - 6 + sag + bob, lean, true);
    }
    drawGoblin(); drawParticles(); drawSpeech(); drawOutcomeHeading();
    ctx.restore();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scaleX = canvas.width / W; scaleY = canvas.height / H;
    render();
  }
  function frame(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, .045);
    lastTime = timestamp;
    // A help sheet pauses the cart rather than silently testing behind the dialog.
    if (!$('help-dialog').open && !document.hidden) update(dt);
    render(); window.requestAnimationFrame(frame);
  }

  for (let i = 0; i < M.BUDGET; i++) $('budget-blocks').appendChild(document.createElement('i'));
  for (let i = 0; i < M.BAYS; i++) {
    const row = document.createElement('div'); row.className = 'stress-row';
    row.innerHTML = `<span class="stress-name">BAY ${i + 1}</span><div class="stress-bar"><div class="stress-fill"></div></div><span class="stress-number">0%</span>`;
    $('stress-list').appendChild(row);
  }
  toolButtons.forEach(button => button.addEventListener('click', () => chooseTool(button.dataset.tool)));
  bayButtons.forEach((button, index) => {
    button.addEventListener('click', () => build(index));
    button.addEventListener('contextmenu', event => { event.preventDefault(); build(index, true); });
    button.addEventListener('pointerenter', () => { if (state.phase === 'build') state.hover = index; });
    button.addEventListener('pointerleave', () => { if (state.hover === index) state.hover = -1; });
    button.addEventListener('focus', () => { if (state.phase === 'build') state.hover = index; });
    button.addEventListener('blur', () => { if (state.hover === index) state.hover = -1; });
  });
  $('undo-button').addEventListener('click', undo);
  $('clear-button').addEventListener('click', clearBridge);
  $('test-button').addEventListener('click', startTest);
  $('retry-button').addEventListener('click', () => { prepareAudio(); returnToBuild(); });
  $('rerun-button').addEventListener('click', startTest);
  $('abort-button').addEventListener('click', () => { prepareAudio(); returnToBuild(); });
  $('sound-button').addEventListener('click', () => {
    state.sound = !state.sound;
    if (audioMaster) audioMaster.gain.setTargetAtTime(state.sound ? 1 : 0, audio.currentTime, .02);
    $('sound-button').setAttribute('aria-pressed', String(state.sound));
    $('sound-button').setAttribute('aria-label', 'Sound effects');
    $('sound-button').title = state.sound ? 'Mute sound' : 'Enable sound';
    $('sound-button').querySelector('use').setAttribute('href', state.sound ? '#icon-sound' : '#icon-mute');
    if (state.sound) { prepareAudio(); tone(520, .13, 'triangle', .035); }
  });
  $('help-button').addEventListener('click', () => { prepareAudio(); $('help-dialog').showModal(); });
  $('help-done').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('click', event => {
    if (event.target === $('help-dialog')) {
      const r = $('help-dialog').getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('help-dialog').close();
    }
  });
  window.addEventListener('keydown', event => {
    if ($('help-dialog').open || event.altKey || event.metaKey) return;
    if (event.ctrlKey && event.key.toLowerCase() !== 'z') return;
    const target = event.target;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (event.repeat) {
      if (event.code === 'Space' || ['1', '2', '3', '4', '5', 'w', 'i', 'z', 'r'].includes(key)) event.preventDefault();
      return;
    }
    if (state.phase === 'build') {
      if (key === 'w' || key === 'i') { event.preventDefault(); chooseTool(key === 'w' ? 'wood' : 'iron'); }
      else if (/^[1-5]$/.test(key)) { event.preventDefault(); build(Number(key) - 1); }
      else if (key === 'z') { event.preventDefault(); undo(); }
      else if (event.code === 'Space') {
        // Space sends it even after clicking a bay. Enter activates focused build buttons.
        if (['help-button', 'sound-button'].includes(target.id)) return;
        event.preventDefault(); startTest();
      }
    } else if (key === 'r') { event.preventDefault(); prepareAudio(); returnToBuild(); }
  });
  document.addEventListener('visibilitychange', () => { lastTime = 0; accumulator = 0; });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('scene'));
  drawBackground(bg); updateBuildUI(); resize(); window.requestAnimationFrame(frame);
})();
