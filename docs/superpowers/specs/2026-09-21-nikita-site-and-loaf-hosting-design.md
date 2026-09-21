# Nikita personal site and LOAF hosting design

**Status:** Proposed for review

**Goal:** Turn `nikitavorontsov.com` into a clear personal work site and serve LOAF at `/loaf/` from that existing domain without disturbing the existing AWS cat service or historical project routes.

## Current state

- The public domain is the GitHub Pages site `GenesisClawbot/nikitavorontsov.com`, with `CNAME` already set to `nikitavorontsov.com`.
- The current root page is a text-heavy index of experiments and still explains the previous Jamie Cole site and its withdrawn commercial pages.
- LOAF is maintained in a separate Vite/Three.js repository at `outputs/loaf-custom-cats`. Its current production URL is `https://loaf-cat-stack.chargen.chatgpt.site/`.
- LOAF's photo-cat generation, Stripe Checkout, DynamoDB ownership catalogue, SES recovery and AWS Lambda API are separate from the static game. This design does not move or rewrite that service.

## Decisions

### One domain, two source repositories

The personal site repository remains the public GitHub Pages source. The LOAF repository remains the canonical game source and retains its own tests and release history. A release step builds LOAF and copies the resulting static `dist/` directory into the personal-site repository as `loaf/`. The public page serves the game directly at `https://nikitavorontsov.com/loaf/`; it does not iframe the Sites page.

This keeps the game deployable independently while giving the player one coherent public identity. The release step records the LOAF commit SHA in a small manifest under `loaf/` so a deployed game can be traced to its source.

### Root-page direction

The root page becomes an authored personal workbench rather than a generic CV:

- A direct introduction: Nikita Vorontsov builds small tools, games and systems with AI.
- A visual hero using the existing personal avatar or a restrained project image, with a clear `Play LOAF` action.
- Three featured projects: LOAF, one practical tool, and one documented experiment. Each gets one sentence describing what a visitor can do and a link to evidence or source.
- A compact experiments/archive area for the existing tools. Existing routes remain available and working; the root page no longer leads with the withdrawal history.
- Current links to GitHub, X, Threads and contact. The current identity is Nikita Vorontsov.

The page should remain lightweight and readable on mobile. It should use the existing static hosting model, avoid a framework migration, and keep the game canvas as the visual focus on `/loaf/`.

### LOAF subpath contract

The LOAF build already uses relative asset paths. The release must preserve that property so `dist/` can become `loaf/` without broken fonts, audio or model assets. The build metadata must change:

- canonical URL: `https://nikitavorontsov.com/loaf/`;
- Open Graph and X image URLs: `https://nikitavorontsov.com/loaf/og.png`;
- Plausible domain configuration: `nikitavorontsov.com`, with the existing event names retained;
- challenge and result links: derived from the current pathname, so `/loaf/` remains in shared links.

The original Sites URL may remain as a redirect or fallback during the transition, but all new public copy points to the personal-domain URL after verification.

### Release flow

1. Run LOAF's focused tests and production build in its repository.
2. Package `dist/` and copy it to `nikita-site/loaf/`.
3. Run the personal-site route and asset checks, including the `/loaf/` entry point and existing project routes.
4. Commit the root-site redesign and the packaged LOAF artifact together in the personal-site repository.
5. Push GitHub Pages and verify apex HTTPS, the root page, `/loaf/`, Open Graph assets and representative historical routes.

The old custom domain and its redirects are not changed by this work. Existing `CNAME`, DNS and HTTPS settings remain intact.

## Non-goals

- No migration of the AWS custom-cat API, DynamoDB table, Stripe products, webhooks, SSM parameters or SES sender.
- No removal of historical project routes or source repositories.
- No new runtime framework for the personal site.
- No automatic social posting or follower claims.

## Acceptance criteria

1. `https://nikitavorontsov.com/` presents Nikita's current identity and the featured work clearly on desktop and mobile.
2. `https://nikitavorontsov.com/loaf/` loads the same tested game, including fonts, audio, assets, challenge links and result-card downloads.
3. LOAF source remains testable and reproducible from its own repository; the packaged artifact records its source commit.
4. No existing AWS endpoint, Stripe webhook, payment flow or recovery link changes.
5. GitHub Pages HTTPS serves both the root and `/loaf/` with no console errors or broken local assets.
6. The old Sites URL, if retained, is not used as the canonical link in the personal site or launch materials.

## Deferred decisions

- Whether the personal root includes a contact form or only a mail link.
- Whether LOAF's separate source repository should eventually become a monorepo. The first release deliberately avoids that migration.
