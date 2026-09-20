import {
  SETTINGS,
  createGame,
  moveMagnet,
  resizeGame,
  setMagnet,
  startRound,
  stepGame,
} from './game.mjs';

const BOOT_ID = document.documentElement.dataset.bootId;
const BOOT_STORAGE_KEY = 'token-herd-boot-id';

function hardReload(nextBootId) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('boot') === nextBootId) return;
  url.searchParams.set('boot', nextBootId);
  window.location.replace(url);
}

try {
  const latestBootId = window.localStorage.getItem(BOOT_STORAGE_KEY);
  if (latestBootId && latestBootId > BOOT_ID) {
    hardReload(latestBootId);
  } else if (!latestBootId || BOOT_ID > latestBootId) {
    window.localStorage.setItem(BOOT_STORAGE_KEY, BOOT_ID);
  }
} catch {
  // A blocked local store does not block the game.
}

window.addEventListener('storage', (event) => {
  if (event.key === BOOT_STORAGE_KEY && event.newValue > BOOT_ID) {
    hardReload(event.newValue);
  }
});

const loadedUrl = new URL(window.location.href);
if (loadedUrl.searchParams.get('boot') === BOOT_ID) {
  loadedUrl.searchParams.delete('boot');
  window.history.replaceState(null, '', loadedUrl);
}

const canvas = document.querySelector('#game');
const start = document.querySelector('#start');
const score = document.querySelector('#score');
const time = document.querySelector('#time');
const best = document.querySelector('#best');
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const STORAGE_KEY = 'token-herd-best-v1';

let context = null;
try {
  context = canvas.getContext('2d');
} catch {
  context = null;
}

if (!context) {
  fallback.hidden = false;
  start.disabled = true;
  status.textContent = 'Playfield unavailable.';
} else {
  boot(context);
}

function readBest() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // A blocked local store does not block the game.
  }
}

function reducedMotionPreference() {
  if (typeof window.matchMedia !== 'function') return { matches: true };
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return { matches: true };
  }
}

function boot(ctx) {
  const motion = reducedMotionPreference();
  let reduceEffects = motion.matches;
  let state;
  let pointerInside = false;
  let lastFrame = performance.now();
  let lastMilestone = 0;
  let storedBest = readBest();
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;
  let pendingAnnouncement;

  function announce(message) {
    window.clearTimeout(pendingAnnouncement);
    if (status.textContent === message) {
      status.textContent = '';
      pendingAnnouncement = window.setTimeout(() => {
        status.textContent = message;
      }, 0);
      return;
    }
    status.textContent = message;
  }

  function updateReadout() {
    const seconds = Math.ceil(state.remainingMs / 1_000);
    score.textContent = String(state.score);
    time.textContent = String(seconds);
    best.textContent = String(state.best);

    if (state.best > storedBest) {
      storedBest = state.best;
      writeBest(storedBest);
    }
  }

  function sizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    const nextRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

    if (nextWidth === cssWidth && nextHeight === cssHeight && nextRatio === pixelRatio) return;

    cssWidth = nextWidth;
    cssHeight = nextHeight;
    pixelRatio = nextRatio;
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (state) resizeGame(state, cssWidth, cssHeight);
  }

  sizeCanvas();
  state = createGame({ width: cssWidth, height: cssHeight, best: storedBest });
  updateReadout();

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = '#26352C';
    ctx.lineWidth = 1;
    ctx.globalAlpha = .62;
    const spacing = cssWidth < 640 ? 32 : 40;

    ctx.beginPath();
    for (let x = spacing + .5; x < cssWidth; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssHeight);
    }
    for (let y = spacing + .5; y < cssHeight; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(cssWidth, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTarget(now) {
    const target = state.target;
    const captured = now - state.capturedAt < 170;

    ctx.save();
    ctx.fillStyle = captured ? 'rgba(143, 100, 0, .52)' : 'rgba(47, 107, 82, .30)';
    ctx.strokeStyle = captured ? '#E8B854' : '#86C7A4';
    ctx.lineWidth = captured ? 3 : 2;
    ctx.fillRect(target.x, target.y, target.w, target.h);
    ctx.strokeRect(target.x + .5, target.y + .5, target.w - 1, target.h - 1);

    ctx.fillStyle = '#F1EBDD';
    ctx.font = '600 11px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONTEXT WINDOW', target.x + target.w / 2, target.y + target.h / 2);

    if (captured) {
      ctx.strokeStyle = '#F1EBDD';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(target.x + target.w / 2, target.y + target.h / 2, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(particle) {
    ctx.save();

    if (!reduceEffects && state.phase === 'playing') {
      ctx.strokeStyle = 'rgba(134, 199, 164, .22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * .18, particle.y - particle.vy * .18);
      ctx.stroke();
    }

    ctx.fillStyle = '#F1EBDD';
    ctx.font = '600 13px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(particle.glyph, particle.x, particle.y);
    ctx.restore();
  }

  function drawMagnet(now) {
    const pulse = reduceEffects || state.phase !== 'playing'
      ? 0
      : Math.sin(now / 220) * 3;

    ctx.save();
    ctx.strokeStyle = '#D7A83F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.magnet.x, state.magnet.y, 18 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F1EBDD';
    ctx.beginPath();
    ctx.arc(state.magnet.x, state.magnet.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(215, 168, 63, .23)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(state.magnet.x, state.magnet.y, SETTINGS.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw(now) {
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#121814';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    drawGrid();
    drawTarget(now);
    for (const particle of state.particles) drawParticle(particle);
    drawMagnet(now);
  }

  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1_000));
    lastFrame = now;

    if (state.phase === 'playing') {
      const previousPhase = state.phase;
      stepGame(state, { now, dt });

      const milestone = Math.floor(state.score / 10) * 10;
      if (milestone > lastMilestone) {
        lastMilestone = milestone;
        announce(`${milestone} tokens filed. Drift increased.`);
      }

      if (previousPhase === 'playing' && state.phase === 'ended') {
        announce(`Round ended. Score ${state.score}. Local best ${state.best}.`);
        start.textContent = 'Play another round';
      }
      updateReadout();
    }

    draw(now);
    window.requestAnimationFrame(frame);
  }

  function beginRound() {
    const now = performance.now();
    startRound(state, now);
    lastFrame = now;
    lastMilestone = 0;
    start.textContent = 'Restart round';
    announce('Round started. 60 seconds.');
    updateReadout();
    canvas.focus({ preventScroll: true });
  }

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (state.width / bounds.width),
      y: (event.clientY - bounds.top) * (state.height / bounds.height),
    };
  }

  function applyPointer(event) {
    const point = pointFromEvent(event);
    setMagnet(state, point.x, point.y);
  }

  start.addEventListener('click', beginRound);

  canvas.addEventListener('pointerdown', (event) => {
    pointerInside = true;
    applyPointer(event);
    canvas.focus({ preventScroll: true });
    if (typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional. Movement still works inside the canvas.
      }
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pointerInside || event.pointerType === 'mouse') applyPointer(event);
  });

  canvas.addEventListener('pointerenter', () => { pointerInside = true; });
  canvas.addEventListener('pointerleave', () => { pointerInside = false; });
  canvas.addEventListener('pointercancel', () => { pointerInside = false; });
  canvas.addEventListener('lostpointercapture', () => { pointerInside = false; });

  canvas.addEventListener('keydown', (event) => {
    const movements = {
      ArrowLeft: [-SETTINGS.keyboardStep, 0],
      ArrowRight: [SETTINGS.keyboardStep, 0],
      ArrowUp: [0, -SETTINGS.keyboardStep],
      ArrowDown: [0, SETTINGS.keyboardStep],
    };

    if (event.key in movements) {
      event.preventDefault();
      moveMagnet(state, ...movements[event.key]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      beginRound();
    }
  });

  if (typeof window.ResizeObserver === 'function') {
    const observer = new ResizeObserver(sizeCanvas);
    observer.observe(canvas);
  } else {
    window.addEventListener('resize', sizeCanvas, { passive: true });
  }

  if (typeof motion.addEventListener === 'function') {
    motion.addEventListener('change', (event) => { reduceEffects = event.matches; });
  }

  window.requestAnimationFrame(frame);
}
