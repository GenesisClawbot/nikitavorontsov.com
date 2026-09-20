import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8').catch(() => '');
const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8').catch(() => '');
const main = await readFile(new URL('./main.mjs', import.meta.url), 'utf8').catch(() => '');
const request = await readFile(new URL('./request.mjs', import.meta.url), 'utf8').catch(() => '');
const core = await readFile(new URL('./core.mjs', import.meta.url), 'utf8').catch(() => '');
const release = 'pr-warrant-20260825-02';

function colorToken(name) {
  return html.match(new RegExp(`--${name}: (#[0-9a-f]{6})`, 'i'))?.[1];
}

function relativeLuminance(color) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('homepage links to PR Warrant with its exact job', () => {
  assert.match(homepage, /href="\/pr-warrant\/">PR Warrant<\/a>/);
  assert.match(homepage, /Pin one public GitHub pull request to its exact commit range, then end the review with one closed material-defect verdict\./);
});

test('controls fail closed until the module installs its handlers', () => {
  assert.match(html, /<input[^>]+id="pr-url"[^>]+disabled/);
  assert.match(html, /<button[^>]+id="issue-button"[^>]+disabled/);
  assert.match(html, /id="lookup-status"[^>]*>Loading the warrant desk/);
  assert.match(html, /onerror="[^"].*could not load/i);
  assert.match(main, /prUrl\.disabled = false/);
  assert.doesNotMatch(main, /prUrl\.disabled = isBusy/);
});

test('clipboard fallback restores focus and ignores stale completion state', () => {
  assert.match(main, /previouslyFocused/);
  assert.match(main, /finally/);
  assert.match(main, /copyRequest/);
  assert.match(main, /copyRequest === requestNumber/);
});

test('small red labels use a darker text token', () => {
  assert.match(html, /--red-text: #[0-9a-f]{6}/i);
  assert.match(html, /\.scope-list strong \{[^}]*color: var\(--red-text\)/s);
  assert.match(html, /\.status-stamp \{[^}]*color: var\(--red-text\)/s);
  assert.ok(contrastRatio(colorToken('red-text'), colorToken('paper')) >= 4.5);
  assert.ok(contrastRatio(colorToken('red-text'), colorToken('folder')) >= 4.5);
  assert.ok(contrastRatio(colorToken('blue'), colorToken('folder')) >= 4.5);
});

test('page presents one exact public PR lookup with an accessible result', () => {
  assert.match(html, /<html lang="en" data-build="pr-warrant-20260825-02">/);
  assert.match(html, /<title>PR Warrant<\/title>/);
  assert.match(html, /<form[^>]+id="warrant-form"/);
  assert.match(html, /<label[^>]+for="pr-url"/);
  assert.match(html, /<input[^>]+id="pr-url"[^>]+type="url"[^>]+required/);
  assert.match(html, /<button[^>]+id="issue-button"[^>]+type="submit"/);
  assert.match(html, /id="lookup-status"[^>]+aria-live="polite"/);
  assert.match(html, /id="warrant"[^>]+hidden[^>]+aria-labelledby="warrant-heading"/);
  assert.match(html, /id="warrant-heading"[^>]+tabindex="-1"/);
  assert.match(html, /id="copy-brief"/);
  assert.match(html, /id="copy-check"/);
});

test('page explains the closed review verdict before lookup', () => {
  assert.match(html, /name="description" content="Pin one public GitHub pull request to its exact commits and end review loops with one closed material-defect verdict\."/);
  assert.match(html, /high- or medium-severity defects/i);
  assert.match(html, /YES with evidence or NO/i);
  assert.match(html, /If the answer is NO, the review stops\./i);
});

test('page states the network, storage, and product boundaries', () => {
  assert.match(html, /public GitHub pull requests only/i);
  assert.match(html, /one request to GitHub's public API/i);
  assert.match(html, /not saved|does not save/i);
  assert.match(html, /does not prove.*reviewer obeyed/i);
  assert.doesNotMatch(html, /token|password|private pull request/i);
  assert.match(html, /Maintained by <strong>Nikita Vorontsov<\/strong>\. Built with AI\./);
});

test('page uses local assets, visible focus, responsive layout, and reduced motion', () => {
  assert.match(html, /url\('\/play\/fonts\/bricolage-grotesque-latin\.woff2'\)/);
  assert.match(html, /url\('\/play\/fonts\/public-sans-latin\.woff2'\)/);
  assert.match(html, /url\('\/play\/fonts\/spline-sans-mono-latin\.woff2'\)/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /@media \(max-width:/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(html, /https?:\/\/[^"')]+\.(?:woff2?|ttf|otf)/i);
});

test('browser controller fails closed, ignores stale requests, and renders untrusted text safely', () => {
  const controller = `${main}${request}`;
  assert.match(controller, /AbortController/);
  assert.match(controller, /requestNumber/);
  assert.match(controller, /response\.ok/);
  assert.match(controller, /textContent/);
  assert.match(controller, /navigator\.clipboard\.writeText/);
  assert.match(controller, /document\.execCommand\('copy'\)/);
  assert.match(controller, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(controller, /innerHTML/);
});

test('one release marker pins the page and both modules', () => {
  assert.match(html, new RegExp(`main\\.mjs\\?v=${release}`));
  assert.match(main, new RegExp(`core\\.mjs\\?v=${release}`));
  assert.match(main, new RegExp(`request\\.mjs\\?v=${release}`));
  assert.match(request, new RegExp(`core\\.mjs\\?v=${release}`));
  assert.match(core, /export function parsePullRequestUrl/);
});
