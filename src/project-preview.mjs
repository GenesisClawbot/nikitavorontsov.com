import { animate } from "motion/mini";

// Manual product inspection. No auto-advance, pointer tilt or text animation.
export function createProjectPreview() {
  const root = document.querySelector(".featured-product");
  if (!root) return { setEnabled() {}, dispose() {} };
  const tablist = root.querySelector(".preview-tabs");
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) =>
    document.getElementById(tab.getAttribute("aria-controls")),
  );
  let active = 0;
  let motionEnabled = false;
  let transition;

  function settle() {
    transition?.stop();
    transition = null;
    panels.forEach((panel, i) => {
      panel.hidden = i !== active;
      panel.inert = i !== active;
      panel.setAttribute("aria-hidden", String(i !== active));
      panel.style.removeProperty("opacity");
      panel.style.removeProperty("z-index");
    });
  }
  function select(index) {
    if (index === active) return;
    settle();
    const outgoing = panels[active];
    active = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === active));
      tab.tabIndex = i === active ? 0 : -1;
    });
    settle();
    if (motionEnabled) {
      outgoing.hidden = false;
      panels[active].style.zIndex = "1";
      const animation = animate(
        panels[active],
        { opacity: [0, 1] },
        {
          duration: 0.24,
          ease: [0.22, 1, 0.36, 1],
        },
      );
      transition = animation;
      animation.then(() => {
        if (transition === animation) settle();
      });
    }
  }
  const onClick = (event) => {
    const index = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (index >= 0) select(index);
  };
  const onKey = (event) => {
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    tabs[next].focus();
  };
  settle();
  tablist.hidden = false;
  tablist.addEventListener("click", onClick);
  tablist.addEventListener("keydown", onKey);
  return {
    setEnabled(enabled) {
      motionEnabled = enabled;
      if (!enabled) settle();
    },
    dispose() {
      settle();
      tablist.removeEventListener("click", onClick);
      tablist.removeEventListener("keydown", onKey);
    },
  };
}
