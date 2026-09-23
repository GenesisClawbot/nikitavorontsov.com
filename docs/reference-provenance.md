# Reference use and implementation evidence

Updated 23 September 2026 for the editorial opening correction.

## Active implementation

| Source | Visible use | Implementation |
| --- | --- | --- |
| [Motion](https://github.com/motiondivision/motion) | Manual Writing / Review image crossfade | `src/project-preview.mjs` imports `animate` from `motion/mini`. Installed version 13.4.1 is pinned in the lockfile. Both images stay rendered during the 240ms transition; inactive content is hidden from assistive technology. Completion, rapid selection and Motion off settle the selected view. |
| [Three.js](https://github.com/mrdoob/three.js) | Custom sketch-to-colour artwork and refractive chapter transition | `src/world.mjs`, loaded near the tour on larger screens. |
| [GSAP](https://github.com/greensock/GSAP) | Scroll progress and scene visibility | `src/home.mjs`. The outgoing text disappears before the next appears. No vertical text entrance. |

The opening is semantic static HTML and CSS. Its name and copy are stationary from first render. Mobile and short windows use ordinary scroll sections. Motion off also disables the cinematic tour and changes product views immediately. Reduced-motion preferences use the same static behaviour.

## Suggested libraries: what was retained

The first exploration inspected the user's references but contained no adapted components. A later iteration adapted [React Bits TiltedCard](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/content/Components/TiltedCard/TiltedCard.jsx) and SplitText. Both adaptations have now been removed following the user's feedback. There is no active React Bits component or pointer-tilt code. Its retained licence file documents that history, not current component use.

Motion is the one active library from the user's suggested list. React Spring, Anime.js, Kokonut UI, transitions.dev, Motion Primitives and 21st.dev are not used. Inspecting a reference is not implementation evidence.

## Real product imagery

The opening shows first-party screenshots already published on [CharGen's Campaign Studio page](https://char-gen.com/campaign-studio), retrieved 23 September 2026:

- [Writing workspace](https://char-gen.com/landing/campaign-studio/studio-writing.webp): copied unchanged to `assets/home/chargen-studio.webp`.
- [Review desk](https://char-gen.com/landing/campaign-studio/studio-review.webp): copied unchanged to `assets/home/chargen-review.webp`.

Both are 1720 × 944. They are actual public product screenshots, not generated interface mockups. The Campaign Studio label identifies the pictured feature; the caption describes CharGen's broader AI creation and campaign-management platform. Source URLs and checksums are also recorded in `docs/homepage-assets.json`.

The dragon and cat images in the optional scroll tour are portfolio artwork created with Sunburst through WaveSpeed. Their original prompts remain in the asset manifest. No new image-generation credits were spent on this correction.

## Inspect the proof

1. Open `src/project-preview.mjs` and verify the Motion import, opacity animation, cancellation and keyboard handlers.
2. Switch Writing / Review with click, arrow keys, Home or End. The preview keeps its dimensions.
3. Tab into the selected image: its inset focus ring is visible. Only the selected panel is accessible.
4. Toggle Motion off: image changes are immediate and the tour returns to ordinary sections.
5. The opening contains no portrait, SplitText wrappers, animated typography, skewed cards or tilted surfaces.

Runbook remains a small experiment. LOAF is directly linked in the opening footer and has a tour chapter. Website email links use `nikitavorontsov@hotmail.com`. The supplied CV remains unchanged and is linked from the opening and About; its original contact details remain inside the PDF.
