import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = new URL('.', import.meta.url);
const html = await readFile(new URL('index.html', route), 'utf8');
const main = await readFile(new URL('main.mjs', route), 'utf8').catch(() => '');
const game = await readFile(new URL('game.mjs', route), 'utf8').catch(() => '');

const ids = [
  'game-shell', 'boot-status', 'ticket-title', 'ticket-brief', 'seed', 'turn',
  'context', 'context-fuse', 'warning-lamp', 'checks', 'files', 'lines', 'machine-frame',
  'machine-previous', 'machine-current', 'machine-stage', 'proposal',
  'proposal-number', 'proposal-heading', 'proposal-pitch', 'proposal-paths',
  'proposal-lines', 'proposal-cost', 'approve', 'reject', 'reveal',
  'reveal-verdict', 'reveal-heading', 'reveal-copy', 'next', 'start', 'ship',
  'ship-condition', 'share', 'sound', 'shortcuts', 'result', 'result-heading',
  'result-ticket', 'result-seed', 'result-files', 'result-lines', 'result-context',
  'result-scope', 'result-stage', 'result-share', 'new-ticket', 'challenge-fallback',
  'challenge-url', 'live-region',
];

test('carries the release marker, boot id, versioned module, and explicit favicon', () => {
  assert.match(html, /one-bug-please-20260828-01/);
  assert.match(html, /data-boot-id="one-bug-please-20260828-01"/);
  assert.match(html, /\.\/main\.mjs\?v=one-bug-please-20260828-01/);
  assert.match(html, /<link rel="icon" href="data:,">/);
});

test('declares every game and fallback control in ordinary DOM', () => {
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="approve"[^>]*disabled/);
  assert.match(html, /id="reject"[^>]*disabled/);
  assert.match(html, /id="ship"[^>]*disabled/);
  assert.match(html, /role="status"[^>]*aria-live="polite"/);
  assert.match(html, /If this message stays here, the game did not start\./);
});

test('does not expose verdicts or internal fields before the player decides', () => {
  const staticVerdict = html.match(/<p id="reveal-verdict" class="stamp">([^<]*)<\/p>/);
  const staticReveal = html.match(/<p id="reveal-copy">([^<]*)<\/p>/);
  const proposalStart = html.indexOf('<section id="proposal"');
  const proposalEnd = html.indexOf('</section>', proposalStart);
  const proposal = html.slice(proposalStart, proposalEnd);

  assert.ok(staticVerdict, 'the reveal verdict element must exist');
  assert.ok(staticReveal, 'the reveal copy element must exist');
  assert.equal(staticVerdict[1], '');
  assert.equal(staticReveal[1], '');
  assert.doesNotMatch(proposal, /NEEDED|SCOPE CREEP|\bkind\b|checkId|scopeWeight/);
});

test('static ship status uses the required remaining-check instruction', () => {
  assert.match(html, /<p id="ship-condition">Finish 3 acceptance checks to ship\.<\/p>/);
});

test('briefing explains decisions, context, and the win condition before play starts', () => {
  const howTo = html.indexOf('id="how-to-label"');
  const start = html.indexOf('id="start"');
  assert.ok(howTo > -1, 'the briefing needs a visible how-to-play heading');
  assert.ok(howTo < start, 'the rules need to appear before the start control');
  assert.match(html, /Approve applies the proposal's files and lines\. It spends the card's context cost\./);
  assert.match(html, /Reject applies no work\. It spends 2 context on review\./);
  assert.match(html, /Context is the finite fuse\. Pass all 3 acceptance checks\. Ship before it reaches 0\./);
  assert.equal(html.match(/id="how-to-label"/g)?.length, 1);
});

test('keeps acceptance checks in the decision panel before the live proposal', () => {
  const decisionPanel = html.indexOf('<section class="decision-panel"');
  const checks = html.indexOf('id="checks-label"');
  const proposal = html.indexOf('id="proposal"');
  assert.ok(decisionPanel > -1);
  assert.ok(checks > decisionPanel, 'acceptance checks need to be in the decision panel');
  assert.ok(checks < proposal, 'acceptance checks need to precede the current proposal');
});

test('caps the machine scene to the viewport without cropping its stage art', () => {
  assert.match(html, /\.machine-frame\s*\{[^}]*height:\s*clamp\([^)]*svh[^)]*\)/s);
  assert.match(html, /\.machine-frame img\s*\{[^}]*height:\s*100%/s);
  assert.match(html, /\.machine-frame img\s*\{[^}]*object-fit:\s*contain/s);
});

test('applies compact path styles to the live proposal', () => {
  assert.match(html, /<ul id="proposal-paths" class="proposal-paths"><\/ul>/);
});

test('compacts the decision stack on laptop-height desktop viewports', () => {
  const start = html.indexOf('@media (min-width: 761px) and (max-height: 900px)');
  const end = html.indexOf('@media (max-width: 760px)', start);
  const shortDesktop = html.slice(start, end);
  assert.ok(start > -1 && end > start);
  assert.match(shortDesktop, /\.checks-card ol\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(shortDesktop, /\.proposal-paths\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
});

test('uses only the three deployed local fonts', () => {
  assert.match(html, /\.\.\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(html, /\.\.\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(html, /\.\.\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com|https?:\/\/[^"']+\.(?:woff2?|ttf)/i);
});

test('states the AI disclosure and privacy boundary', () => {
  assert.match(html, /Maintained by Nikita Vorontsov\. Built with AI\./);
  assert.match(html, /No account, upload, analytics, or saved score\./);
});

test('includes responsive and reduced-motion contracts', () => {
  assert.match(html, /@media \(max-width: 760px\)/);
  assert.match(html, /@media \(max-width: 420px\)/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /overflow-x: hidden/);
  assert.match(html, /min-width: 0/);
});

test('sets min-width zero on every direct grid child', () => {
  const zeroWidthSelectors = [...html.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /min-width:\s*0/.test(body))
    .flatMap(([, selectors]) => selectors.split(',').map((selector) => selector.trim()));
  const gridChildSelectors = [
    '.game-shell > *',
    '.repair-scene > *',
    '.machine-frame > *',
    '.status-grid > *',
    '.checks-card ol > *',
    '.proposal-paths > *',
    '.proposal-costs > *',
    '.result-grid > *',
    '.decision-buttons > *',
  ];

  for (const selector of gridChildSelectors) {
    assert.ok(zeroWidthSelectors.includes(selector), `${selector} needs min-width: 0`);
  }
});

test('contains no third-party runtime, analytics, fetch, or em dash', () => {
  const source = `${html}\n${main}\n${game}`;
  assert.doesNotMatch(source, /<script[^>]+https?:\/\//i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /google-analytics|gtag\(|plausible|posthog|segment/i);
  assert.doesNotMatch(source, /—/);
  assert.doesNotMatch(source, /\.\.\/index\.html/);
});

const imageNames = Array.from({ length: 4 }, (_, index) => `machine-stage-${index}.webp`);
const soundNames = ['approve.mp3', 'reject.mp3', 'ship.mp3'];

test('bundles production image and optional sound files locally', async () => {
  for (const name of imageNames) {
    const bytes = await readFile(new URL(`assets/${name}`, route));
    assert.ok(bytes.length > 10_000, `${name} is too small to be a production image`);
    assert.ok(bytes.length <= 450_000, `${name} exceeds the route image budget`);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
  }
  for (const name of soundNames) {
    const bytes = await readFile(new URL(`assets/${name}`, route));
    assert.ok(bytes.length > 1_000, `${name} is too small to be a production cue`);
    assert.ok(bytes.length <= 80_000, `${name} exceeds the cue budget`);
  }
});

test('references every machine image and sound cue from local source', () => {
  const source = `${html}\n${main}\n${game}`;
  for (const name of [...imageNames, ...soundNames]) {
    assert.match(source, new RegExp(`\\.\\/assets\\/${name.replace('.', '\\.')}`));
  }
});

test('controller versions its pure import and handles seed URL replacement', () => {
  assert.match(main, /from '\.\/game\.mjs\?v=one-bug-please-20260828-01'/);
  assert.match(main, /crypto\.getRandomValues/);
  assert.match(main, /history\.replaceState/);
  assert.match(main, /searchParams\.get\('seed'\)/);
});

test('controller binds decisions, ship, shortcuts, focus, and live output', () => {
  assert.match(main, /addEventListener\('click'/);
  assert.match(main, /addEventListener\('keydown'/);
  assert.match(main, /case 'a':/i);
  assert.match(main, /case 'r':/i);
  assert.match(main, /case 's':/i);
  assert.match(main, /case 'Enter':/);
  assert.match(main, /\.focus\(\)/);
  assert.match(main, /requestAnimationFrame/);
});

test('controller guards stale builds and blocked storage', () => {
  assert.match(main, /one-bug-please-boot-id/);
  assert.match(main, /localStorage/);
  assert.match(main, /addEventListener\('storage'/);
  assert.match(main, /catch \{/);
});

test('controller handles reduced motion and all four machine assets', () => {
  assert.match(main, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(main, /addEventListener\('change'/);
  for (const name of imageNames) assert.match(main, new RegExp(`\\.\\/assets\\/${name.replace('.', '\\.')}`));
});

test('controller starts the machine crossfade only after the replacement loads', () => {
  assert.match(main, /addEventListener\('load'/);
  assert.match(main, /machineFrame\.dataset\.swap = 'active'/);
  assert.match(html, /\[data-swap="active"\] #machine-current/);
  assert.match(html, /\[data-swap="active"\] #machine-previous/);
  assert.doesNotMatch(html, /\[data-motion="approve"\] #machine-(?:current|previous)/);
});

test('sound starts off and fails back to silence', () => {
  assert.match(html, /id="sound"[^>]*aria-pressed="false"/);
  assert.match(main, /new Audio\('\.\/assets\/approve\.mp3'\)/);
  assert.match(main, /new Audio\('\.\/assets\/reject\.mp3'\)/);
  assert.match(main, /new Audio\('\.\/assets\/ship\.mp3'\)/);
  assert.match(main, /\.play\(\)\.catch/);
  assert.match(main, /Sound unavailable\. Continuing in silence\./);
});

test('puts the challenge action beside the final score before replay', () => {
  const resultStart = html.indexOf('<section id="result"');
  const resultEnd = html.indexOf('</section>', resultStart);
  const result = html.slice(resultStart, resultEnd);
  const challenge = result.indexOf('id="result-share"');
  const replay = result.indexOf('id="new-ticket"');

  assert.ok(challenge > -1, 'the result card needs its own challenge action');
  assert.ok(challenge < replay, 'challenge needs to remain the primary result action');
  assert.match(result, /id="result-share"[^>]*disabled/);
  assert.match(main, /resultShare: 'result-share'/);
  assert.match(main, /elements\.resultShare\.addEventListener\('click'/);
});

test('sharing uses Web Share, clipboard fallback, cancellation, and selectable URL', () => {
  assert.match(main, /navigator\.share/);
  assert.match(main, /navigator\.clipboard\.writeText/);
  assert.match(main, /Share sheet opened\. Nothing is sent until you choose a destination\./);
  assert.match(main, /Share cancelled\./);
  assert.match(main, /challengeFallback\.hidden = false/);
  assert.match(main, /challengeUrl\.select\(\)/);
});

test('new ticket removes the old seed before canonical boot', () => {
  assert.match(main, /searchParams\.delete\('seed'\)/);
  assert.match(main, /location\.assign/);
});
