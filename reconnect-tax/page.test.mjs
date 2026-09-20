import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('is linked from the homepage', () => {
  assert.match(homepage, /href="\/reconnect-tax\/"/);
  assert.match(homepage, />Reconnect Tax Receipt</);
});

test('accepts a pasted log and provides an editable receipt', () => {
  assert.match(page, /id="log"[^>]*textarea|textarea[^>]*id="log"/);
  assert.match(page, /id="make-button"/);
  assert.match(page, /id="receipt"[^>]*hidden/);
  assert.match(page, /id="receipt-text"/);
  assert.match(page, /id="review-check"/);
  assert.match(page, /id="copy-button"[^>]*disabled/);
  assert.match(page, /id="save-button"[^>]*disabled/);
});

test('prints a local receipt and moves focus to it', () => {
  assert.match(page, /id="status"[^>]*aria-live="polite"/);
  assert.match(page, /id="receipt-heading"[^>]*tabindex="-1"/);
  assert.match(main, /parseReconnectLog\(log\.value\)/);
  assert.match(main, /formatReceipt\(summary\)/);
  assert.match(main, /receiptHeading\.focus\(\)/);
});

test('keeps the form usable when no matching notice is found', () => {
  assert.match(main, /catch \(error\)/);
  assert.match(main, /status\.textContent = error\.message/);
  assert.match(main, /receipt\.hidden = true/);
  assert.match(main, /log\.focus\(\)/);
});

test('requires a fresh review after the receipt changes', () => {
  assert.match(main, /reviewCheck\.addEventListener\('change'/);
  assert.match(main, /copyButton\.disabled = !reviewCheck\.checked/);
  assert.match(main, /saveButton\.disabled = !reviewCheck\.checked/);
  assert.match(main, /receiptText\.addEventListener\('input'/);
  assert.match(main, /Receipt changed\. Review it again before you copy or download it\./);
  assert.match(main, /reviewCheck\.checked = false/);
});

test('copies or downloads only the editable receipt text', () => {
  assert.match(main, /navigator\.clipboard\.writeText\(receiptText\.value\)/);
  assert.match(main, /Copy failed\. Select the receipt text and copy it manually\./);
  assert.match(main, /receiptText\.select\(\)/);
  assert.match(main, /new Blob\(\[receiptText\.value\]/);
  assert.match(main, /reconnect-tax-receipt\.txt/);
});

test('states and enforces the local-only boundary', () => {
  assert.match(page, /The log stays in this browser\. Nothing is uploaded or saved\./);
  assert.doesNotMatch(`${page}\n${main}`, /sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(main, /localStorage\.(?:getItem|setItem)\([^)]*(?:log|receipt)/i);
});

test('does not turn reconnect notices into a billing claim', () => {
  assert.match(page, /This is not a bill\./);
  assert.match(page, /It counts matching notices\. It cannot see charges, tokens, or completed retries\./);
  assert.doesNotMatch(page, /charged (?:again|twice|\d)|double.charg/i);
});

test('loads local assets and discloses who made it', () => {
  assert.match(page, /<link rel="icon" href="data:,">/);
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /Maintained by[\s\S]*Nikita Vorontsov[\s\S]*Built with AI/);
});

test('protects narrow screens, keyboard focus, and reduced motion', () => {
  assert.match(page, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /:focus-visible\s*\{[^}]*outline: 3px solid var\(--ink\)/s);
  assert.match(page, /\.terminal-card :focus-visible\s*\{[^}]*outline-color: var\(--highlighter\)/s);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(main, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(main, /behavior: reduceMotion \? 'auto' : 'smooth'/);
});

test('keeps the animated example text fully opaque', () => {
  const attemptRule = page.match(/\.attempt:last-child\s*\{([^}]*)\}/)?.[1] ?? '';
  const blinkFrames = page.match(/@keyframes blink\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.doesNotMatch(attemptRule, /animation:/);
  assert.doesNotMatch(blinkFrames, /opacity:/);
});

test('uses one release ID for tab and module cache invalidation', () => {
  const releaseId = 'reconnect-tax-20260825-01';

  assert.match(page, new RegExp(`data-build="${releaseId}"`));
  assert.match(page, new RegExp(`src="\\./main\\.mjs\\?v=${releaseId}"`));
  assert.match(main, new RegExp(`from '\\./core\\.mjs\\?v=${releaseId}'`));
  assert.match(main, /document\.documentElement\.dataset\.build/);
  assert.match(main, /localStorage\.setItem\(BOOT_STORAGE_KEY, BOOT_ID\)/);
  assert.match(main, /addEventListener\('storage'/);
  assert.match(main, /window\.location\.replace\(url\)/);
});
