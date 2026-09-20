import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test('is linked from the homepage', () => {
  assert.match(homepage, /href="\/regex-customs\/"/);
  assert.match(homepage, />Regex Customs</);
});

test('accepts pasted text and exposes a fixed inspection result', () => {
  assert.match(page, /textarea[^>]*id="source-text"/);
  assert.match(page, /button[^>]*id="inspect-button"[^>]*type="submit"/);
  assert.match(page, /button[^>]*id="sample-button"[^>]*type="button"/);
  assert.match(page, /button[^>]*id="clear-button"[^>]*type="button"/);
  assert.match(page, /id="result"[^>]*hidden/);
  assert.match(page, /id="result-heading"[^>]*tabindex="-1"/);
  assert.match(page, /id="script-table-body"/);
});

test('names the two exact counters and their limits', () => {
  assert.match(page, /<p class="mark-rule">\[A-Za-z\]<\/p>/);
  assert.match(page, /\[A-Za-z\]/);
  assert.match(page, /\\p\{L\}/);
  assert.match(page, /letter code points/i);
  assert.match(page, /does not count words, tokens, or SEO scores/i);
  assert.match(page, /does not run arbitrary regex/i);
});

test('keeps source text local and copied declarations source-free', () => {
  assert.match(page, /The text stays in this browser\. Nothing is uploaded, saved, or analyzed elsewhere\./);
  assert.match(page, /id="copy-button"[^>]*disabled/);
  assert.match(main, /formatDeclaration\(result\)/);
  assert.doesNotMatch(`${page}\n${main}`, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|caches\.open|CacheStorage/);
  assert.doesNotMatch(main, /sourceText\.value[^\n]*clipboard/);
});

test('announces state and moves focus to results', () => {
  assert.match(page, /id="status"[^>]*aria-live="polite"/);
  assert.match(main, /resultHeading\.focus\(\)/);
  assert.match(main, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(main, /behavior: reduceMotion \? 'auto' : 'smooth'/);
});

test('renders user-derived values without HTML injection', () => {
  assert.match(main, /analyzeText\(sourceText\.value\)/);
  assert.match(main, /scriptTableBody\.replaceChildren\(\)/);
  assert.match(main, /textContent/);
  assert.doesNotMatch(main, /innerHTML/);
});

test('uses local assets and discloses who made it', () => {
  assert.match(page, /<link rel="icon" href="data:,">/);
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /Maintained by[\s\S]*Nikita Vorontsov[\s\S]*Built with AI[\s\S]*The method and limits are printed beside the result/);
});

test('protects narrow screens, keyboard focus, and reduced motion', () => {
  assert.match(page, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /:focus-visible\s*\{[^}]*outline: 3px solid var\(--focus\)/s);
  assert.match(page, /\.counter:last-child \.counter-value\s*\{[^}]*white-space: nowrap/s);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
});

test('uses one focus indicator that contrasts on the desk and declaration paper', () => {
  const focus = page.match(/--focus: (#[a-f\d]{6})/i)?.[1];
  const desk = page.match(/--desk: (#[a-f\d]{6})/i)?.[1];
  const paper = page.match(/--paper: (#[a-f\d]{6})/i)?.[1];

  assert.ok(focus && desk && paper);
  assert.ok(contrast(focus, desk) >= 3);
  assert.ok(contrast(focus, paper) >= 3);
});

test('uses one release ID for the page and module cache', () => {
  const releaseId = 'regex-customs-20260825-01';

  assert.match(page, new RegExp(`data-build="${releaseId}"`));
  assert.match(page, new RegExp(`src="\\./main\\.mjs\\?v=${releaseId}"`));
  assert.match(main, new RegExp(`from '\\./core\\.mjs\\?v=${releaseId}'`));
});
