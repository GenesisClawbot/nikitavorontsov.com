# Nikita site and LOAF hosting implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Refresh the Nikita portfolio homepage and serve the tested LOAF build at https://nikitavorontsov.com/loaf/ from the existing GitHub Pages repository.

**Architecture:** Keep the personal site as a lightweight static GitHub Pages site and keep LOAF's Vite/Three.js repository as the canonical source. A packaging script copies LOAF's tested dist/ output into the personal site under loaf/, rewrites only public metadata needed for the new origin, and records the source commit.

**Tech Stack:** Plain HTML/CSS/JavaScript, GitHub Pages, Node.js built-ins, Vite 8.3.0, Three.js 0.186.0, cannon-es 0.20.0.

**Spec:** docs/superpowers/specs/2026-09-21-nikita-site-and-loaf-hosting-design.md

## Global Constraints

- Preserve CNAME, Route 53 records, GitHub Pages HTTPS and all existing historical routes.
- Do not change the LOAF AWS Lambda URL, DynamoDB table, Stripe products or webhooks, SSM parameters, SES sender or recovery links.
- Keep LOAF assets relative so the build works under /loaf/.
- Keep the game anonymous and network-free during the physics loop.
- Do not claim rankings, audience growth or cross-device physics fairness.
- Stage only the files named by each task; leave unrelated work/ files untouched.

---

### Task 1: Add the cross-repository LOAF packaging contract

**Files:**
- Create: scripts/publish-loaf.mjs
- Create: site.test.mjs
- Modify: README.md

**Interfaces:**
- Consumes: a LOAF source directory passed with --loaf-dir, containing dist/index.html, dist/og.png and a Git checkout.
- Produces: loaf/ containing the deployable artifact and loaf/source.json with the exact source commit.

- [ ] **Step 1: Write the failing route and packaging tests**

Create site.test.mjs using Node's built-in test runner. Read the root index.html and assert that it contains the Nikita heading, /loaf/, the GitHub link, the X link and the Threads link. Add a second test that reads loaf/index.html and loaf/source.json, asserting the canonical URL is https://nikitavorontsov.com/loaf/, the Open Graph image is under /loaf/og.png, the Plausible domain is nikitavorontsov.com and sourceCommit is a 40-character SHA.

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("homepage exposes current identity and LOAF", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /Nikita Vorontsov/);
  assert.match(html, /href=["']\\.\\/loaf\\//);
  assert.match(html, /github\\.com\\/GenesisClawbot/);
});
~~~

- [ ] **Step 2: Run the tests and verify the expected failure**

Run:

~~~sh
node --test site.test.mjs
~~~

Expected: the test fails because the current homepage and loaf/ artifact do not satisfy the new contract.

- [ ] **Step 3: Implement scripts/publish-loaf.mjs**

Parse --loaf-dir and optional --output-dir (default loaf). Resolve both paths, assert that dist/index.html and dist/og.png exist, run git -C on the resolved source path with rev-parse --verify HEAD, remove only the previous generated output directory, and copy dist/ into loaf/. Replace the old absolute LOAF origin with https://nikitavorontsov.com/loaf/ in the copied index.html, replace the old Plausible data-domain with nikitavorontsov.com, and write loaf/source.json:

~~~json
{
  "sourceRepository": "loaf-custom-cats",
  "sourceCommit": "the full 40-character SHA returned by git rev-parse --verify HEAD",
  "publicPath": "/loaf/"
}
~~~

Refuse to run when the source build is missing; never copy node_modules, source files, credentials or .git.

- [ ] **Step 4: Run the packaging test against the current LOAF checkout**

Run:

~~~sh
node scripts/publish-loaf.mjs --loaf-dir "/Users/nikitavorontsov/Documents/Codex/2026-09-20/goal-you-have-3-hours-you/outputs/loaf-custom-cats"
node --test site.test.mjs
~~~

Expected: packaging succeeds, route tests pass and loaf/source.json names the current LOAF commit.

- [ ] **Step 5: Commit the packaging contract**

~~~sh
git add scripts/publish-loaf.mjs site.test.mjs README.md
git commit -m "build: package LOAF for personal site"
~~~

### Task 2: Replace the root page with the Nikita portfolio landing page

**Files:**
- Modify: index.html
- Create: assets/site.css
- Create: assets/nikita-avatar.png only if the existing user-approved avatar is included

**Interfaces:**
- Consumes: loaf/og.png, the existing project routes, current social links and CNAME.
- Produces: a responsive root page with a featured-work hierarchy and direct navigation to /loaf/.

- [ ] **Step 1: Add a content contract test before changing markup**

Extend site.test.mjs with assertions for the exact current identity, hero action, three featured-project links, a visible archive link and a mail/contact link. Assert the old Jamie Cole withdrawal paragraph is absent from the root page while the historical route links remain present.

- [ ] **Step 2: Replace the root HTML structure**

Keep the page framework-free. Build this structure:

~~~html
<main class="site-shell">
  <header class="site-nav"><a href="./">Nikita Vorontsov</a><nav aria-label="Primary"><a href="#work-title">Work</a><a href="#archive-title">Archive</a></nav></header>
  <section class="hero" aria-labelledby="hero-title"><p class="eyebrow">Tools, games and experiments</p><h1 id="hero-title">I build small things with AI.</h1><p>Playable ideas, useful utilities and honest notes about what worked.</p><a class="button" href="./loaf/">Play LOAF</a></section>
  <section class="featured-work" aria-labelledby="work-title"><h2 id="work-title">Selected work</h2><div class="project-grid"></div></section>
  <section class="archive" aria-labelledby="archive-title"><h2 id="archive-title">More experiments</h2><p>Older tools and working notes remain available.</p><a href="#archive-list">Browse the archive</a><div id="archive-list"></div></section>
  <footer class="site-footer"><a href="https://github.com/GenesisClawbot">GitHub</a><a href="https://x.com/clawgenesis">X</a><a href="https://www.threads.com/@nvorontsov93">Threads</a><a href="mailto:clawgenesis@gmail.com">Email</a></footer>
</main>
~~~

Use direct copy: “I build small tools, games and systems with AI.” Make LOAF the primary call to action, feature one practical tool and one documented experiment beside it, and keep the full historical project list behind a compact “More experiments” link. Keep current X, Threads and GitHub destinations. Do not invent testimonials, customer counts or popularity claims.

- [ ] **Step 3: Add the responsive visual system**

Create assets/site.css with the warm, authored direction already used by LOAF: cream paper, espresso text, coral accent, mint secondary surface, generous typography and a clear two-column desktop composition that becomes a single-column mobile layout. Use clamp() for heading size, visible keyboard focus, prefers-reduced-motion, minimum 44px targets and no horizontal overflow. Use the existing avatar only when its provenance is already approved; otherwise use LOAF's generated OG image and typographic project panels.

- [ ] **Step 4: Run root route tests**

Run:

~~~sh
node --test site.test.mjs
~~~

Expected: all homepage and generated-artifact assertions pass.

- [ ] **Step 5: Commit the homepage**

~~~sh
git add index.html assets/site.css site.test.mjs
git commit -m "feat: redesign Nikita personal homepage"
~~~

### Task 3: Build, package and publish the combined static site

**Files:**
- Modify: generated loaf/ artifact through scripts/publish-loaf.mjs
- Modify: loaf/source.json
- Modify: README.md with the local release command

**Interfaces:**
- Consumes: the LOAF source checkout and its passing build.
- Produces: a GitHub Pages-ready tree with the root site and /loaf/ artifact.

- [ ] **Step 1: Run LOAF's focused verification**

From the LOAF repository, run:

~~~sh
npm test
npm run build
~~~

Expected: tests pass and Vite writes dist/index.html.

- [ ] **Step 2: Package the exact LOAF HEAD**

Run the root packaging command from Task 1. Verify loaf/index.html, loaf/assets/, loaf/audio/, loaf/og.png and loaf/source.json exist. Do not add an archive to Git.

- [ ] **Step 3: Run the full personal-site checks**

Run:

~~~sh
node --test --test-reporter spec \\
  context-baggage/*.test.mjs funeral/*.test.mjs one-bug-please/*.test.mjs \\
  one-small-fix/*.test.mjs play/*.test.mjs pr-warrant/*.test.mjs \\
  receipts-bot/*.test.mjs reconnect-tax/*.test.mjs regex-customs/*.test.mjs \\
  site.test.mjs
~~~

Expected: every existing route test and the new root/LOAF checks pass.

- [ ] **Step 4: Commit the generated release**

~~~sh
git add index.html assets/site.css loaf README.md site.test.mjs
git commit -m "publish: add LOAF under personal domain"
~~~

- [ ] **Step 5: Push the existing GitHub Pages main branch**

~~~sh
git push origin main
~~~

Do not change CNAME or create a second Pages site.

### Task 4: Verify the public root and game route

**Files:**
- Create: release-check.mjs

**Interfaces:**
- Consumes: the deployed GitHub Pages URLs.
- Produces: a machine-readable release result covering root, /loaf/, assets, metadata and a representative historical route.

- [ ] **Step 1: Write the public HTTP checks**

Use Node's built-in fetch with a normal browser user agent. Check HTTP 200 for /, /loaf/, /loaf/og.png and one existing tool route. Assert root and LOAF canonical metadata, the LOAF source manifest and a relative JavaScript asset all resolve.

- [ ] **Step 2: Run the public checks**

~~~sh
node release-check.mjs
~~~

Expected: all checks pass for https://nikitavorontsov.com.

- [ ] **Step 3: Run a browser smoke check**

Use the existing Playwright workflow to open https://nikitavorontsov.com/loaf/, drop a cat, open Help, close it, finish a result and confirm the result card/share controls are visible. Check the console for application errors and verify the root page at a mobile viewport.

- [ ] **Step 4: Commit release evidence**

~~~sh
git add release-check.mjs
git commit -m "test: verify personal site and LOAF deployment"
~~~

Record the deployed commit, public URLs, test counts and deferred issues in the release handoff. Do not claim that the old Sites URL is retired until its redirect or fallback has been independently verified.
