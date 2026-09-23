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
