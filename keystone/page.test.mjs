import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("Wobblock privacy policy covers ads, purchases, analytics, children and rights", async () => {
  const html = await read("privacy/index.html");
  assert.match(html, /<title>Wobblock privacy policy<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/nikitavorontsov\.com\/keystone\/privacy\/"/);
  assert.match(html, /Last updated \d{1,2} \w+ \d{4}/);
  for (const name of ["Google AdMob", "RevenueCat", "GameAnalytics"]) assert.match(html, new RegExp(name));
  assert.match(html, /not made for children under 13/);
  assert.match(html, /ico\.org\.uk/);
  assert.match(html, /mailto:contact@char-gen\.com/);
  assert.doesNotMatch(html, /hotmail/);
  assert.match(html, /Visits to this website/);
  assert.match(html, /separate from the game's play statistics/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|googletagmanager/);
});
