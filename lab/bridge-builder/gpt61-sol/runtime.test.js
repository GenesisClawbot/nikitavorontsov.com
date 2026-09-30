'use strict';
// A headless JavaScript/DOM stub check, not a browser or visual inspection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture() {
  const drawing = {};
  const methods = ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'ellipse', 'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'setLineDash', 'drawImage', 'fillText', 'strokeText', 'clip'];
  for (const name of methods) drawing[name] = (...args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${name} received a non-finite coordinate`);
  };
  drawing.createLinearGradient = () => ({ addColorStop() {} });
  class Element {
    constructor(id = '') {
      this.id = id; this.textContent = ''; this.className = ''; this.style = {}; this.dataset = {};
      this.hidden = false; this.disabled = false; this.attributes = {}; this.listeners = {};
      this.width = 1120; this.height = 640;
      const element = this;
      this.classList = {
        toggle(name, force) {
          const names = new Set(element.className.split(/\s+/).filter(Boolean));
          const add = force === undefined ? !names.has(name) : force;
          if (add) names.add(name); else names.delete(name);
          element.className = Array.from(names).join(' '); return add;
        },
        add(name) { this.toggle(name, true); }, remove(name) { this.toggle(name, false); }
      };
    }
    querySelector() { if (!this.child) this.child = new Element(); return this.child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    fire(type, props = {}) {
      if (type === 'click' && this.disabled) return;
      const event = { target: this, button: 0, preventDefault() {}, ...props };
      for (const handler of this.listeners[type] || []) handler(event);
    }
    getContext() { return drawing; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 900 * 640 / 1120 }; }
    focus() { this.fire('focus'); }
    get offsetWidth() { return 250; }
  }
  const elements = {};
  for (const match of fs.readFileSync('index.html', 'utf8').matchAll(/id="([^"]+)"/g)) elements[match[1]] = new Element(match[1]);
  const tools = ['wood', 'iron', 'brace', 'erase'].map(tool => { const e = new Element(); e.dataset.tool = tool; return e; });
  const spans = Array.from({ length: 5 }, (_, i) => { const e = new Element(); e.dataset.span = String(i); return e; });
  const parent = new Element(); elements.gameCanvas.parentElement = parent;
  let raf, time = 0;
  const sandbox = {
    console, Math, document: {
      body: new Element(), getElementById: id => elements[id],
      querySelectorAll: selector => selector === '[data-tool]' ? tools : spans,
      createElement: () => new Element(), addEventListener() {}
    },
    matchMedia: () => ({ matches: true }), devicePixelRatio: 1,
    requestAnimationFrame: callback => { raf = callback; }, addEventListener() {}
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('bridge-core.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('game.js', 'utf8'), context);
  function advance(seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) { time += 1000 / 60; raf(time); } }
  function buildAll(deck, brace = false) {
    tools.find(e => e.dataset.tool === deck).fire('click'); spans.forEach(e => e.fire('click'));
    if (brace) { tools[2].fire('click'); spans.forEach(e => e.fire('click')); }
  }
  return { elements, tools, spans, advance, buildAll };
}
test('game initializes, builds, visibly tests, and advances through all three deliveries', () => {
  const f = fixture(), e = f.elements;
  assert.equal(e.budgetLeft.textContent, 16);
  assert.equal(e.testButton.disabled, false);
  f.buildAll('wood', true);
  assert.equal(e.budgetLeft.textContent, 1);
  assert.equal(f.spans[0].querySelector('b').textContent, '7t');
  e.testButton.fire('click');
  assert.equal(e.testButton.disabled, true);
  assert.equal(f.tools[0].disabled, true);
  f.advance(10);
  assert.equal(e.verdict.hidden, false); assert.equal(e.verdictTitle.textContent, 'IT HOLDS!');
  assert.equal(e.testButtonText.textContent, 'NEXT DELIVERY');
  e.testButton.fire('click');
  assert.equal(e.contractName.textContent, 'Anvil express'); assert.equal(e.budgetLeft.textContent, 21);
  f.buildAll('iron'); e.testButton.fire('click'); f.advance(10);
  assert.equal(e.verdictTitle.textContent, 'IT HOLDS!');
  e.testButton.fire('click');
  assert.equal(e.budgetLeft.textContent, 26);
  f.buildAll('iron', true); e.testButton.fire('click'); f.advance(10);
  assert.equal(e.verdictTitle.textContent, 'GOBLIN GENIUS.');
  assert.equal(e.testButtonText.textContent, 'ONE MORE ROUND');
  e.testButton.fire('click');
  assert.equal(e.contractName.textContent, 'The pickle run'); assert.equal(e.budgetLeft.textContent, 16);
});
test('a weak bridge crashes, repairs preserve choices, and erasing refunds everything', () => {
  const f = fixture(), e = f.elements;
  f.buildAll('wood');
  assert.equal(e.budgetLeft.textContent, 6);
  e.testButton.fire('click'); f.advance(6);
  assert.equal(e.verdictTitle.textContent, 'OH, PLANK.');
  assert.equal(e.testButtonText.textContent, 'PATCH & RETRY');
  assert.equal(e.verdict.hidden, false);
  e.testButton.fire('click');
  assert.equal(e.verdict.hidden, true); assert.equal(e.budgetLeft.textContent, 6);
  assert.equal(f.spans[0].querySelector('b').textContent, '3t');
  f.tools[2].fire('click'); f.spans.forEach(span => span.fire('click'));
  assert.equal(e.budgetLeft.textContent, 1);
  e.testButton.fire('click'); f.advance(10);
  assert.equal(e.verdictTitle.textContent, 'IT HOLDS!');
  e.clearButton.fire('click'); assert.equal(e.budgetLeft.textContent, 1);
  e.clearButton.fire('click'); assert.equal(e.budgetLeft.textContent, 16);
});
test('an empty blueprint can be tested and gives a clear gap failure', () => {
  const f = fixture(), e = f.elements;
  e.testButton.fire('click'); f.advance(5);
  assert.equal(e.verdictTitle.textContent, 'MIND THE GAP.');
  assert.match(e.buildHint.textContent, /needs a deck/);
  e.clearButton.fire('click');
  assert.equal(e.budgetLeft.textContent, 16); assert.equal(e.verdict.hidden, true);
});
