import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('is linked from the homepage', () => {
  assert.match(homepage, /href="\/context-baggage\/"/);
  assert.match(homepage, />Context Baggage Claim</);
});

test('accepts several local text files and exposes a removable manifest', () => {
  assert.match(page, /input[^>]*id="file-input"[^>]*type="file"[^>]*multiple[^>]*\shidden(?:\s|>)/);
  assert.match(page, /id="drop-zone"/);
  assert.match(page, /id="file-list"/);
  assert.match(page, /button[^>]*id="choose-button"[^>]*type="button"/);
  assert.match(page, /id="clear-button"/);
  assert.match(page, /id="manifest"[^>]*hidden/);
  assert.match(page, /id="manifest-heading"[^>]*tabindex="-1"/);
});

test('announces file errors and manifest changes', () => {
  assert.match(page, /id="status"[^>]*aria-live="polite"/);
  assert.match(page, /id="manifest-status"[^>]*aria-live="polite"/);
  assert.match(main, /manifestHeading\.focus\(\)/);
});

test('measures selected bytes locally behind bounded input and output', () => {
  assert.match(main, /MAX_TOTAL_MIB = 2/);
  assert.match(main, /MAX_TOTAL_BYTES = MAX_TOTAL_MIB \* 1024 \* 1024/);
  assert.match(main, /MAX_FILES = 100/);
  assert.match(main, /MAX_VISIBLE_DUPLICATES = 100/);
  assert.match(main, /createSelectionBelt\(MAX_TOTAL_BYTES, MAX_FILES\)/);
  assert.match(main, /result\.duplicates\.slice\(0, MAX_VISIBLE_DUPLICATES\)/);
  assert.match(main, /file\.arrayBuffer\(\)/);
  assert.match(main, /const weighingSelection = selectionBelt\.lock\(\)/);
  assert.match(main, /selectionBelt\.unlock\(\)/);
  assert.match(main, /analyzeFiles\(preparedFiles\)/);
  assert.match(main, /result\.files/);
  assert.match(main, /result\.duplicates/);
  assert.doesNotMatch(main, /innerHTML/);
});

test('lets people remove one file or clear the belt without retaining stale metadata', () => {
  assert.match(main, /selectionBelt\.remove\(id\)/);
  assert.match(main, /clearButton\.addEventListener\('click'/);
  assert.match(main, /selectionBelt\.clear\(\)/);
  assert.match(main, /fileInput\.value = ''/);
  assert.match(main, /manifest\.hidden = true/);
  assert.match(main, /fileManifest\.replaceChildren\(\)/);
  assert.match(main, /duplicateList\.replaceChildren\(\)/);
});

test('states and enforces the local-only measurement boundary', () => {
  assert.match(page, /The files stay in this browser\. Nothing is uploaded or saved\./);
  assert.match(page, /This weighs only the files you choose\. It does not know what Claude loaded\. Bytes are not tokens\./);
  assert.match(page, /Each selection counts separately\./);
  assert.doesNotMatch(`${page}\n${main}`, /across different files/);
  assert.doesNotMatch(`${page}\n${main}`, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|caches\.open|CacheStorage/);
});

test('uses local assets and discloses who made it', () => {
  assert.match(page, /<link rel="icon" href="data:,">/);
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /Maintained by[\s\S]*Nikita Vorontsov[\s\S]*Built with AI/);
});

test('protects narrow screens, keyboard focus, contrast, and reduced motion', () => {
  assert.match(page, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /:focus-visible\s*\{[^}]*outline: 3px solid var\(--focus\)/s);
  assert.match(page, /button,[\s\S]*\.file-picker[\s\S]*color: var\(--ink\)/);
  assert.match(page, /\.claim-tag\s*\{[^}]*color: var\(--ink\)/s);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(page, /accept="\.md,\.markdown,\.txt,text\/plain,text\/markdown"/);
  assert.match(page, /UTF-8 plain-text or Markdown file/);
  assert.match(main, /chooseButton\.addEventListener\('click', \(\) => fileInput\.click\(\)\)/);
  assert.match(main, /fileInput\.disabled = isWeighing/);
  assert.match(main, /removeButton\.disabled = isWeighing/);
  assert.match(main, /labels\.get\(entry\.id\)/);
  assert.match(main, /if \(nextRemoveButton\) \{[\s\S]*nextRemoveButton\.focus\(\);[\s\S]*\} else \{[\s\S]*chooseButton\.focus\(\);/);
  assert.match(main, /if \(weighingFailed\) \{[\s\S]*weighButton\.focus\(\)/);
});

test('does not publish an unsupported token-count anecdote', () => {
  assert.doesNotMatch(page, /\b\d+[Kk] tokens\b/);
});

test('uses one release ID for the page and module cache', () => {
  const releaseId = 'context-baggage-20260825-01';

  assert.match(page, new RegExp(`data-build="${releaseId}"`));
  assert.match(page, new RegExp(`src="\\./main\\.mjs\\?v=${releaseId}"`));
  assert.match(main, new RegExp(`from '\\./core\\.mjs\\?v=${releaseId}'`));
  assert.match(main, new RegExp(`from '\\./selection\\.mjs\\?v=${releaseId}'`));
});
