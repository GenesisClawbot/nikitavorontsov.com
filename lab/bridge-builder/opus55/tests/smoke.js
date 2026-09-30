// Headless smoke test of the full game UI: node tests/smoke.js
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const problems = [];
let nanCalls = 0;

function mockCtx(canvasEl) {
  const store = { lineWidth: 1, globalAlpha: 1 };
  const grad = {
    addColorStop(o, c) {
      if (!(o >= 0 && o <= 1)) problems.push('bad color stop offset ' + o);
      if (!/^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(String(c))) problems.push('bad color stop ' + c);
    }
  };
  const numeric = new Set(['moveTo', 'lineTo', 'arc', 'ellipse', 'fillRect', 'strokeRect', 'quadraticCurveTo', 'translate', 'scale', 'rotate', 'transform', 'setTransform', 'fillText', 'strokeText']);
  return new Proxy({}, {
    get(t, prop) {
      if (prop in store) return store[prop];
      if (prop === 'createLinearGradient') return (...a) => { if (a.some((v) => !Number.isFinite(v))) problems.push('NaN gradient'); return grad; };
      if (prop === 'createRadialGradient') return (...a) => { if (a[2] < 0 || a[5] < 0) throw new Error('IndexSizeError radial'); return grad; };
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if (prop === 'canvas') return canvasEl;
      if (prop === 'getLineDash') return () => [];
      return function (...args) {
        if ((prop === 'arc' && args[2] < 0) || (prop === 'ellipse' && (args[2] < 0 || args[3] < 0))) {
          throw new Error('IndexSizeError: negative radius in ' + prop + ' ' + args.join(','));
        }
        if (numeric.has(prop)) {
          const nums = prop === 'fillText' || prop === 'strokeText' ? args.slice(1, 3) : args;
          if (nums.some((v) => typeof v === 'number' && !Number.isFinite(v))) { nanCalls++; if (nanCalls < 5) problems.push('non-finite arg in ' + prop + ': ' + args.join(',')); }
        }
      };
    },
    set(t, prop, v) {
      if ((prop === 'fillStyle' || prop === 'strokeStyle') && typeof v === 'string' && !/^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(v)) problems.push('odd colour ' + v);
      store[prop] = v; return true;
    }
  });
}

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = String(e && e.message); if (!/Not implemented/.test(m)) problems.push('jsdomError: ' + m); });
vc.on('error', (...a) => problems.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'file://' + path.join(root, 'index.html'),
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return this._ctx || (this._ctx = mockCtx(this)); };
    window.requestAnimationFrame = () => 0;
    window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function () {};
  }
});

function assert(c, msg) { if (!c) { problems.push('ASSERT: ' + msg); } }

dom.window.addEventListener('load', () => {
  const w = dom.window;
  const G = w.__grubnik;
  if (!G) { console.log('game did not boot', problems); process.exit(1); }
  const S = G.S;
  const tick = (n) => { for (let i = 0; i < n; i++) { G.update(1 / 60); G.render(); } };
  const key = (k) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const canvas = w.document.getElementById('game');
  function ptr(type, wx, wy, button) {
    const lx = wx * S.cam.s + S.cam.tx, ly = wy * S.cam.s + S.cam.ty;
    const Ev = w.PointerEvent || w.MouseEvent;
    canvas.dispatchEvent(new Ev(type, { clientX: lx, clientY: ly, button: button || 0, bubbles: true }));
  }
  const click = (x, y, b) => { ptr('pointermove', x, y, b); ptr('pointerdown', x, y, b); ptr('pointerup', x, y, b); };

  tick(5);
  assert(S.mode === 'title', 'starts on title, got ' + S.mode);
  key('Enter'); tick(2);
  assert(S.mode === 'intro', 'intro after Enter, got ' + S.mode);
  key('Enter'); tick(2);
  assert(S.mode === 'build', 'build after Enter, got ' + S.mode);

  // Build level 1 napkin design by real clicks: chain road across, then two struts
  click(8, 0); click(10, 0); click(12, 0); click(14, 0); click(14, 0); // last click on same point stops chain
  assert(S.design.beams.length === 3, 'three planks by chaining, got ' + S.design.beams.length);
  assert(S.drawStart == null, 'chain stopped');
  key('2');
  click(8, 2); click(10, 0); ptr('pointerdown', 0, 0, 2); // right-click cancels chain
  assert(S.drawStart == null, 'right click cancels');
  // drag-to-build second strut
  ptr('pointermove', 14, 2); ptr('pointerdown', 14, 2); ptr('pointermove', 12.2, 0.1); ptr('pointerup', 12, 0);
  assert(S.design.beams.length === 5, 'five beams after struts, got ' + S.design.beams.length);
  // invalid: too long plank
  key('1'); click(8, 0); click(11, -1);
  assert(S.design.beams.length === 5, 'too-long beam rejected');
  key('Escape');
  // invalid: into rock
  key('2'); click(8, 2); click(7, 3);
  assert(S.design.beams.length === 5, 'rock beam rejected');
  key('Escape');
  // demolish + undo
  key('x'); click(11, 0);
  assert(S.design.beams.length === 4, 'smashed one beam, got ' + S.design.beams.length);
  key('x'); key('z');
  assert(S.design.beams.length === 5, 'undo restored, got ' + S.design.beams.length);
  // clicking an existing, unreachable bolt while chaining re-selects it
  key('2'); click(8, 2); click(14, 2);
  const a14 = G.pointAt(14, 2);
  assert(a14 && S.drawStart === a14.id, 're-select unreachable bolt as new start');
  key('Escape');
  assert(S.design.beams.length === 5, 'no stray beams from re-select, got ' + S.design.beams.length);
  key('h'); tick(10); key('h');
  tick(30);

  // GO
  key(' '); tick(1);
  assert(S.mode === 'test', 'test mode after space, got ' + S.mode);
  let n = 0;
  while (S.mode === 'test' && n < 60 * 30) { tick(1); n++; }
  assert(S.mode === 'result', 'result reached, got ' + S.mode);
  assert(S.lastSuccess === true, 'level 1 napkin design succeeds in game');
  tick(120);
  // retry keeps design
  key('r'); tick(2);
  assert(S.mode === 'build' && S.design.beams.length === 5, 'retry returns to build with design');

  // timer auto launch
  S.timer = 0.01; tick(2);
  assert(S.mode === 'test', 'timer auto-launches test, got ' + S.mode);
  key('r'); tick(1);
  assert(S.mode === 'build', 'R during test goes back');

  // failure path: clear and go
  w.document.getElementById('btnClear').click(); tick(1);
  assert(S.design.beams.length === 0, 'clear works');
  key(' ');
  n = 0; while (S.mode === 'test' && n < 60 * 30) { tick(1); n++; }
  assert(S.mode === 'result' && S.lastSuccess === false, 'empty bridge fails');
  tick(200);
  const panelText = w.document.getElementById('panel').textContent;
  assert(/retry/i.test(panelText), 'fail panel offers retry');
  key('Enter'); tick(1);
  assert(S.mode === 'build', 'Enter on fail retries');
  key('z'); tick(1);
  assert(S.design.beams.length === 5, 'undo after clear restores bridge, got ' + S.design.beams.length);

  // Play remaining levels with napkin designs via API, check success & flow to victory
  for (let li = 0; li < 3; li++) {
    if (li > 0) {
      assert(S.mode === 'intro' && S.li === li, 'intro of level ' + (li + 1) + ' got ' + S.mode + ' ' + S.li);
      key('Enter'); tick(1);
      for (const s of S.level.napkin) {
        const [mat, x1, y1, x2, y2] = s;
        S.mat = mat;
        const start = G.pointAt(x1, y1) || G.pointAt(x2, y2);
        const other = start.x === x1 && start.y === y1 ? [x2, y2] : [x1, y1];
        const r = G.tryAddBeam(start, other[0], other[1], mat);
        assert(r.ok, 'napkin beam placed L' + (li + 1) + ' ' + s.join(',') + ' ' + r.reason);
      }
    }
    key(' ');
    n = 0; while (S.mode === 'test' && n < 60 * 30) { tick(1); n++; }
    assert(S.mode === 'result' && S.lastSuccess, 'level ' + (li + 1) + ' napkin success in game');
    tick(30);
    key('Enter'); tick(2);
  }
  assert(S.mode === 'victory', 'victory reached, got ' + S.mode);
  tick(60);
  key('Enter'); tick(2);
  assert(S.mode === 'intro' && S.li === 0, 'play again goes to level 1 intro');
  key('m'); key('m');

  console.log('frames ok; mode', S.mode, 'nan calls', nanCalls);
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('SMOKE OK');
  process.exit(0);
});
