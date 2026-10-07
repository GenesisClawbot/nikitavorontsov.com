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
scroll tour (one chapter per `.scene`, currently CharGen, LOAF and ZOOKWORKS) and motion preferences. `src/reference-motion.mjs`
adds the project-tile springs and the portrait frame's pointer-driven depth. WebGL is loaded near the tour
on larger screens. Mobile, reduced-motion and failed-WebGL paths keep ordinary
images and real links. Fonts, icons, artwork and compiled scripts are local.

See [reference provenance](docs/reference-provenance.md) for exact React Bits
sources, adaptations and Motion usage, and [design QA](design-qa.md) for validation.

Generated image originals can be exported using:
`node scripts/prepare-home-assets.mjs /path/to/originals`.
Source prompts and output URLs are documented in `docs/homepage-assets.json`.

## Site-wide analytics

`/analytics.js` is the single Plausible configuration for the whole domain.
`npm run build` installs its reference in every tracked or new, non-ignored HTML
page, including the homepage, labs, previews and privacy page. Commit the updated
HTML with the shared file: GitHub Pages serves the repository root as static files.
The game packagers apply the same reference. `npm test` catches missing or duplicate
references when a new page is added.
Archived labs' security policies permit only Plausible's script path and event
endpoint alongside their existing local resources.

New pages collect pageviews only. Their form inputs, files and gameplay are not
sent to Plausible. LOAF and ZOOKWORKS retain their existing custom events;
ZOOKWORKS retains manual pageviews to avoid counting its startup twice. Local
development and other hosts do not load the tracker. Changes take effect for
future visits and cannot recover earlier untracked traffic.

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

ZOOKWORKS ships the same way from its own checkout. Its build already targets `/zookworks/`, so the packager only copies `dist/` and records the source commit; it refuses a checkout with uncommitted changes.

```sh
cd /path/to/zookworks
npm test
npm run build

cd /path/to/nikita-site
node scripts/publish-zookworks.mjs --source-dir /path/to/zookworks
node --test site.test.mjs
```
