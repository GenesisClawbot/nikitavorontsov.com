# nikitavorontsov.com

Static GitHub Pages site for Nikita Vorontsov. The root page is a small portfolio and the deployable LOAF build lives at `/loaf/`.

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
