import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("homepage exposes current identity and LOAF", async () => {
  const html = await read("index.html");
  assert.match(html, /Nikita Vorontsov/);
  assert.match(html, /href=["']\.\/loaf\//);
  assert.match(html, /Engineering lead and product builder in London/);
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
  assert.match(html, /data-domain=["']nikitavorontsov\.com["']/);
  const cssAsset = html.match(/href=["'](\.\/assets\/[^"']+\.css)/)?.[1];
  assert.ok(cssAsset, "packaged LOAF should declare a CSS asset");
  const css = await read(`loaf/${cssAsset.slice(2)}`);
  assert.match(css, /\.\.\/fonts\/bricolage-latin\.woff2/);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.publicPath, "/loaf/");
});
