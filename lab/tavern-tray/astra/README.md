# Mind the Pints

A little one-button Three.js game set in **The Crooked Wyvern**.

## Play

Open **index.html** directly in a modern WebGL2-capable browser. No server, build step, installation, or internet connection is needed.

- **Hold Space or the screen:** slow down, steady the tray, and squeeze past patrons.
- **Release:** hurry across the clear floor.
- Deliver the three enchanted drinks to **Table 13** before the 45-second bell.
- A fast, clean shift earns a bigger house tip. Best tips are saved locally when browser storage is available.
- On the receipt, press Space or tap for another round and a fresh crowd.
- The small speaker button toggles audio. Audio begins only after an interaction.

Rounds last about **30–45 seconds**. Holding throughout is too slow; rushing throughout is very bad for the carpet. A careful clean run takes about 42 seconds, and confident catches can bring that well under 38.

## Making of

The tavern, patrons, cups, expressive drinks, hands, and decorative details are procedural Three.js geometry. The wood grain and signs are drawn locally with Canvas. Furniture and the seated crowd use instanced meshes. The tray is rendered as a separate foreground scene so all three liquid levels stay readable on narrow screens.

The original tavern music and serving clinks are bundled in `assets/`. Additional footsteps, spills, and little reward tones use Web Audio. Three.js and its license are included locally.

## Checks

`node --test tests/*.test.js`

The tests cover round timing, deterministic crowds, recovery, contact behavior at different update rates, scoring, restarting, input, visibility handling, and scene construction/projection. Runtime tests use real Three.js math and geometry with a mocked DOM/GPU; they are structural tests, not visual browser approval.
