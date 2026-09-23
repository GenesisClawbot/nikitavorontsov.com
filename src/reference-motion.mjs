/**
 * Adapted from React Bits by David Haz (MIT + Commons Clause).
 * Pinned upstream: c5df8610c0b47d7cd805cda480baba402f7267c1
 * - src/content/Components/TiltedCard/TiltedCard.jsx
 * Licence: assets/home/licenses/react-bits.md
 * Adaptations: vanilla DOM, semantic links, smaller tilt, no cursor tooltip,
 * shared motion preference, scoped cleanup. See docs/reference-provenance.md.
 */
import { springValue, styleEffect } from "motion";

// React Bits TiltedCard's original physical spring parameters.
const springValues = { damping: 30, stiffness: 100, mass: 2 };

function tiltedCard(link) {
  const surface = link.querySelector(".tile-surface");
  const rotateX = springValue(0, springValues);
  const rotateY = springValue(0, springValues);
  const scale = springValue(1, springValues);
  const stopStyle = styleEffect(surface, { rotateX, rotateY, scale });
  const rotateAmplitude = 3;
  const move = (event) => {
    if (event.pointerType === "touch") return;
    const rect = link.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    // Direct adaptation of TiltedCard's centre-normalised pointer mapping.
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
    scale.set(1.015);
  };
  const leave = () => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  };
  link.addEventListener("pointermove", move, { passive: true });
  link.addEventListener("pointerleave", leave);
  return () => {
    link.removeEventListener("pointermove", move);
    link.removeEventListener("pointerleave", leave);
    stopStyle();
    [rotateX, rotateY, scale].forEach((value) => value.destroy());
    surface.style.removeProperty("transform");
  };
}

// Original portrait treatment: separate framed planes, with a clipped lower edge.
function portraitDepth(host) {
  const rig = host.querySelector(".portrait-rig");
  const photo = host.querySelector(".portrait-window img");
  const settings = { damping: 28, stiffness: 150, mass: 1 };
  const rotateX = springValue(0, settings);
  const rotateY = springValue(0, settings);
  const x = springValue(0, settings);
  const y = springValue(0, settings);
  const stopRig = styleEffect(rig, { rotateX, rotateY });
  const stopPhoto = styleEffect(photo, { x, y });
  const leave = () => {
    [rotateX, rotateY, x, y].forEach((value) => value.set(0));
  };
  const move = (event) => {
    if (event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    const nx = Math.max(
      -1,
      Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
    );
    const ny = Math.max(
      -1,
      Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    rotateX.set(-ny * 7);
    rotateY.set(nx * 8);
    x.set(nx * 5);
    y.set(ny * 3);
  };
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", leave);
  host.addEventListener("pointercancel", leave);
  return () => {
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
    host.removeEventListener("pointercancel", leave);
    stopRig();
    stopPhoto();
    [rotateX, rotateY, x, y].forEach((value) => value.destroy());
    rig.style.removeProperty("transform");
    photo.style.removeProperty("transform");
  };
}

export function createReferenceMotion() {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  let enabled = false;
  let stopCards = [];
  const syncCards = () => {
    stopCards.forEach((stop) => stop());
    stopCards =
      enabled && finePointer.matches
        ? [...document.querySelectorAll(".project-tile")].map(tiltedCard)
        : [];
    const portrait = document.querySelector(".hero-portrait");
    if (enabled && finePointer.matches && portrait)
      stopCards.push(portraitDepth(portrait));
  };
  finePointer.addEventListener("change", syncCards);
  return {
    setEnabled(value) {
      enabled = value;
      syncCards();
    },
    dispose() {
      enabled = false;
      stopCards.forEach((stop) => stop());
      finePointer.removeEventListener("change", syncCards);
    },
  };
}
