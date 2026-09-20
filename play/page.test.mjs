import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('./main.mjs', import.meta.url), 'utf8');
const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('page exposes the game, controls, live state, and release marker', () => {
  for (const text of [
    'token-herd-2026-08-24',
    'id="game"',
    'id="start"',
    'id="score"',
    'id="time"',
    'id="best"',
    'id="status"',
    'aria-live="polite"',
    'Move the magnet. Herd loose tokens into the context window.',
    'Maintained by Nikita Vorontsov. Built with AI.',
    'type="module" src="main.mjs"',
  ]) assert.ok(html.includes(text), `missing ${text}`);
});

test('page self-hosts its fonts without third-party requests', async () => {
  assert.equal(/https:\/\/fonts\.(?:googleapis|gstatic)\.com/.test(html), false);

  for (const path of [
    './fonts/bricolage-grotesque-latin.woff2',
    './fonts/public-sans-latin.woff2',
    './fonts/spline-sans-mono-latin.woff2',
  ]) {
    assert.ok(html.includes(path.slice(2)), `missing local font reference ${path}`);
    const font = await readFile(new URL(path, import.meta.url));
    assert.ok(font.byteLength > 1_000, `empty local font ${path}`);
  }
});

test('page declares its favicon without a missing asset request', () => {
  assert.ok(html.includes('<link rel="icon" href="data:,">'));
});

test('page and controller avoid forbidden user-facing punctuation', () => {
  assert.equal(html.includes('—'), false);
  assert.equal(js.includes('—'), false);
});

test('controller includes pointer, touch-compatible, keyboard, resize, storage, and fallback paths', () => {
  for (const text of [
    'pointermove', 'pointerdown', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', "event.key === 'Enter'", 'resize',
    'localStorage', 'getContext', 'fallback',
  ]) assert.ok(js.includes(text), `missing ${text}`);
});

test('controller re-emits repeated live-region messages', () => {
  assert.ok(js.includes("status.textContent = '';"));
  assert.ok(js.includes('window.setTimeout(() =>'));
});

test('controller shares a monotonic boot id across tabs without polling', () => {
  for (const text of [
    'data-boot-id="2026-08-24T03:29:00Z"',
    'document.documentElement.dataset.bootId',
    "window.addEventListener('storage'",
    'window.location.replace',
  ]) assert.ok(html.includes(text) || js.includes(text), `missing ${text}`);

  assert.equal(js.includes('window.fetch'), false);
  assert.equal(js.includes('window.setInterval'), false);
});

test('reduced motion removes nonessential effects', () => {
  assert.ok(html.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(js.includes('prefers-reduced-motion'));
});

test('homepage links to Token Herd with the approved copy', () => {
  assert.ok(home.includes('href="/play/"'));
  assert.ok(home.includes('Play Token Herd while your agent runs.'));
  assert.equal(home.includes('—'), false);
});
