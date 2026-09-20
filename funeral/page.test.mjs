import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('is linked from the homepage', () => {
  assert.match(homepage, /href="\/funeral\/"/);
  assert.match(homepage, /get its cost or work time per useful session\./);
});

test('loads only local assets', () => {
  assert.match(page, /rel="icon"/);
  assert.match(page, /\/play\/fonts\/bricolage-grotesque-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/public-sans-latin\.woff2/);
  assert.match(page, /\/play\/fonts\/spline-sans-mono-latin\.woff2/);
  assert.doesNotMatch(page, /https?:\/\/(?!schema\.org)/);
  assert.match(page, /Maintained by <a href="\/">Nikita Vorontsov<\/a>\. Built with AI\./);
});

test('contains the complete autopsy form and receipt', () => {
  for (const name of [
    'service',
    'monthlyPrice',
    'monthsPaid',
    'usefulSessions',
    'hourlyTakeHome',
    'currency',
  ]) {
    assert.match(page, new RegExp(`name="${name}"`));
  }
  assert.match(page, /id="receipt"[^>]*hidden/);
  assert.match(page, /id="share-button"/);
  assert.match(page, /id="print-button"/);
});

test('offers optional affordability without changing the default receipt', () => {
  assert.match(page, /<label for="hourlyTakeHome">Take-home pay per hour \(optional\)<\/label>/);
  assert.match(page, /id="hourlyTakeHome"[^>]*name="hourlyTakeHome"[^>]*inputmode="decimal"/);
  assert.match(page, /id="work-time-rows"[^>]*hidden/);
  assert.match(page, /id="receipt-work-month"/);
  assert.match(page, /id="receipt-work-session"/);
});

test('disables remote-capable spellcheck on entered account details', () => {
  for (const id of ['service', 'monthlyPrice', 'hourlyTakeHome']) {
    const input = page.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
    assert.match(input ?? '', /spellcheck="false"/);
  }
});

test('warns that sharing work time can reveal pay indirectly', () => {
  assert.match(page, /Sharing work-time results can reveal your pay indirectly\./);
});

test('wires affordability fields and error focus through the controller', () => {
  assert.match(main, /fieldForError/);
  assert.match(main, /hourlyTakeHome: form\.elements\.hourlyTakeHome/);
  assert.match(main, /workTimeRows: document\.querySelector\('#work-time-rows'\)/);
  assert.match(main, /workPerMonth: document\.querySelector\('#receipt-work-month'\)/);
  assert.match(main, /workPerUsefulSession: document\.querySelector\('#receipt-work-session'\)/);
});

test('uses one release ID across the complete module graph', () => {
  const releaseId = 'subscription-autopsy-20260826-01';

  assert.match(page, new RegExp(`data-build="${releaseId}"`));
  assert.match(page, new RegExp(`src="\\./main\\.mjs\\?v=${releaseId}"`));
  for (const moduleName of ['calculate', 'share', 'view']) {
    assert.match(main, new RegExp(`from '\\./${moduleName}\\.mjs\\?v=${releaseId}'`));
  }
});

test('announces changing status and focuses the result', () => {
  assert.match(page, /id="status"[^>]*aria-live="polite"/);
  assert.match(page, /id="receipt-heading"[^>]*tabindex="-1"/);
});

test('uses a zero-minimum mobile grid to prevent overflow', () => {
  assert.match(
    page,
    /@media \(max-width: 800px\)[\s\S]*?\.hero \{\s*grid-template-columns: minmax\(0, 1fr\)/,
  );
});

test('shrinks the long zero-session result to fit the receipt', () => {
  assert.match(page, /\.big-cost-long \{[^}]*font-size: clamp\(2\.3rem, 7vw, 3\.4rem\);[^}]*\}/s);
});

test('allows the display heading to wrap at 320 pixels', () => {
  assert.match(page, /h1 \{[^}]*overflow-wrap: anywhere;[^}]*\}/);
});

test('supports reduced motion and a printable receipt', () => {
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(page, /@media print/);
});

test('makes its privacy boundary explicit', () => {
  assert.match(
    page,
    /Nothing is uploaded or saved\. Sharing sends or copies the receipt only when you choose it\./,
  );
  assert.doesNotMatch(page, /Nothing leaves this page\./);
  assert.doesNotMatch(page, /localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});
