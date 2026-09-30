# Grubnik's Bridge of Questionable Integrity

A tiny goblin bridge-building game. Open `index.html` in a browser (works from `file://`, no network).

## How to play
- **Build (timed):** click a glowing bolt, then click grid points to lay beams (clicks chain; right-click / Esc stops; dragging also works).
  - `1` Plank - the only thing the cart can drive on
  - `2` Wood Beam - cheap support
  - `3` Iron Girder - strong, heavy, pricey
  - `4` Rope - only pulls; great from the towers
  - `X` smash mode (or right-click a beam), `Z` undo, `H` cousin Snazzgit's napkin sketch (a hint)
- **Test:** press `Space` / GO (or wait - the cart leaves when the timer runs out). Beams glow red under stress and snap when overloaded.
- **Result:** success or splash. `R` returns to building with your bridge intact; `Enter` continues.
- `M` toggles sound (audio only starts after your first click or key press).

Three levels: a light cabbage cart, the Chieftain's heavy anvils (with a troll tooth to build on), and Granny plus 40 cats over a 10 m gap with rope towers.

## Files
- `physics.js` - XPBD mass-spring bridge solver, cart, level data (DOM-free)
- `game.js` - canvas rendering, input, UI flow, goblin commentary, audio
- `style.css`, `index.html`, `assets/` (generated music, sound effects and voice lines)
- `tests/physics.test.js` - balance regression tests: `node --test`
- `tests/tune.js`, `tests/sweep.js`, `tests/players.js` - headless design sweeps (`node tests/sweep.js`)
- `tests/smoke.js` - full UI smoke test (needs `npm i jsdom`)
