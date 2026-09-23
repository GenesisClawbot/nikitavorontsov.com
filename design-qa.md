# Editorial homepage QA

Local verification: 23 September 2026. Compiled preview: http://127.0.0.1:5189/.
This supersedes the earlier three-column portrait opening.

## Composition

The opening now uses a restrained DM Sans introduction and one substantial real CharGen product preview. The floating cutout, generic slogan, condensed blue/orange title, skewed project cards and pointer tilt were removed. The portrait appears only in About. LOAF remains directly accessible as a smaller opening-footer link, while the custom artwork tour remains available below.

The title and copy stay stationary from first render. The only opening motion is a user-triggered 240ms crossfade between Writing and Review screenshots. Both images render during the transition; only the selected panel is exposed to assistive technology. Tab focus has an inset pale outline that is visible inside the clipped image container.

## Responsive evidence

Codex in-app browser, CSS pixels. Every row passed zero horizontal overflow, no intersection between the introduction and product preview or between the name and introductory copy, and no name overflow outside the introduction. The image aspect ratio stays 1.822 (1720/944).

| Viewport | Opening height | Result |
| --- | ---: | --- |
| 320 × 700 | 1057 | Pass |
| 390 × 844 | 1018 | Pass |
| 660 × 780 | 1060 | Pass |
| 768 × 1024 | 1060 | Pass |
| 900 × 900 | 1135 | Pass |
| 901 × 900 | 900 | Pass |
| 1024 × 768 | 768 | Pass |
| 1280 × 720 | 740 | Pass |
| 1440 × 900 | 900 | Pass |
| 1920 × 1080 | 1080 | Pass |
| 1280 × 500 | 740 | Pass |

The opening fits a normal tall desktop viewport. Narrow and short windows scroll rather than compressing content. Actual screenshots were inspected at 390, 660 and 1440px widths; the mobile tour, About, experiments and footer, and both desktop tour chapters were also inspected. The task outputs include editorial-desktop.png, editorial-mobile.png, editorial-tablet.png and editorial-geometry.json.

## Interaction checks

- Clicking Writing / Review preserves the preview dimensions. ArrowLeft and ArrowRight wrap; Home and End select the first and last view. Tab enters the selected panel, with the other panel hidden and inert.
- Crossfade DOM inspection confirmed both panels rendered simultaneously, the incoming image above the outgoing image, and the outgoing image hidden after completion.
- Motion off removes the WebGL canvas and cinematic layout, clears hidden/inert tour scenes, and switches product previews immediately. Motion on restores the tour.
- Desktop Three.js rendering and both chapter links work. The sketch slider's Home / End values are 0 / 100 after navigation settles. The manually chosen value remains stable.
- Mobile and short windows use ordinary scroll sections. About navigation, download links, experiment rows and contact layout remain readable.
- The name and body copy have no entrance animation or character splitting. Runbook is not featured in the opening or tour.
- Website mail links retain nikitavorontsov@hotmail.com. Both CV links retain their native download attribute.
- The unchanged supplied PDF has SHA-256 df6624859d40cb751950929ec04efee67c2a6c7d29288947082f067b5e708275. Independent review verified byte identity.
- No errors or warnings appeared in the compiled preview's browser console.

## Build and review

- Production build passes. Initial enhancement: 56.12kB gzip; deferred Three.js bundle: 141.91kB gzip.
- 242 existing site tests pass and 57 homepage local references resolve.
- Independent scoped code review found two issues: a fade-in instead of a crossfade, and a clipped tabpanel focus outline. Both were corrected and verified in the browser. The reviewer confirmed crossfade cancellation and rapid selection handling.
- No new production dependency was added. Two small first-party product screenshots replace the illustrative project cards in the opening. Asset provenance and current library use are documented without claiming removed React Bits adaptations remain active.

## Limits

These results cover the local compiled build, not a physical-device or cross-browser certification. OS-level reduced-motion emulation, forced GPU-context loss and a browser-wide JavaScript-disable run were not available; those static fallbacks were reviewed in code. Motion off and mobile/short-window modes were exercised.

The unchanged legacy release-check.mjs contains a whitespace-sensitive LOAF canonical assertion that already fails on the baseline's multiline tag. The actual canonical and routes were verified separately during the previous release. This unrelated checker remains unchanged.

Publication and exact public-file verification are recorded separately in the task's delivery notes.
