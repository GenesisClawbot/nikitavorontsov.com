# Homepage polish QA

Final local verification: 23 September 2026. Compiled preview: http://127.0.0.1:5189/.

## Corrections completed

The user-supplied screenshot exposed a real gap in the previous responsive checks: the absolutely positioned portrait could collide with viewport-sized headings and introductory copy. The hero now uses separate grid tracks, with content-driven minimum heights. Its responsive rules are consolidated; the former overlapping hero overrides are removed.

All opening entrance animation and SplitText code were removed. The opening title and copy are visible and stationary from first render. Remaining Motion springs use 3-degree tilt and scale 1.015. In the tour, the outgoing project fades out completely before the next appears; neither text block moves vertically. Three.js artwork still reveals colour and transitions between scenes.

The supplied two-page CV is linked from the opening and About with native download links. The file is unchanged, including its original contact details. Website mail links retain nikitavorontsov@hotmail.com. Mobile body copy and supporting controls use 14px text; the PDF and motion controls have 44px target heights. Small orange links now use a darker token: 5.16:1 on paper, compared with 3.64:1 before. The brighter orange remains for large display text.

## Responsive browser evidence

Codex in-app browser; dimensions are CSS pixels. Each row passed: no horizontal overflow, no intersection between header/name/portrait/intro/project overview, surname contained within its column, and zero SplitText character wrappers.

| Viewport | Opening height | Result |
| --- | ---: | --- |
| 320 x 667 | 968 | Pass |
| 390 x 844 | 958 | Pass |
| 660 x 800 | 912 | Pass |
| 760 x 700 | 953 | Pass |
| 768 x 1024 | 1024 | Pass |
| 1000 x 800 | 984 | Pass |
| 1001 x 800 | 800 | Pass |
| 1024 x 768 | 768 | Pass |
| 1280 x 720 | 720 | Pass |
| 1440 x 900 | 900 | Pass |
| 1326 x 1012 | 1012 | Pass |
| 1920 x 1080 | 1080 | Pass |
| 1024 x 500 | 648 | Pass |

The Studio overview fits one screen at the listed normal desktop sizes. Smaller/shorter windows can scroll instead of compressing or overlapping content. Actual visual inspections covered the desktop opening, phone opening, 660px opening, mobile CharGen tour, mobile About and desktop tour. Raw geometry measurements are saved in the task outputs as responsive-validation.json.

## Interaction and source verification

- CV: HTTP 200, application/pdf, 113930 bytes. SHA-256 matches the supplied original: df6624859d40cb751950929ec04efee67c2a6c7d29288947082f067b5e708275. pdfinfo parses two unencrypted pages.
- Both PDF links retain native download attributes and 44px heights.
- Three.js renders in desktop mode. Home/End on the sketch slider yields 0/100 and corresponding image clipping.
- PageDown from the focused CharGen action changes to LOAF and transfers keyboard focus to the LOAF chapter link. Scene copy transforms remain none.
- Motion off removes all WebGL canvases, cinematic layout, inert scene attributes and card transforms. Motion on restores the tour.
- Same-document chapter URL changes now resolve the matching scene. The earlier fonts-ready-only resolver missed these changes; hashchange support and teardown cleanup were added and verified in both directions.
- A 1024 x 500 window uses static 760px project sections with no inert scenes. Mobile uses ordinary 920px minimum sections, allowing readable text and controls.
- About navigation and CV/LinkedIn placement visually checked. Project and experiment destinations remain unchanged; Runbook remains outside featured work.
- No error or warning entries in the compiled homepage's browser console.
- Production build passes: initial enhancement 63.93kB gzip, deferred Three.js bundle 141.91kB gzip.
- All 242 existing site tests pass. 57 homepage local references resolve. JavaScript syntax and git diff whitespace checks pass.
- Independent scoped review found no defects in motion removal, spring cleanup or CV integrity. Final navigation/fade refinements were separately reviewed; the resulting breakpoint-continuity finding was fixed by preserving the visible static scene before entering cinematic mode. A 1024 x 600 LOAF view remained LOAF at 1024 x 800, on the reverse resize, and when expanding again to 1440 x 900. The final scoped re-review confirmed both cases resolved and found no new focus or state issues.

## Evidence limits

This is local browser and source verification, not production publication or a physical-device/browser-matrix certification. OS-level reduced-motion emulation and forced GPU-context loss were not available through these browser controls; those paths were reviewed in code. Motion off and mobile/short-window static modes were exercised. No browser-wide JavaScript-disable run was performed; semantic content remains in the static HTML.

The unchanged legacy release-check.mjs has a whitespace-sensitive LOAF canonical assertion that already fails on the baseline's multiline tag. Earlier independent HTTP checks confirmed the actual canonical and legacy routes. That unrelated checker remains unchanged.

Validation above covers the local build. Production publication is separate.
