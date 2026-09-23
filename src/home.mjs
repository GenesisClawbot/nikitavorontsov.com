import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createReferenceMotion } from "./reference-motion.mjs";

gsap.registerPlugin(ScrollTrigger);
const journey = document.querySelector(".journey");
const scenes = [...document.querySelectorAll(".scene")];
const chapters = [...document.querySelectorAll("[data-chapter]")];
const motionButtons = [...document.querySelectorAll(".motion-toggle")];
const reveal = document.querySelector("#art-reveal");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 800px) and (min-height: 640px)");
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const smooth = (lo, hi, n) => {
  const t = clamp((n - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
let stored;
try {
  stored = localStorage.getItem("nv-motion");
} catch {
  /* Private browsing may deny storage. */
}
let motionEnabled = !reduced.matches && stored !== "off";
let timeline;
let world;
let worldLoading = false;
let worldVersion = 0;
let observedChapter = -1;
const referenceMotion = createReferenceMotion();
let manualPaint = null;
let preloadObserver;
const state = { from: 0, to: 0, mix: 0, paint: 1, progress: 0 };

function updateButtons() {
  document.body.dataset.motion = motionEnabled ? "on" : "off";
  motionButtons.forEach((button) => {
    button.hidden = false;
    button.setAttribute("aria-pressed", String(motionEnabled));
    button.querySelector("span").textContent = motionEnabled
      ? "Motion on"
      : "Motion off";
    button.querySelector("img").src =
      `/assets/home/icons/${motionEnabled ? "pause" : "play"}.svg`;
  });
}

function updatePaint(value) {
  state.paint = value;
  document.querySelector(".sketch-art").style.clipPath =
    `inset(0 ${value * 100}% 0 0)`;
  reveal.value = String(Math.round(value * 100));
  world?.setState(state);
}

function update(p) {
  const chapter = p < 0.52 ? 0 : 1;
  if (chapter !== observedChapter) {
    if (chapter !== 0) manualPaint = null;
    // Move focus before making a focused scene inert during keyboard scrolling.
    const outgoing = scenes.find(
      (scene, index) =>
        index !== chapter && scene.contains(document.activeElement),
    );
    if (outgoing) chapters[chapter].focus({ preventScroll: true });
    observedChapter = chapter;
    journey.dataset.chapter = String(chapter);
    scenes.forEach((scene, index) => {
      scene.inert = index !== chapter;
      scene.setAttribute("aria-hidden", String(index !== chapter));
    });
    chapters.forEach((link, index) => {
      if (index === chapter) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }
  // Fade the outgoing copy completely before the next title appears.
  const weights = [1 - smooth(0.43, 0.5, p), smooth(0.54, 0.61, p)];
  scenes.forEach((scene, index) => {
    gsap.set(scene, { autoAlpha: weights[index] });
  });
  gsap.set(".journey-progress span", { scaleX: p });
  Object.assign(
    state,
    p < 0.39
      ? { from: 0, to: 0, mix: 0 }
      : p < 0.65
        ? { from: 0, to: 1, mix: smooth(0.39, 0.65, p) }
        : { from: 1, to: 1, mix: 0 },
  );
  state.progress = p;
  updatePaint(manualPaint ?? smooth(0.015, 0.29, p));
}

async function loadWorld() {
  if (world || worldLoading || !timeline) return;
  const version = worldVersion;
  worldLoading = true;
  try {
    const { createWorld } = await import("./world.mjs");
    if (version !== worldVersion || !timeline) return;
    const next = await createWorld(
      document.querySelector(".world-canvas"),
      () => {
        journey.classList.remove("webgl-ready");
        journey.dataset.renderer = "static";
      },
    );
    if (version !== worldVersion || !timeline) {
      next.dispose();
      return;
    }
    world = next;
    world.setState(state);
    world.setActive(timeline.isActive);
    journey.classList.add("webgl-ready");
    journey.dataset.renderer = "webgl";
  } catch (error) {
    // The semantic image sequence is the fallback; rendering is an enhancement.
    journey.dataset.renderer = "static";
    console.info(
      "Portfolio: using the static artwork sequence.",
      error.message,
    );
  } finally {
    if (version === worldVersion) worldLoading = false;
  }
}

function setupMotion() {
  const wasCinematic = Boolean(timeline);
  const wasInJourney = wasCinematic && timeline.isActive;
  // Preserve the visible static scene when a resize enables the cinematic tour.
  // Its ordinary scroll offset has a different meaning in the longer sticky tour.
  const staticChapter = wasCinematic
    ? -1
    : scenes.findIndex((scene) => {
        const rect = scene.getBoundingClientRect();
        return rect.top <= innerHeight / 2 && rect.bottom > innerHeight / 2;
      });
  const chapterToKeep = Math.max(0, observedChapter);
  worldVersion++;
  worldLoading = false;
  timeline?.kill();
  timeline = null;
  preloadObserver?.disconnect();
  world?.dispose();
  world = null;
  journey.classList.remove("cinematic", "webgl-ready");
  journey.removeAttribute("data-chapter");
  journey.dataset.renderer = "static";
  gsap.set(scenes, { clearProps: "opacity,visibility" });
  scenes.forEach((scene) => {
    scene.inert = false;
    scene.removeAttribute("aria-hidden");
  });
  chapters.forEach((link) => link.removeAttribute("aria-current"));
  observedChapter = -1;
  updateButtons();
  referenceMotion.setEnabled(motionEnabled);
  if (motionEnabled && desktop.matches) {
    journey.classList.add("cinematic");
    timeline = ScrollTrigger.create({
      trigger: journey,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => update(self.progress),
      onToggle: (self) => {
        world?.setActive(self.isActive);
        if (self.isActive) loadWorld();
      },
    });
    if (staticChapter >= 0) {
      const progress = [0.24, 0.82][staticChapter];
      window.scrollTo({
        top: timeline.start + (timeline.end - timeline.start) * progress,
        behavior: "instant",
      });
      update(progress);
    } else {
      update(timeline.progress);
    }
    preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadWorld();
          preloadObserver.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    preloadObserver.observe(journey);
  } else {
    updatePaint(manualPaint ?? 1);
    if (wasInJourney)
      scenes[chapterToKeep].scrollIntoView({
        behavior: "instant",
        block: "start",
      });
  }
  ScrollTrigger.refresh();
}

reveal.closest(".art-control").hidden = false;
reveal.addEventListener("input", () => {
  manualPaint = Number(reveal.value) / 100;
  updatePaint(manualPaint);
});
chapters.forEach((link) =>
  link.addEventListener("click", (event) => {
    if (!timeline) return;
    event.preventDefault();
    const chapter = Number(link.dataset.chapter);
    const positions = [0.24, 0.82];
    const target =
      timeline.start + (timeline.end - timeline.start) * positions[chapter];
    history.replaceState(null, "", link.getAttribute("href"));
    window.scrollTo({ top: target, behavior: "smooth" });
  }),
);
motionButtons.forEach((button) =>
  button.addEventListener("click", () => {
    motionEnabled = !motionEnabled;
    try {
      localStorage.setItem("nv-motion", motionEnabled ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
    setupMotion();
  }),
);
const mediaChanged = () => {
  if (reduced.matches) motionEnabled = false;
  setupMotion();
};
reduced.addEventListener("change", mediaChanged);
desktop.addEventListener("change", setupMotion);
setupMotion();

// The opening remains still. Scroll-driven artwork is the signature motion.
const visibilityChanged = () =>
  world?.setActive(!document.hidden && Boolean(timeline?.isActive));
document.addEventListener("visibilitychange", visibilityChanged);
window.addEventListener(
  "pagehide",
  () => {
    worldVersion++;
    referenceMotion.dispose();
    window.removeEventListener("hashchange", resolveChapterHash);
    preloadObserver?.disconnect();
    timeline?.kill();
    world?.dispose();
    world = null;
    document.removeEventListener("visibilitychange", visibilityChanged);
  },
  { once: true },
);
// A bfcache restoration needs its animation lifecycle installed again.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});

// Article anchors share a stacked position in the enhanced tour. Resolve a
// direct chapter URL after fonts settle so reloads preserve the intended scene.
function resolveChapterHash() {
  const index = chapters.findIndex((link) => link.hash === location.hash);
  if (timeline && index >= 0) {
    ScrollTrigger.refresh();
    window.scrollTo({
      top:
        timeline.start + (timeline.end - timeline.start) * [0.24, 0.82][index],
      behavior: "instant",
    });
  }
}
document.fonts.ready.then(resolveChapterHash);
window.addEventListener("hashchange", resolveChapterHash);
