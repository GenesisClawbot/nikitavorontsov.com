# Playful portfolio restoration and portrait QA

Verified 23 September 2026 using the compiled local preview at http://127.0.0.1:5189/.

## Scope

The user clarified that their criticism concerned the abruptly cut portrait, not the colours or playful identity. The intervening editorial redesign has been reversed. Relative to approved commit 13ebb9f, implementation changes are limited to the hero portrait markup, frame CSS and portraitDepth() in the existing Motion controller, plus the generated bundle and social preview.

Original blue/orange Anton type, introductory copy, illustrated CharGen and LOAF panels, About copy, contact treatment and Three.js tour are restored. The supplied CV, Hotmail contact, accurate CharGen description and small Runbook placement remain intact. Dropping text and split-character entrances remain absent.

## Portrait correction

The portrait sits in a curved blue window, with an orange backing and raised front rim. Its image extends beyond the lower mask edge; the hard torso cut is concealed. Existing grid tracks remain separate, and the figure has explicit width so the absolutely positioned layers retain a visible size on tablet and phone.

On a fine pointer, Motion springs rotate the frame and shift the image within it. Coordinates are clamped and transforms remain small. Pointer leave/cancel returns the layers to rest. Motion off destroys spring values and listeners and removes inline transforms; the static frame remains. Touch and reduced-motion settings use that same static composition.

## Browser validation

All twelve sizes passed: no horizontal overflow, no name/portrait or portrait/introduction intersections, surname within its column, a non-zero portrait width, clipped image overflow, and the photo's straight bottom edge below the visible window.

| Viewport | Opening height | Portrait width |
| --- | ---: | ---: |
| 320 × 667 | 968 | 104 |
| 390 × 844 | 958 | 104 |
| 660 × 800 | 912 | 229 |
| 760 × 700 | 953 | 268 |
| 768 × 1024 | 1024 | 258 |
| 1000 × 800 | 984 | 300 |
| 1001 × 800 | 800 | 238 |
| 1024 × 768 | 768 | 243 |
| 1280 × 720 | 720 | 304 |
| 1440 × 900 | 900 | 342 |
| 1920 × 1080 | 1080 | 456 |
| 1024 × 500 | 648 | 243 |

Actual screenshots were inspected at desktop 1440px, tablet 660px and mobile 390px. The opening still fits one normal desktop viewport; small and short windows scroll naturally. Evidence is saved in the task outputs as playful-portrait-desktop.png, playful-portrait-tablet.png, playful-portrait-mobile.png and playful-portrait-geometry.json.

Pointer input was exercised in the browser: the frame produced a 3D rotation matrix and the photo a separate translation. Motion off cleared both and both project-tile transforms. The desktop tour renders a WebGL canvas and chapter navigation reaches CharGen and LOAF; scene copy remains stationary rather than dropping into place.

## Source, tests and review

- src/home.mjs, src/world.mjs, vite.config.mjs and package.json are byte-identical to approved commit 13ebb9f. Existing focus transfer, resize/toggle scene preservation, asynchronous renderer disposal, context-loss fallback and hash navigation are preserved.
- The CV matches the original PDF byte-for-byte, SHA-256 df6624859d40cb751950929ec04efee67c2a6c7d29288947082f067b5e708275.
- Independent scoped review found no high-confidence introduced lifecycle, Motion-off, pointer-range or source-preservation issue.
- Production build, all 242 site tests and 57 local-reference checks pass. Initial enhancement bundle: 64.18kB gzip; deferred Three.js bundle: 141.91kB gzip.
- No new production dependencies or generated images were needed. Reference provenance identifies the active React Bits adaptation, Motion usage and original portrait work.

## Limits

This is browser and source verification, not a physical-device or cross-browser certification. OS-level reduced-motion emulation and forced GPU-context loss were unavailable; their existing paths were reviewed. Motion off was exercised directly.

The unrelated legacy release-check.mjs has a whitespace-sensitive LOAF canonical assertion already failing on the baseline's multiline tag; it remains unchanged. Public deployment and exact resource verification are recorded separately in the task's release notes.
