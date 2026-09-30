'use strict';
// Non-visual DOM smoke checks. Canvas calls are validated, not rendered or visually inspected.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const root = path.join(__dirname, '..');
function boot() {
  const { window, document } = parseHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  let frame = null, time = 0, drawCalls = 0;
  const drawing = () => new Proxy({
    measureText: s => ({ width: s.length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        drawCalls++;
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `non-finite coordinate in ${String(key)}`);
      };
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  window.HTMLCanvasElement.prototype.getContext = drawing;
  window.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 560, width: 1000, height: 560 });
  window.matchMedia = () => ({ matches: false }); window.devicePixelRatio = 1;
  window.requestAnimationFrame = callback => { frame = callback; return 1; };
  window.ResizeObserver = class { observe() {} };
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  const dialog = document.getElementById('help-dialog');
  dialog.open = false; dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; };
  const context = vm.createContext(window);
  for (const file of ['bridge-model.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const click = element => element.dispatchEvent(new window.Event('click', { bubbles: true }));
  const id = name => document.getElementById(name);
  const bay = n => document.querySelector(`[data-bay="${n - 1}"]`);
  const ticks = n => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame(time); } };
  const key = (key, code, target = window) => {
    const e = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(e, { key, code, repeat: false, altKey: false, metaKey: false }); target.dispatchEvent(e);
  };
  return { window, document, id, bay, click, ticks, key, calls: () => drawCalls };
}
test('boots real HTML/JS, draws finite canvas commands, and supports refunds/undo', () => {
  const g = boot();
  assert.equal(g.id('budget-value').textContent, '12');
  assert.equal(g.id('budget-blocks').children.length, 12);
  assert.equal(g.id('stress-list').children.length, 5);
  assert.equal(g.id('build-panel').hidden, false);
  g.click(g.bay(1)); assert.equal(g.id('budget-value').textContent, '10');
  assert.ok(g.bay(1).classList.contains('wood'));
  g.click(g.id('iron-tool')); g.click(g.bay(1)); assert.equal(g.id('budget-value').textContent, '9');
  g.click(g.id('undo-button')); assert.equal(g.id('budget-value').textContent, '10');
  assert.ok(g.bay(1).classList.contains('wood'));
  g.click(g.id('clear-button')); assert.equal(g.id('budget-value').textContent, '12');
  g.ticks(3); assert.ok(g.calls() > 1000);
});
test('overspending is rejected and right-click returns the exact cost', () => {
  const g = boot(); g.click(g.id('iron-tool'));
  for (let i = 1; i <= 5; i++) g.click(g.bay(i));
  assert.equal(g.id('budget-value').textContent, '0');
  assert.ok(!g.bay(5).classList.contains('iron'));
  assert.match(g.id('scene-notice').textContent, /Not enough bolts/);
  g.bay(1).dispatchEvent(new g.window.Event('contextmenu', { cancelable: true }));
  assert.equal(g.id('budget-value').textContent, '3');
});
test('an all-wood test fails, restores the build, then an iron upgrade wins', () => {
  const g = boot(); for (let i = 1; i <= 5; i++) g.click(g.bay(i));
  g.click(g.id('test-button')); assert.equal(g.id('run-panel').hidden, false);
  assert.ok(g.bay(1).disabled); g.ticks(100);
  assert.ok(parseInt(g.id('progress-value').textContent) > 0);
  const before = g.id('budget-value').textContent; g.click(g.bay(3));
  assert.equal(g.id('budget-value').textContent, before);
  g.ticks(400); assert.equal(g.id('result-panel').hidden, false);
  assert.match(g.id('result-stamp').textContent, /GRAVITY/);
  assert.match(g.id('result-description').textContent, /Bay 3/);
  g.click(g.id('retry-button')); assert.equal(g.id('budget-value').textContent, '2');
  assert.ok(g.bay(3).classList.contains('was-broken'));
  g.click(g.id('iron-tool')); g.click(g.bay(3)); assert.equal(g.id('budget-value').textContent, '1');
  g.click(g.id('test-button')); g.ticks(620);
  assert.equal(g.id('result-panel').hidden, false);
  assert.match(g.id('result-stamp').textContent, /GOOD ENOUGH/);
  assert.match(g.id('scene-status').textContent, /CARGO DELIVERED/);
  assert.match(g.id('result-stat').textContent, /100/);
  assert.equal(g.id('attempt-counter').textContent, 'TEST 02');
});
test('keyboard shortcuts work after clicking a bay and help pauses the crossing', () => {
  const g = boot(); for (let i = 1; i <= 5; i++) g.key(String(i), `Digit${i}`);
  g.key('i', 'KeyI'); g.key('3', 'Digit3'); assert.equal(g.id('budget-value').textContent, '1');
  g.key(' ', 'Space', g.bay(3)); assert.equal(g.id('run-panel').hidden, false);
  g.ticks(80); const before = g.id('progress-value').textContent;
  g.click(g.id('help-button')); g.ticks(120); assert.equal(g.id('progress-value').textContent, before);
  g.click(g.id('help-done')); g.ticks(620); assert.match(g.id('scene-status').textContent, /CARGO DELIVERED/);
  g.key('r', 'KeyR'); assert.equal(g.id('build-panel').hidden, false);
  assert.equal(g.id('budget-value').textContent, '1');
});
