# Goblinworks — A bridge too goblin

Open **index.html** directly in a modern browser. No server, build step, downloads, or internet connection are required.

Grub has five bridge bays, twelve bolts, and no qualifications. Reinforce the free road deck, then send a very full turnip cart across the ravine.

## Controls
- Choose **Timber** (2 bolts) or **Scrap iron** (3 bolts), then click a bridge bay.
- Click the same material again, or right-click a bay, to reclaim its full cost. Swapping materials also refunds the old truss.
- **W / I:** choose timber / iron.
- **1–5:** build in a bay.
- **Space:** test the bridge.
- **Z:** undo a construction decision.
- **R:** return to the workbench during or after a test.
- The **?** button opens instructions and pauses an active crossing.
- Sound is optional and only starts after interaction.

Construction affects the crossing deterministically. Iron carries more load; adjacent trusses share capacity; central spans see more stress. Brief overload causes flex, sustained overload causes breakage. There are several winning arrangements within the budget. A run takes about nine seconds; rebuilding preserves the design and identifies the failed bay.

## Implementation & checks
The game uses original Canvas 2D illustrations, HTML controls, and synthesized Web Audio effects. It has no browser dependencies. The available Three.js library is not used.

- `bridge-model.js`: pure load, budget, and fatigue model.
- `game.js`: interaction, animation, procedural scenery, and audio.
- `styles.css`: responsive layout, focus states, and reduced-motion styling.
- `tests/model.test.js`: budget, deterministic outcomes, timestep checks, and all affordable configurations.
- `tests/ui.test.js`: non-visual DOM smoke tests, using LinkeDOM and a mocked drawing context. These validate state transitions and finite drawing coordinates, not visual browser appearance.

With the development dependency installed, run `npm test`. The model-only tests also run without dependencies: `node --test tests/model.test.js`.
