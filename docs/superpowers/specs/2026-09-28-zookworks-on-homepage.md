# ZOOKWORKS on the homepage

The user asked for it on 2026-09-28 ("Deffo add to homepage"). The game is live at `/zookworks/` and is not yet linked from the homepage.

## Brief

- **Audience:** visitors to the portfolio (hiring managers, peers, friends) who scroll from the hero into the work.
- **Job:** show that ZOOKWORKS exists and get people into it with one tap.
- **Proof:** real in-game frames, next to the claim they prove, and the real numbers (8 events, 28 challenges, 78 stars).
- **Primary action:** play in the browser.
- **Constraint:** the name is still pending a trade mark check, so the copy avoids "zook" and can take a rename.

## Round 1: where it sits

Artifact: https://claude.ai/artifact/4BdHtW8HmJ8sWPTJqWBttP

Each option is the real homepage with its own stylesheet and images, with only the ZOOKWORKS parts added. The scroll tour is shown in its still form.

| Option | What changes |
|---|---|
| A · Three tiles | A third project tile at the top (the grid was first built for three), plus a third tour chapter, "Built to wobble." |
| B · One big, two games | CharGen spans two rows on the left, and LOAF and ZOOKWORKS stack on the right, plus the chapter. |
| C · Swap with LOAF | ZOOKWORKS takes the second tile. LOAF keeps its tour chapter. |
| D · Its own hall | The top stays as it is. A full-width section in the game's own look (Night Hall frame, Archivo, orange) goes after the tour, with a play button and the real numbers. |

Defaults set for this round, which the user can overrule:
- **Tile art:** the sumo pair.
- **Chapter art:** the high-jump frame.
- **Copy:**
  - tile: "Build a robot. Teach it to walk.";
  - chapter headline: "Built to wobble.";
  - chapter button: "Build your first one";
  - option D's button: "Play in your browser".
- **Motion:** the chapter will join the WebGL scroll transition. That needs `home.mjs` and `world.mjs` to take any number of chapters instead of two.

### Round 1 picks

- **Layout: B, one big and two games [user].** CharGen spans two rows on the left, and LOAF and ZOOKWORKS stack on the right. The tour gains a ZOOKWORKS chapter.
- Everything else stays a default, and round 2 explores it.

## Round 2: inside option B

Artifact: https://claude.ai/artifact/1BzS2ib1kEh67izkC1zB7w

Variables:
- **Game-tile layout:** as in round 1, split (label panel beside the art), or taller tiles.
- **ZOOKWORKS tile art:** sumo pair, high jump, or Night Hall race.
- **Chapter headline:** "Built to wobble.", "Teach it to walk.", or "Legs optional."
- **Chapter art:** high jump, sumo, or Night Hall.

### Round 2 picks

The user delegated this round: "For next homepage rounds I trust you". All picks below are defaults the user can overrule.
- **Game tiles: split.** The words sit in a panel beside the art, on both LOAF and ZOOKWORKS. In B the game tiles are short, so this keeps the art whole and the label readable. On phones the two games stack as full-width rows.
- **Tile art: the sumo pair.** Bright, two robots in contest, and it sits well with the paper palette.
- **Chapter headline: "Teach it to walk."** "Built to wobble." echoed LOAF's "Highly unstable.", and this names the game's hook.
- **Chapter art: high jump.** The zook is on the right, which leaves the left for the copy. A paper wash under the copy keeps the ink title readable over the post.
- **Motion:** the WebGL tour takes three chapters (CharGen, LOAF, ZOOKWORKS). `home.mjs` and `world.mjs` now take the chapter list from the DOM instead of hard-coding two.

## Build check (2026-09-28, after code review)

A scoped code review found problems that my first check missed. They are fixed and re-verified:
- **Covered links.** The tile block overflowed the opening's fixed grid track and covered the opening foot and the tour's toolbar. The tile track itself now grows: 420 to 520px, 400px on short desktops and tablets, and auto on phones.
- **Phone sideways scroll.** The third chapter link made the phone toolbar scroll the page sideways. The toolbar is tighter at 420px and below.
- **Heading overflow.** ZOOKWORKS overflowed its panel between 761 and about 920px. It is now capped at 18cqi of its panel.
- **Wash.** The paper wash sat under the artwork in cinematic mode without WebGL. It is now at z-index 0.
- **Crop.** The crop put the robot under the copy on tall screens. It is now at 40% (52% on phones).
- **Focus ring.** Keyboard focus on the tiles was invisible (an older bug, fixed here too). The ring now sits on the tile surface.
- **Tour length** follows the chapter count (`--chapters`, set by home.mjs).
- **Timing.** The boundary offset scales with the count.
- **Chapter-nav clicks** without a matching scene fall back to the anchor jump.
- **Test.** The site test checks the tile's own href.

Verified in Chromium at 15 sizes (320×568, 360×740, 375×812, 390×844, 430×932, 761×900, 800×900, 820×1180, 900×800, 1000×800, 1024×768, 1100×800, 1280×720, 1440×900 and 1920×1080), and with WebGL disabled at every desktop size:
- no horizontal overflow;
- every tile heading and label fits;
- the scenic link, the motion toggle, all three chapter links and "Skip the tour" are hit-testable, with `elementFromPoint` returning the control itself;
- the tour stops on each chapter with the right scene visible;
- no console errors.

Site tests 243/243; the homepage link check passes.

Known trade-off of layout B: the tile block is taller than the old two-up row, so the lower game tile starts near the fold. Labels are top-aligned, so the name ZOOKWORKS is above the fold at the common desktop sizes.
