import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("Sincely privacy policy covers on-device data, the purchase, children and rights", async () => {
  const html = await read("privacy/index.html");
  assert.match(html, /<title>Sincely privacy policy<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/nikitavorontsov\.com\/sincely\/privacy\/"/);
  assert.match(html, /Last updated \d{1,2} \w+ \d{4}/);
  assert.match(html, /RevenueCat/);
  assert.doesNotMatch(html, /AdMob|GameAnalytics|boosters|levels/);
  assert.match(html, /Your counters, their dates, history and settings are saved on your device/);
  assert.match(html, /not made for children under 13/);
  assert.match(html, /ico\.org\.uk/);
  assert.match(html, /mailto:contact@char-gen\.com/);
  assert.match(html, /Visits to this website/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|googletagmanager/);
});
