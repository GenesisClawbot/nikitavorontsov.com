import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../analytics.js", import.meta.url), "utf8");

function film(id = "meaning-of-life-opus") {
  const listeners = new Map();
  return {
    dataset: { analyticsFilm: id }, duration: 60, ranges: [],
    get played() {
      const ranges = this.ranges;
      return { length: ranges.length, start: i => ranges[i][0], end: i => ranges[i][1] };
    },
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    },
    emit(name = "timeupdate") { for (const fn of listeners.get(name) ?? []) fn(); },
    listenerCount(name) { return (listeners.get(name) ?? []).length; },
  };
}

function load(videos, { hostname = "nikitavorontsov.com", pathname = "/lab/meaning-of-life/", search = "", hash = "" } = {}) {
  const scripts = [];
  const events = [];
  const window = { location: { hostname, pathname, search, hash } };
  const document = {
    getElementById: id => scripts.find(script => script.id === id),
    createElement: () => ({ dataset: {} }),
    head: { append: script => scripts.push(script) },
    querySelectorAll: selector => {
      assert.equal(selector, "video[data-analytics-film]");
      return videos;
    },
  };
  const context = vm.createContext({ window, document });
  const run = () => vm.runInContext(source, context);
  run();
  const receive = () => {
    const queued = [...(window.plausible?.q ?? [])];
    window.plausible = (name, options) => events.push(JSON.parse(JSON.stringify({ name, ...options })));
    for (const args of queued) window.plausible(...args);
  };
  return { window, events, scripts, run, receive };
}

const names = events => events.map(event => event.name.replace(/ - [\w-]+$/, ""));

test("loading a film, pressing play without playback and invalid durations emit nothing", () => {
  const video = film(); const tracker = load([video]); tracker.receive();
  video.emit("play"); video.emit("timeupdate"); video.emit("ended");
  for (const duration of [0, NaN, Infinity]) {
    video.duration = duration; video.ranges = [[0, 60]]; video.emit();
  }
  assert.deepEqual(tracker.events, []);
});

test("the observed 3.7 second seek-to-end case is a start, not 90 percent coverage", () => {
  const video = film(); const tracker = load([video]); tracker.receive();
  video.currentTime = 60; video.ended = true;
  video.ranges = [[0, 2.957682], [59.241877, 60]]; video.emit("ended");
  assert.deepEqual(names(tracker.events), ["Film started"]);
});

test("90 percent uses played ranges and emits once across pause, resume and replay", () => {
  const video = film(); const tracker = load([video]); tracker.receive();
  video.ranges = [[0, 53.99]]; video.emit(); video.emit("pause");
  assert.deepEqual(names(tracker.events), ["Film started"]);
  video.ranges = [[0, 54]]; video.emit();
  video.ranges = [[0, 60]]; video.emit("ended"); video.emit("play"); video.emit();
  assert.deepEqual(names(tracker.events), ["Film started", "Film 90 percent played"]);
  assert.deepEqual(tracker.events[1], { name: "Film 90 percent played - meaning-of-life-opus" });
});

test("replaying one section does not add coverage and disjoint played sections do", () => {
  const video = film(); const tracker = load([video]); tracker.receive();
  video.ranges = [[0, 20]];
  for (let i = 0; i < 5; i++) video.emit("pause");
  assert.deepEqual(names(tracker.events), ["Film started"]);
  video.ranges = [[0, 20], [26, 60]]; video.emit("ended");
  assert.equal(tracker.events.length, 2);
});

test("late tracker loading drains queued events without needing another playback event", () => {
  const video = film(); const tracker = load([video]);
  video.ranges = [[0, 60]]; video.emit("ended");
  assert.equal(tracker.window.plausible.q.length, 2);
  tracker.receive();
  assert.deepEqual(names(tracker.events), ["Film started", "Film 90 percent played"]);
});

test("films count separately, but executing the shared script twice adds no duplicate listeners", () => {
  const videos = [film("meaning-of-life-sol"), film("meaning-of-life-astra"), film(), film("ai-purpose-opus")];
  const tracker = load(videos); tracker.run(); tracker.receive();
  for (const video of videos) {
    assert.equal(video.listenerCount("ended"), 1);
    video.ranges = [[0, 60]]; video.emit("ended");
  }
  assert.equal(tracker.scripts.length, 1);
  assert.equal(tracker.events.length, 8);
  assert.deepEqual(tracker.events.map(event => event.name).sort(), [
    "ai-purpose-opus", "meaning-of-life-astra", "meaning-of-life-opus", "meaning-of-life-sol",
  ].flatMap(id => [`Film started - ${id}`, `Film 90 percent played - ${id}`]).sort());
  assert.ok(tracker.events.every(event => Object.keys(event).join() === "name"));
});

test("local previews and book callback URLs never start playback tracking", () => {
  for (const location of [
    { hostname: "localhost" }, { hostname: "127.0.0.1" },
    { pathname: "/books/auth/", search: "?code=synthetic" },
    { pathname: "/books/privacy/", hash: "#synthetic" },
  ]) {
    const video = film(); const tracker = load([video], location);
    video.ranges = [[0, 60]]; video.emit("ended");
    assert.equal(tracker.scripts.length, 0);
    assert.equal(video.listenerCount("ended"), 0);
    assert.equal(tracker.window.plausible, undefined);
  }
});

test("only the four existing full films opt in with distinct static identifiers", async () => {
  const pages = ["meaning-of-life", "ai-purpose"];
  const ids = [];
  for (const page of pages) {
    const html = await readFile(new URL(`./${page}/index.html`, import.meta.url), "utf8");
    const videos = [...html.matchAll(/<video\b[^>]*>/g)].map(match => match[0]);
    for (const video of videos) {
      const id = video.match(/data-analytics-film="([^"]+)"/)?.[1];
      assert.ok(id, `${page} film must have a static analytics identifier`);
      ids.push(id);
    }
  }
  assert.deepEqual(ids.sort(), ["ai-purpose-opus", "meaning-of-life-astra", "meaning-of-life-opus", "meaning-of-life-sol"]);
});
