# Immersive Studio homepage

## Accepted direction

Nikita selected the Studio direction for its personality and immediate overview, then explicitly requested a working creative exploration instead of more mockups. The selected image is a palette/composition starting point, not a pixel-perfect constraint. Build and judge motion in the browser. Use LinkedIn for experience and link the current CV supplied by the user.

## Experience

The first desktop viewport introduces Nikita with monumental blue/orange typography, his existing illustrated portrait cut out against warm paper, a concise professional introduction, and visible CharGen and LOAF entry points. All project links work immediately.

Below this, a single native-scroll, sticky cinematic sequence expands the work to full bleed. Precisely aligned Sunburst sketch/finished artwork transitions introduce CharGen; image displacement and changing camera framing carry the visitor into LOAF. Chapter links let visitors jump within the sequence, and a skip link jumps to the About content. Each chapter explains the project and has a direct visit action. No wheel interception or scroll trapping.

Continue directly into a grounded professional biography, the small-experiment archive and contact links. Preserve every existing project/utility URL and the discoverable archive. Avoid unverified business metrics and model-ranking claims.

## Technical decisions

Retain semantic static HTML and the GitHub Pages root publishing contract. Vite is the development and bundling tool; GSAP handles scroll states; Motion powers the React Bits TiltedCard adaptation; a lazy-loaded Three.js module provides shader image transitions and depth-like pointer response. React is unnecessary for this static content. Ship built local assets in a dedicated assets/home-built directory. No backend or browser API credentials.

Full content remains readable with JavaScript disabled. Reduced-motion and an explicit motion toggle use a conventional static presentation. Small-screen layout adapts the overview and uses the same direct project access. Cap canvas pixel ratio, avoid persistent rendering outside the active section, handle unavailable/lost WebGL context, and clean up on page teardown. No auto-playing audio.

## Assets

Use WaveSpeed CLI with openai/gpt-image-2.5-sunburst/text-to-image and openai/gpt-image-2.5-sunburst/edit. Keep exact prompt/source provenance. Precisely edit the same geometry for the sketch-to-colour transition. Export responsive WebP. Use the existing portrait and LOAF artwork as identity references; keep Runbook as a small archive entry only. Track spending conservatively below USD 25, which is below the authorised GBP 25 cap.

## Acceptance

- Studio identity and two featured projects visible in the initial desktop viewport.
- Native scrolling produces an actual GPU-rendered transition sequence, with functioning chapter jumps, project visits and skip action.
- No hidden or unreachable essential content with reduced motion, without JavaScript, or without WebGL.
- Mobile layouts at 390px and desktop at 1440px have no horizontal overflow or clipped controls.
- All existing routes remain intact; focused and full existing tests pass after intentional homepage contract changes.
- Local production assets build and load; real browser shows no homepage runtime errors.
- Review and design QA complete; local preview remains available. Publication is separate.

## Latest user corrections

Runbook is a small experiment, not a featured project: exclude it from the overview, scroll tour and selected-work list. Use nikitavorontsov@hotmail.com for all homepage email links. Provide precise proof of component-source use. React Bits TiltedCard is adapted in src/reference-motion.mjs, with Motion 13.4.1 as a runtime dependency. See docs/reference-provenance.md for pinned upstream links and licence.

Final refinement: remove decorative eyebrows, tile categories, filler captions and the duplicate project index. Use project names and spacing for hierarchy. CharGen positioning now covers AI media creation and campaign management, verified against its current homepage, Campaign Studio and session-notes pages. See docs/chargen-content-sources.md.


## Final polish acceptance, 23 September 2026

The user rejected the falling-letter animation and supplied a screenshot of overlapping hero elements plus a current CV. The final opening has no entrance animation. Name, portrait and introductory copy occupy separate content-sized grid tracks; short and narrow windows can scroll instead of shrinking body copy or overlapping content. The desktop Studio overview remains one screen at common desktop sizes. A two-page PDF is supplied unchanged at `assets/home/Nikita-Vorontsov-CV.pdf`, with download links in the opening and About. Keep the custom scroll artwork sequence and subtle TiltedCard springs, honour motion preferences, and inspect intermediate widths and short heights.
