# nikitavorontsov.com

Static GitHub Pages site for Nikita Vorontsov. The root page is a small portfolio and the deployable LOAF build lives at `/loaf/`.

## Homepage development

```sh
npm ci
npm run dev -- --port 5188
npm run build
npm test
npm run check:links
```

The homepage remains semantic static HTML. Vite bundles the optional GSAP,
Motion and Three.js enhancements from `src/` into `assets/home-built/`.
Commit that generated directory with homepage changes: GitHub Pages serves the
repository root and does not run Vite. The build only empties its own output
directory, preserving LOAF and all existing experiment routes.

`assets/site.css` contains the homepage design; `src/home.mjs` coordinates the
two-chapter scroll sequence and motion preferences. WebGL is loaded near the tour
on larger screens. Mobile, reduced-motion and failed-WebGL paths keep ordinary
images and real links. Fonts, icons, artwork and compiled scripts are local.

`src/project-preview.mjs` controls the manual Writing / Review product views.
The opening uses actual public CharGen screenshots; the generated artwork stays
in the scroll tour. See [reference provenance](docs/reference-provenance.md) for
active Motion usage, removed experiments and image sources, and
[design QA](design-qa.md) for validation.

Generated image originals can be exported using:
`node scripts/prepare-home-assets.mjs /path/to/originals`.
Source prompts and output URLs are documented in `docs/homepage-assets.json`.

## Local release

Build LOAF from its canonical source checkout, then package that `dist/` output into this repository:

```sh
cd /path/to/loaf-custom-cats
npm test
npm run build

cd /path/to/nikita-site
node scripts/publish-loaf.mjs --loaf-dir /path/to/loaf-custom-cats
node --test site.test.mjs
```

The packager copies only LOAF's built `dist/` tree, rewrites public metadata for `https://nikitavorontsov.com/loaf/`, and records the exact source commit in `loaf/source.json`.
