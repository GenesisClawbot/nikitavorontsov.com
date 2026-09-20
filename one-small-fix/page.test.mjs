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
  assert.match(homepage, /href="\/one-small-fix\/"/);
});

test('homepage names both One Small Fix outputs', () => {
  assert.match(homepage, /Print a scope receipt or launch a Conversation Lifeboat with One Small Fix\./);
  assert.match(homepage, /editable Markdown/);
});

test('accepts a transcript and provides an editable receipt', () => {
  assert.match(page, /id="transcript"[^>]*type="file"[^>]*accept="\.jsonl/);
  assert.match(page, /id="receipt"[^>]*hidden/);
  assert.match(page, /id="receipt-text"/);
  assert.match(page, /id="privacy-check"/);
  assert.match(page, /id="copy-button"[^>]*disabled/);
  assert.match(page, /id="save-button"[^>]*disabled/);
});

test('labels observed write tool calls without claiming they succeeded', () => {
  assert.match(page, /Direct write calls<\/span>/);
  assert.match(page, /Direct file write calls observed<\/h3>/);
  assert.match(page, /Direct write calls include Edit, Write, and NotebookEdit calls\./);
  assert.doesNotMatch(page, />Direct writes<|>Direct file writes observed<|Direct writes include/);
});

test('announces status and moves focus to the result', () => {
  assert.match(page, /id="status"[^>]*aria-live="polite"/);
  assert.match(page, /id="receipt-heading"[^>]*tabindex="-1"/);
  assert.match(main, /receiptHeading\.focus\(\)/);
});

test('keeps transcript processing local and states the boundary', () => {
  assert.match(page, /The transcript stays in this browser\. Nothing is uploaded or saved\./);
  assert.doesNotMatch(`${page}\n${main}`, /sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(main, /localStorage\.(?:getItem|setItem)\([^)]*(?:transcript|receipt)/i);
});

test('loads local assets and discloses who made it', () => {
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /Maintained by[\s\S]*Nikita Vorontsov[\s\S]*Built with AI/);
});

test('protects narrow screens and reduced-motion users', () => {
  assert.match(page, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(main, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(main, /behavior: reduceMotion \? 'auto' : 'smooth'/);
});

test('keeps small caution text readable on the receipt sheet', () => {
  const caution = page.match(/--caution: (#[a-f\d]{6})/i)?.[1];
  const sheet = page.match(/--sheet: (#[a-f\d]{6})/i)?.[1];

  assert.ok(caution && sheet);
  assert.ok(contrast(caution, sheet) >= 4.5);
});

test('uses the deployment marker to reload stale tabs', () => {
  assert.match(page, /data-build="one-small-fix-20260825-01"/);
  assert.match(page, /src="\.\/main\.mjs\?v=one-small-fix-20260825-01"/);
  assert.match(main, /from '\.\/core\.mjs\?v=one-small-fix-20260825-01'/);
  assert.match(main, /document\.documentElement\.dataset\.build/);
  assert.match(main, /localStorage\.setItem\(BOOT_STORAGE_KEY, BOOT_ID\)/);
  assert.match(main, /addEventListener\('storage'/);
  assert.match(main, /window\.location\.replace\(url\)/);
});

test('offers a checked Markdown conversation lifeboat beside the scope receipt', () => {
  assert.match(page, /id="output-kind"/);
  assert.match(page, /value="receipt"[^>]*>Scope receipt \(\.txt\)<\/option>/);
  assert.match(page, /value="conversation"[^>]*>Conversation lifeboat \(\.md\)<\/option>/);
  assert.match(page, /every visible human and assistant text turn/i);
  assert.match(main, /buildConversationMarkdown/);
  assert.match(main, /one-small-fix-conversation-lifeboat\.md/);
  assert.match(main, /outputKind\.addEventListener\('change'/);
});
