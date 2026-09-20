import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('is linked from the homepage', () => {
  assert.match(homepage, /href="\/receipts-bot\/"/);
  assert.match(homepage, />Receipts, Bot</);
});

test('collects draft and source text before opening the proof desk', () => {
  assert.match(page, /textarea[^>]*id="draft"/);
  assert.match(page, /textarea[^>]*id="source"/);
  assert.match(page, /id="check-button"/);
  assert.match(page, /id="example-button"/);
  assert.match(page, /id="proof"[^>]*hidden/);
});

test('keeps failed module startup visible instead of leaving active inert controls', () => {
  assert.match(page, /id="check-button"[^>]*disabled/);
  assert.match(page, /id="example-button"[^>]*disabled/);
  assert.match(page, /Loading the proof desk\. If this message stays, turn on JavaScript and reload\./);
  assert.match(main, /checkButton\.disabled = false;\s*exampleButton\.disabled = false;\s*status\.textContent = '';/);
});

test('renders flagged claims as text and never injects pasted markup', () => {
  assert.match(main, /findFlaggedClaims\(draft\.value\)/);
  assert.match(main, /claimText\.textContent = claim\.text/);
  assert.match(main, /term\.textContent = label/);
  assert.doesNotMatch(main, /innerHTML|insertAdjacentHTML|document\.write/);
});

test('requires source-matching evidence for every flagged claim', () => {
  assert.match(main, /quoteSupportsClaim\(quoteInput\.value, source\.value, claim\)/);
  assert.match(main, /quoteLabel\.textContent = 'Paste a matching source excerpt'/);
  assert.match(main, /canCopyDraft\(\{[\s\S]*draft: draft\.value,[\s\S]*source: source\.value,[\s\S]*evidence/s);
  assert.match(main, /copyButton\.disabled = !canCopy/);
  assert.match(main, /Paste at least 12 exact characters from the source above that include every watched term\./);
  assert.doesNotMatch(`${page}\n${main}`, /supporting source quote/i);
});

test('rechecks edited drafts and sources without losing stable evidence', () => {
  assert.match(main, /draft\.addEventListener\('input', refreshProof\)/);
  assert.match(main, /source\.addEventListener\('input', refreshProof\)/);
  assert.match(main, /evidenceByClaim\.set\(claim\.id, quoteInput\.value\)/);
  assert.match(main, /evidenceByClaim\.get\(claim\.id\) \?\? ''/);
});

test('clears stale action feedback when the draft or source changes', () => {
  assert.match(main, /function refreshProof\(\) \{\s*status\.textContent = '';/);
});

test('copies only the current editable draft and provides a manual fallback', () => {
  assert.match(main, /navigator\.clipboard\.writeText\(draft\.value\)/);
  assert.match(main, /draft\.focus\(\)/);
  assert.match(main, /draft\.select\(\)/);
  assert.match(page, /id="copy-button"[^>]*disabled/);
});

test('states the narrow boundary instead of claiming hallucination detection', () => {
  assert.match(page, /This is a word-list tripwire, not a truth detector\./);
  assert.match(page, /Passing does not prove a claim\./);
  assert.match(page, /It can miss risky wording outside the list\./);
  assert.match(page, /A matching excerpt only proves that the watched terms appear in the source you supplied\./);
  assert.doesNotMatch(page, /detects? hallucinations?|guarantees? accuracy|fact.?check(?:er|ing)/i);
});

test('keeps draft and source material local', () => {
  assert.match(page, /Your draft and source stay in this browser\. Nothing is uploaded or saved\./);
  assert.match(page, /textarea[^>]*id="draft"[^>]*spellcheck="false"/);
  assert.match(page, /textarea[^>]*id="source"[^>]*spellcheck="false"/);
  assert.match(main, /quoteInput\.setAttribute\('spellcheck', 'false'\)/);
  assert.doesNotMatch(`${page}\n${main}`, /fetch\(|XMLHttpRequest|sendBeacon|sessionStorage/);
  assert.doesNotMatch(main, /localStorage\.(?:getItem|setItem)\([^)]*(?:draft|source|evidence)/i);
});

test('uses an invented example instead of public user material', () => {
  assert.match(main, /Moonbox release bot/);
  assert.match(main, /The changelog says the worker now runs in a sandbox/);
  assert.doesNotMatch(`${page}\n${main}`, /moisesvalero|fantasyhistairy|clawgenesis/i);
});

test('loads only local assets and discloses who made it', () => {
  assert.match(page, /<link rel="icon" href="data:,">/);
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /Maintained by[\s\S]*Nikita Vorontsov[\s\S]*Built with AI[\s\S]*No draft leaves this page/);
});

test('protects narrow screens, keyboard focus, and reduced motion', () => {
  assert.match(page, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /:focus-visible\s*\{[^}]*outline: 3px solid var\(--focus\)/s);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(main, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(main, /behavior: reduceMotion \? 'auto' : 'smooth'/);
});

test('uses one release ID for page and module cache invalidation', () => {
  const releaseId = 'receipts-bot-20260825-01';

  assert.match(page, new RegExp(`data-build="${releaseId}"`));
  assert.match(page, new RegExp(`src="\\./main\\.mjs\\?v=${releaseId}"`));
  assert.match(main, new RegExp(`from '\\./core\\.mjs\\?v=${releaseId}'`));
  assert.match(main, /document\.documentElement\.dataset\.build/);
  assert.match(main, /localStorage\.setItem\(BOOT_STORAGE_KEY, BOOT_ID\)/);
  assert.match(main, /addEventListener\('storage'/);
  assert.match(main, /window\.location\.replace\(url\)/);
});
