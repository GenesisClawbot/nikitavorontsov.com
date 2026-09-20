export const SETTINGS = Object.freeze({
  roundMs: 60_000,
  narrowAt: 640,
  narrowParticles: 28,
  wideParticles: 40,
  magnetRadius: 112,
  magnetForce: 760,
  baseDrift: 22,
  difficultyStep: 0.15,
  keyboardStep: 22,
});

const GLYPHS = ['{}', '<>', '01', '[]', '=>'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function targetFor(width, height) {
  const w = clamp(width * 0.27, 108, 190);
  const h = clamp(height * 0.18, 62, 96);
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function inTarget(particle, target) {
  return particle.x >= target.x && particle.x <= target.x + target.w
    && particle.y >= target.y && particle.y <= target.y + target.h;
}

function particleCount(width) {
  return width < SETTINGS.narrowAt
    ? SETTINGS.narrowParticles
    : SETTINGS.wideParticles;
}

function difficultyFor(score) {
  return Number((1 + Math.floor(score / 10) * SETTINGS.difficultyStep).toFixed(2));
}

function spawnParticle(state, random = state.random) {
  const edge = Math.floor(random() * 4);
  const along = random();
  const speed = SETTINGS.baseDrift * state.difficulty;
  const angle = random() * Math.PI * 2;
  let x;
  let y;

  if (edge === 0) {
    x = random() * state.width * 0.25;
    y = along * state.height;
  } else if (edge === 1) {
    x = state.width * (0.75 + random() * 0.25);
    y = along * state.height;
  } else if (edge === 2) {
    x = along * state.width;
    y = random() * state.height * 0.25;
  } else {
    x = along * state.width;
    y = state.height * (0.75 + random() * 0.25);
  }

  return {
    id: state.nextId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    glyph: GLYPHS[Math.floor(random() * GLYPHS.length)],
  };
}

function fillParticles(state, random = state.random) {
  const count = particleCount(state.width);
  state.particles = Array.from({ length: count }, () => spawnParticle(state, random));
}

export function createGame({ width, height, random = Math.random, best = 0 }) {
  const state = {
    width,
    height,
    random,
    phase: 'ready',
    score: 0,
    best,
    endsAt: 0,
    remainingMs: SETTINGS.roundMs,
    difficulty: 1,
    magnet: { x: width / 2, y: height * 0.82 },
    target: targetFor(width, height),
    particles: [],
    nextId: 1,
    capturedAt: Number.NEGATIVE_INFINITY,
  };

  fillParticles(state, random);
  return state;
}

export function startRound(state, now) {
  state.phase = 'playing';
  state.score = 0;
  state.endsAt = now + SETTINGS.roundMs;
  state.remainingMs = SETTINGS.roundMs;
  state.difficulty = 1;
  state.capturedAt = Number.NEGATIVE_INFINITY;
  fillParticles(state, state.random);
  return state;
}

export function setMagnet(state, x, y) {
  state.magnet.x = clamp(x, 0, state.width);
  state.magnet.y = clamp(y, 0, state.height);
  return state;
}

export function moveMagnet(state, dx, dy) {
  return setMagnet(state, state.magnet.x + dx, state.magnet.y + dy);
}

function bounce(particle, state) {
  if (particle.x <= 0) {
    particle.x = 0;
    particle.vx = Math.abs(particle.vx);
  } else if (particle.x >= state.width) {
    particle.x = state.width;
    particle.vx = -Math.abs(particle.vx);
  }

  if (particle.y <= 0) {
    particle.y = 0;
    particle.vy = Math.abs(particle.vy);
  } else if (particle.y >= state.height) {
    particle.y = state.height;
    particle.vy = -Math.abs(particle.vy);
  }
}

function attract(particle, state, dt) {
  const dx = state.magnet.x - particle.x;
  const dy = state.magnet.y - particle.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance > SETTINGS.magnetRadius) return;

  const acceleration = SETTINGS.magnetForce * (1 - distance / SETTINGS.magnetRadius);
  particle.vx += (dx / distance) * acceleration * dt;
  particle.vy += (dy / distance) * acceleration * dt;
}

export function stepGame(state, { now, dt, random = state.random }) {
  if (state.phase !== 'playing') return state;

  state.remainingMs = Math.max(0, state.endsAt - now);
  if (state.remainingMs === 0) {
    state.phase = 'ended';
    state.best = Math.max(state.best, state.score);
    return state;
  }

  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    attract(particle, state, dt);
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    bounce(particle, state);

    if (!inTarget(particle, state.target)) continue;

    const previousDifficulty = state.difficulty;
    state.score += 1;
    state.best = Math.max(state.best, state.score);
    state.difficulty = difficultyFor(state.score);
    state.capturedAt = now;

    if (state.difficulty !== previousDifficulty) {
      const ratio = state.difficulty / previousDifficulty;
      for (const existing of state.particles) {
        existing.vx *= ratio;
        existing.vy *= ratio;
      }
    }

    state.particles[index] = spawnParticle(state, random);
  }

  return state;
}

export function resizeGame(state, width, height) {
  state.width = width;
  state.height = height;
  state.target = targetFor(width, height);
  setMagnet(state, state.magnet.x, state.magnet.y);

  for (const particle of state.particles) {
    particle.x = clamp(particle.x, 0, width);
    particle.y = clamp(particle.y, 0, height);
  }

  const count = particleCount(width);
  if (state.particles.length > count) state.particles.length = count;
  while (state.particles.length < count) {
    state.particles.push(spawnParticle(state, state.random));
  }

  return state;
}
