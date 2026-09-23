# Reference use and implementation evidence

Updated 23 September 2026 after the final motion correction.

The first preview used custom Three.js shaders and GSAP ScrollTrigger. It inspected the suggested sources but contained no adapted components from them. Reference inspection alone is not component use.

## Active reference use

| Source | Visible use | Implementation | Retained and changed |
| --- | --- | --- | --- |
| [React Bits TiltedCard](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/content/Components/TiltedCard/TiltedCard.jsx) | Subtle pointer-responsive depth on CharGen and LOAF tiles | `src/reference-motion.mjs`, `tiltedCard()` | Retains centre-normalised pointer-to-rotation mapping and spring damping 30 / stiffness 100 / mass 2. Uses vanilla Motion springs instead of React hooks. Tilt is reduced to 3 degrees and scale to 1.015. Ordinary semantic links, no tooltip or touch warning. |
| [Motion](https://github.com/motiondivision/motion) | Spring engine for those two tiles | `import { springValue, styleEffect } from "motion"` | Installed version 13.4.1 is recorded in the lockfile. Uses the documented vanilla spring API, not just visual inspiration. |

The React Bits source is pinned to commit `c5df8610c0b47d7cd805cda480baba402f7267c1`, with its licence included at `assets/home/licenses/react-bits.md`. This is a DOM adaptation, not an unchanged React component. Motion's licence is included in its installed package and bundled distribution. The other six suggested libraries are not used.

The React Bits SplitText adaptation was subsequently removed at the user's explicit request. There is no letter splitting, falling text, opening timeline or replacement text entrance. The title and introductory copy are static from first render.

The Three.js sketch-to-colour reveal, camera drift and refractive transition are custom implementation in `src/world.mjs`. Scene text fades as a complete block without vertical movement; the outgoing title disappears before the next title appears. Mobile and short windows use ordinary scroll sections. Motion off also removes the cinematic tour and card springs. Reduced-motion preferences take the same static path.

## Inspect the proof

1. Compare `tiltedCard()` against the pinned upstream pointer formula and spring parameters.
2. Move the pointer across either featured tile with motion on; its inner surface tilts gently and returns on pointer exit.
3. Toggle Motion off: the springs are destroyed and the inner surfaces' transforms removed.
4. Reload with motion on: the name stays still. No SplitText import or character wrappers remain.

Runbook appears only in the small experiments list. The large portfolio features CharGen and LOAF. Website email links use `nikitavorontsov@hotmail.com`. The user-supplied CV is copied unchanged and linked as a PDF from the opening and About section; its original contact details remain inside the document.
