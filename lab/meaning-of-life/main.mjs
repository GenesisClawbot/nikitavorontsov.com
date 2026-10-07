const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const status = document.querySelector('#play-status');
let sequential = false;
let active = 0;

function select(index, { focus = false } = {}) {
  active = index;
  panels.forEach((panel, i) => {
    if (i !== index) panel.querySelector('video').pause();
    panel.hidden = i !== index;
  });
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  if (focus) tabs[index].focus();
  history.replaceState(null, '', `#${tabs[index].dataset.model}`);
}

async function play(index) {
  select(index);
  const video = panels[index].querySelector('video');
  video.currentTime = 0;
  status.textContent = `Playing ${index + 1} of 3: ${tabs[index].textContent.replace(/\s+/g, ' ').trim()}.`;
  try { await video.play(); }
  catch {
    if (active === index) status.textContent = 'Press play on the film to continue. Your browser paused automatic playback.';
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    sequential = false;
    select(index);
    status.textContent = 'One minute each. Press play to watch this full film.';
  });
  tab.addEventListener('keydown', event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % 3
      : event.key === 'ArrowLeft' ? (index + 2) % 3
      : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
    if (next === null) return;
    event.preventDefault();
    sequential = false;
    select(next, { focus: true });
    status.textContent = 'One minute each. Press play to watch this full film.';
  });
});

panels.forEach((panel, index) => {
  const video = panel.querySelector('video');
  video.addEventListener('ended', () => {
    if (!sequential || active !== index) return;
    if (index < 2) play(index + 1);
    else {
      sequential = false;
      status.textContent = 'All three films finished. Which answer stayed with you?';
    }
  });
  video.addEventListener('error', () => {
    if (active === index) status.textContent = 'The player could not load this film. Try the “Open the full film” link below.';
  });
});

document.querySelector('#watch-all').addEventListener('click', () => {
  sequential = true;
  play(0);
});
const requested = tabs.findIndex(tab => `#${tab.dataset.model}` === location.hash);
if (requested >= 0) select(requested);
