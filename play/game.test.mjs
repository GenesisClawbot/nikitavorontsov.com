import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS, createGame, startRound, setMagnet, moveMagnet,
  stepGame, resizeGame,
} from './game.mjs';

const zero = () => 0;

function game(overrides = {}) {
  return createGame({ width: 800, height: 500, random: zero, ...overrides });
}

test('wide and narrow fields use the specified particle counts', () => {
  assert.equal(game().particles.length, 40);
  assert.equal(game({ width: 390 }).particles.length, 28);
});

test('capture feedback starts inactive before and after round start', () => {
  const state = game();
  assert.equal(state.capturedAt, Number.NEGATIVE_INFINITY);

  startRound(state, 1_000);
  assert.equal(state.capturedAt, Number.NEGATIVE_INFINITY);
});

test('startRound sets an exact wall-clock deadline', () => {
  const state = startRound(game(), 1_000);
  assert.equal(state.phase, 'playing');
  assert.equal(state.endsAt, 61_000);
  assert.equal(state.remainingMs, 60_000);
});

test('magnet force affects only particles inside its radius', () => {
  const state = startRound(game(), 0);
  setMagnet(state, 100, 100);
  state.particles = [
    { id: 1, x: 110, y: 100, vx: 0, vy: 0, glyph: '{}' },
    { id: 2, x: 500, y: 400, vx: 0, vy: 0, glyph: '<>' },
  ];
  stepGame(state, { now: 16, dt: 0.016, random: zero });
  assert.ok(state.particles[0].vx < 0);
  assert.equal(state.particles[1].vx, 0);
  assert.equal(state.particles[1].vy, 0);
});

test('capture increments once and replaces the token', () => {
  const state = startRound(game(), 0);
  state.particles = [{
    id: 7,
    x: state.target.x + state.target.w / 2,
    y: state.target.y + state.target.h / 2,
    vx: 0,
    vy: 0,
    glyph: '01',
  }];
  stepGame(state, { now: 16, dt: 0.016, random: zero });
  assert.equal(state.score, 1);
  assert.equal(state.particles.length, 1);
  assert.notEqual(state.particles[0].id, 7);
  stepGame(state, { now: 32, dt: 0.016, random: zero });
  assert.equal(state.score, 1);
});

test('difficulty changes only at ten-point boundaries', () => {
  const state = startRound(game(), 0);
  const capture = () => {
    state.particles = [{ id: state.nextId++, x: state.target.x + 2,
      y: state.target.y + 2, vx: 0, vy: 0, glyph: '{}' }];
    stepGame(state, { now: state.score + 1, dt: 0.001, random: zero });
  };
  for (let i = 0; i < 9; i += 1) capture();
  assert.equal(state.difficulty, 1);
  capture();
  assert.equal(state.difficulty, 1.15);
});

test('wall time ends a hidden-tab round', () => {
  const state = startRound(game(), 5_000);
  stepGame(state, { now: 65_001, dt: 0.016, random: zero });
  assert.equal(state.phase, 'ended');
  assert.equal(state.remainingMs, 0);
});

test('keyboard movement clamps the magnet and resize clamps particles', () => {
  const state = game();
  setMagnet(state, 799, 499);
  moveMagnet(state, 50, 50);
  assert.deepEqual(state.magnet, { x: 800, y: 500 });
  state.particles[0].x = 790;
  state.particles[0].y = 490;
  resizeGame(state, 320, 240);
  assert.ok(state.particles[0].x <= 320);
  assert.ok(state.particles[0].y <= 240);
  assert.equal(state.target.x + state.target.w / 2, 160);
});
