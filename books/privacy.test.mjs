import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { withSiteAnalytics } from '../scripts/install-site-analytics.mjs';

const analytics = await readFile(new URL('../analytics.js', import.meta.url), 'utf8');
const paths = ['/books/', '/books/privacy/', '/books/delete-account/', '/books/auth/'];

function runPage(html, pathname, failHistory = false) {
  const location = { hostname: 'nikitavorontsov.com', pathname, search: '?code=synthetic-code', hash: '#access_token=synthetic-token' };
  const scripts = [];
  const historyCalls = [];
  const context = vm.createContext({
    location,
    window: { location },
    history: { replaceState(...args) {
      historyCalls.push(args);
      if (failHistory) throw new Error('History unavailable');
      assert.deepEqual(args, [null, '', pathname]);
      location.search = ''; location.hash = '';
    } },
    document: {
      getElementById: id => scripts.find(s => s.id === id),
      createElement: () => ({ dataset: {} }),
      querySelectorAll: () => [],
      head: { append: s => scripts.push(s) },
    },
  });
  // Synchronous inline scripts run before the site's deferred external script,
  // including after the existing analytics installer moves its tag earlier.
  const deferred = [];
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attributes.includes('src=')) {
      assert.match(attributes, /\bdefer\b/);
      assert.match(attributes, /src="\/analytics\.js"/);
      deferred.push(analytics);
    } else vm.runInContext(body, context);
  }
  for (const script of deferred) vm.runInContext(script, context);
  return { context, scripts, historyCalls, location };
}

for (const pathname of paths) {
  const html = await readFile(new URL(`.${pathname.slice('/books'.length)}index.html`, import.meta.url), 'utf8');
  test(`${pathname} removes callback data before tracking, also after analytics installation`, () => {
    for (const source of [html, withSiteAnalytics(html)]) {
      const result = runPage(source, pathname);
      assert.equal(result.location.search, '');
      assert.equal(result.location.hash, '');
      assert.equal(result.historyCalls.length, 1);
      assert.equal(result.scripts.length, 1);
      assert.match(source, /name="referrer" content="no-referrer"/);
      assert.doesNotMatch(source, /(?:href|src)="[^"]*(?:synthetic-code|synthetic-token)/);
    }
  });
  test(`${pathname} never starts analytics when history sanitisation throws`, () => {
    const { context, scripts, location } = runPage(withSiteAnalytics(html), pathname, true);
    assert.equal(scripts.length, 0);
    assert.equal(context.window.plausible, undefined);
    assert.ok(location.search && location.hash);
  });
}

test('auth fallback has no credential-forwarding app link or input', async () => {
  const html = await readFile(new URL('./auth/index.html', import.meta.url), 'utf8');
  assert.deepEqual([...html.matchAll(/href="(bookcompanion:[^"]*)"/g)].map(m => m[1]), ['bookcompanion://']);
  assert.doesNotMatch(html, /<(?:form|input)\b|localStorage|sessionStorage|fetch\(/);
});
