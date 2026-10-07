import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { analyticsTag, siteHtmlPages, withSiteAnalytics } from "./scripts/install-site-analytics.mjs";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("homepage exposes current identity and LOAF", async () => {
  const html = await read("index.html");
  assert.match(html, /Nikita Vorontsov/);
  assert.match(html, /href=["']\.\/loaf\//);
  assert.match(html, /class="project-tile tile-zookworks"\s+href="\.\/zookworks\/"/);
  assert.match(html, /id="scene-zookworks"/);
  assert.match(html, /data-chapter="2"><span>ZOOKWORKS<\/span>/);
  assert.match(html, /I build products, explore frontier AI/);
  assert.match(html, /https:\/\/char-gen\.com\//);
  assert.match(html, /href=["']\.\/lab\/runbook\//);
  assert.match(html, /linkedin\.com\/in\/nikita-vorontsov-079a39115/);
  assert.match(html, /dev-tab-labels/);
  assert.match(html, /experiments\/date-only/);
  assert.match(html, /More experiments/);
  assert.match(html, /mailto:nikitavorontsov@hotmail\.com/);
  assert.match(html, /github\.com\/GenesisClawbot/);
  assert.match(html, /x\.com\/clawgenesis/);
  assert.match(html, /threads\.com\/@nvorontsov93/);
  assert.doesNotMatch(html, /previously ran under the Jamie Cole name/i);
  assert.match(html, /href=["']\/pr-warrant\//);
  assert.match(html, /href=["']\/one-small-fix\//);
});

test("packaged LOAF points at the personal domain", async () => {
  const html = await read("loaf/index.html");
  const manifest = JSON.parse(await read("loaf/source.json"));
  assert.match(html, /https:\/\/nikitavorontsov\.com\/loaf\//);
  assert.match(html, /property=["']og:image["'][^>]+\/loaf\/og\.png/);
  assert.ok(html.includes(analyticsTag));
  const cssAsset = html.match(/href=["'](\.\/assets\/[^"']+\.css)/)?.[1];
  assert.ok(cssAsset, "packaged LOAF should declare a CSS asset");
  const css = await read(`loaf/${cssAsset.slice(2)}`);
  assert.match(css, /\.\.\/fonts\/bricolage-latin\.woff2/);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.publicPath, "/loaf/");
});

test("packaged ZOOKWORKS points at the personal domain", async () => {
  const html = await read("zookworks/index.html");
  const manifest = JSON.parse(await read("zookworks/source.json"));
  assert.match(html, /rel=["']canonical["'][^>]+https:\/\/nikitavorontsov\.com\/zookworks\//);
  assert.match(html, /property=["']og:image["'][^>]+\/zookworks\/og\.jpg/);
  assert.ok(html.includes(analyticsTag));
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(await read("zookworks/THIRD_PARTY_NOTICES.txt"), /three/);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.publicPath, "/zookworks/");
});

test("every published HTML page uses exactly one shared analytics reference", async () => {
  const pages = siteHtmlPages();
  assert.ok(pages.includes("index.html") && pages.includes("lab/meaning-of-life/index.html"));
  for (const page of pages) {
    const html = await read(page);
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
    assert.equal(html.split(analyticsTag).length - 1, 1, `${page} must load shared analytics once`);
    assert.ok(head.includes(analyticsTag), `${page} must load analytics in its head`);
    assert.doesNotMatch(html, /<script\b[^>]*src=["']https:\/\/plausible\.io\//i, `${page} must not load a second tracker`);
    if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
      assert.match(head, /script-src 'self' https:\/\/plausible\.io\/js\//, `${page} must allow the tracker script`);
      assert.match(head, /connect-src https:\/\/plausible\.io\/api\/event/, `${page} must allow pageview requests`);
    }
  }
});

test("analytics installation replaces old trackers and is idempotent", () => {
  const oldTag = '<script async data-domain="nikitavorontsov.com" src="https://plausible.io/js/script.manual.js"></script>';
  for (const html of [
    "<html><head><title>New page</title></head><body>Content</body></html>",
    `<head>\n${oldTag}\n${analyticsTag}\n<title>Existing page</title></head>`,
  ]) {
    const installed = withSiteAnalytics(html);
    assert.equal(withSiteAnalytics(installed), installed);
    assert.equal(installed.split(analyticsTag).length - 1, 1);
    assert.ok(!installed.includes(oldTag));
  }
  assert.throws(() => withSiteAnalytics("<body>Incomplete page</body>"), /head element/);
});

test("analytics installation keeps lab security policies restricted to the tracker", () => {
  const html = `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; form-action 'none'" /></head>`;
  const installed = withSiteAnalytics(html);
  assert.equal(withSiteAnalytics(installed), installed);
  assert.match(installed, /script-src 'self' https:\/\/plausible\.io\/js\//);
  assert.match(installed, /connect-src https:\/\/plausible\.io\/api\/event/);
  assert.match(installed, /object-src 'none'; form-action 'none'/);
  assert.doesNotMatch(installed, /connect-src \*|script-src \*/);
});

test("shared tracker uses automatic pageviews except for the existing manual game", async () => {
  const source = await read("analytics.js");
  function load(hostname, pathname) {
    const scripts = [];
    const window = { location: { hostname, pathname } };
    const document = {
      getElementById: (id) => scripts.find((script) => script.id === id),
      createElement: () => ({ dataset: {} }),
      head: { append: (script) => scripts.push(script) },
    };
    const context = vm.createContext({ window, document });
    vm.runInContext(source, context);
    vm.runInContext(source, context);
    return { scripts, window };
  }
  for (const pathname of ["/", "/lab/meaning-of-life/", "/loaf/", "/zookworks-unrelated/"]) {
    const { scripts, window } = load("nikitavorontsov.com", pathname);
    assert.equal(scripts.length, 1, "repeated execution must not load the tracker twice");
    assert.equal(scripts[0].dataset.domain, "nikitavorontsov.com");
    assert.equal(scripts[0].src, "https://plausible.io/js/script.js");
    assert.equal(scripts[0].async, true);
    window.plausible("existing-game-event", { props: { level: 2 } });
    assert.equal(window.plausible.q[0][0], "existing-game-event");
  }
  for (const pathname of ["/zookworks", "/zookworks/", "/zookworks/index.html"]) {
    assert.equal(load("nikitavorontsov.com", pathname).scripts[0].src, "https://plausible.io/js/script.manual.js");
  }
  assert.equal(load("www.nikitavorontsov.com", "/").scripts.length, 1);
  for (const hostname of ["localhost", "127.0.0.1", "preview.invalid"]) {
    assert.equal(load(hostname, "/").scripts.length, 0);
  }
  assert.doesNotMatch(source, /\.plausible\(["']pageview/);
});
