import {
  approve,
  canShip,
  challengeUrl,
  createGame,
  createRandomSeed,
  formatSeed,
  machineStage,
  nextProposal,
  normalizeSeed,
  outcomeTitle,
  reject,
  shareText,
  ship,
  startGame,
} from './game.mjs?v=one-bug-please-20260828-01';

const BOOT_ID = document.documentElement.dataset.bootId;
const BOOT_STORAGE_KEY = 'one-bug-please-boot-id';
const MACHINE_LABELS = ['PATCH BOT', 'GEAR TRAIN', 'MACHINE HALL', 'SCOPE REACTOR'];
const MACHINES = [
  { src: './assets/machine-stage-0.webp', sentence: 'Stage 0. A tiny patch bot waits at an empty repair bench.' },
  { src: './assets/machine-stage-1.webp', sentence: 'Stage 1. A small gear train has joined the patch bot.' },
  { src: './assets/machine-stage-2.webp', sentence: 'Stage 2. The patch bot now runs a crowded machine hall.' },
  { src: './assets/machine-stage-3.webp', sentence: 'Stage 3. The tiny patch has become a full scope reactor.' },
];
const ELEMENT_IDS = {
  gameShell: 'game-shell',
  bootStatus: 'boot-status',
  ticketTitle: 'ticket-title',
  ticketBrief: 'ticket-brief',
  seed: 'seed',
  turn: 'turn',
  context: 'context',
  contextFuse: 'context-fuse',
  checks: 'checks',
  files: 'files',
  lines: 'lines',
  machineFrame: 'machine-frame',
  machinePrevious: 'machine-previous',
  machineCurrent: 'machine-current',
  machineStage: 'machine-stage',
  proposal: 'proposal',
  proposalNumber: 'proposal-number',
  proposalHeading: 'proposal-heading',
  proposalPitch: 'proposal-pitch',
  proposalPaths: 'proposal-paths',
  proposalLines: 'proposal-lines',
  proposalCost: 'proposal-cost',
  approve: 'approve',
  reject: 'reject',
  reveal: 'reveal',
  revealVerdict: 'reveal-verdict',
  revealHeading: 'reveal-heading',
  revealCopy: 'reveal-copy',
  next: 'next',
  start: 'start',
  ship: 'ship',
  shipCondition: 'ship-condition',
  share: 'share',
  sound: 'sound',
  shortcuts: 'shortcuts',
  result: 'result',
  resultHeading: 'result-heading',
  resultTicket: 'result-ticket',
  resultSeed: 'result-seed',
  resultFiles: 'result-files',
  resultLines: 'result-lines',
  resultContext: 'result-context',
  resultScope: 'result-scope',
  resultStage: 'result-stage',
  resultShare: 'result-share',
  newTicket: 'new-ticket',
  challengeFallback: 'challenge-fallback',
  challengeUrl: 'challenge-url',
  liveRegion: 'live-region',
};

let elements;
let state;
let reducedMotion = true;
let motionTimer;
let machineTimer;
let renderedMachineStage = null;
let pendingMachineStage = null;
let machineRequest = 0;
let cues = {};
let soundEnabled = false;
let soundAvailable = true;
let soundRequest = 0;
let shortcutsEnabled = true;

function collectElements() {
  return Object.fromEntries(Object.entries(ELEMENT_IDS).map(([name, id]) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required element: ${id}`);
    return [name, element];
  }));
}

function fillRandom(bytes) {
  if (window.crypto?.getRandomValues) return window.crypto.getRandomValues(bytes);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function resolveSeed() {
  const url = new URL(window.location.href);
  const supplied = normalizeSeed(url.searchParams.get('seed'));
  const seed = supplied ?? createRandomSeed(fillRandom);
  const canonical = challengeUrl(url, seed);
  if (url.href !== canonical) window.history.replaceState(null, '', canonical);
  return seed;
}

function hardReload(nextBootId) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('boot') === nextBootId) return false;
  url.searchParams.set('boot', nextBootId);
  elements.bootStatus.textContent = 'Updating the repair bench.';
  window.location.replace(url);
  return true;
}

function installBootGuard() {
  try {
    const latestBootId = window.localStorage.getItem(BOOT_STORAGE_KEY);
    if (latestBootId && latestBootId > BOOT_ID) {
      if (hardReload(latestBootId)) return false;
    }
    if (!latestBootId || BOOT_ID > latestBootId) {
      window.localStorage.setItem(BOOT_STORAGE_KEY, BOOT_ID);
    }
  } catch {
    // A blocked local store does not block the game.
  }

  window.addEventListener('storage', (event) => {
    if (event.key === BOOT_STORAGE_KEY && event.newValue && event.newValue > BOOT_ID) {
      hardReload(event.newValue);
    }
  });

  const loadedUrl = new URL(window.location.href);
  if (loadedUrl.searchParams.get('boot') === BOOT_ID) {
    loadedUrl.searchParams.delete('boot');
    window.history.replaceState(null, '', loadedUrl);
  }
  return true;
}

function motionPreference() {
  if (typeof window.matchMedia !== 'function') return { matches: true };
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return { matches: true };
  }
}

function announce(message) {
  elements.liveRegion.textContent = '';
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      elements.liveRegion.textContent = message;
    });
  });
}

function renderMetrics() {
  elements.seed.textContent = formatSeed(state.seed);
  elements.turn.textContent = `${state.turn} / ${state.deck.length}`;
  elements.context.textContent = String(state.context);
  elements.files.textContent = String(state.touchedFiles.length);
  elements.lines.textContent = String(state.changedLines);
  elements.contextFuse.style.height = `${state.context}%`;
  elements.contextFuse.style.background = state.context === 0
    ? 'var(--red)'
    : state.context <= 40 ? 'var(--amber)' : 'var(--spruce)';
}

function renderChecks() {
  const rows = state.ticket.checks.map((check) => {
    const passed = state.checks.includes(check.id);
    const row = document.createElement('li');
    const status = document.createElement('strong');
    status.textContent = passed ? 'PASS' : 'OPEN';
    row.append(status, ` ${passed ? 'Passed' : 'Not checked'}: ${check.label}`);
    return row;
  });
  elements.checks.replaceChildren(...rows);
}

function hidePreviousMachine() {
  elements.machineFrame.dataset.swap = 'idle';
  elements.machinePrevious.hidden = true;
  elements.machinePrevious.removeAttribute('src');
}

function renderMachine() {
  const stage = machineStage(state.scopeWeight);
  const machine = MACHINES[stage];
  elements.machineFrame.dataset.stage = String(stage);
  elements.machineStage.textContent = machine.sentence;
  if (stage === renderedMachineStage || stage === pendingMachineStage) return;

  window.clearTimeout(machineTimer);
  if (renderedMachineStage === null || reducedMotion) {
    machineRequest += 1;
    pendingMachineStage = null;
    hidePreviousMachine();
    elements.machineCurrent.hidden = false;
    elements.machineCurrent.setAttribute('src', machine.src);
    renderedMachineStage = stage;
    return;
  }

  hidePreviousMachine();
  const request = machineRequest + 1;
  machineRequest = request;
  pendingMachineStage = stage;
  const preload = new Image();
  preload.addEventListener('load', () => {
    if (request !== machineRequest || machineStage(state.scopeWeight) !== stage) return;
    pendingMachineStage = null;
    const currentSource = elements.machineCurrent.getAttribute('src');
    if (currentSource) {
      elements.machinePrevious.hidden = false;
      elements.machinePrevious.setAttribute('src', currentSource);
    }
    elements.machineCurrent.hidden = false;
    elements.machineCurrent.setAttribute('src', machine.src);
    renderedMachineStage = stage;
    elements.machineFrame.dataset.swap = 'idle';
    void elements.machineFrame.offsetWidth;
    elements.machineFrame.dataset.swap = 'active';
    machineTimer = window.setTimeout(() => {
      if (request !== machineRequest) return;
      hidePreviousMachine();
    }, 450);
  }, { once: true });
  preload.addEventListener('error', () => {
    if (request !== machineRequest) return;
    pendingMachineStage = null;
    hidePreviousMachine();
    elements.machineCurrent.hidden = true;
    renderedMachineStage = stage;
  }, { once: true });
  preload.src = machine.src;
}

function renderProposal() {
  const proposal = state.deck[state.turn - 1];
  if (!proposal) return;
  elements.proposalNumber.textContent = String(state.turn);
  elements.proposalHeading.textContent = proposal.title;
  elements.proposalPitch.textContent = proposal.pitch;
  elements.proposalPaths.replaceChildren(...proposal.files.map((path) => {
    const item = document.createElement('li');
    item.textContent = path;
    return item;
  }));
  elements.proposalLines.textContent = String(proposal.lines);
  elements.proposalCost.textContent = String(proposal.contextCost);
}

function renderReveal() {
  if (!state.lastReveal) return;
  elements.revealVerdict.textContent = state.lastReveal.verdict;
  elements.revealVerdict.classList.toggle('scope', state.lastReveal.verdict === 'SCOPE CREEP');
  elements.revealHeading.textContent = state.lastReveal.action === 'approve'
    ? 'Proposal approved'
    : 'Proposal rejected';
  elements.revealCopy.textContent = state.lastReveal.text;
}

function renderResult() {
  const stage = machineStage(state.scopeWeight);
  elements.resultHeading.textContent = outcomeTitle(state);
  elements.resultTicket.textContent = state.ticket.title;
  elements.resultSeed.textContent = formatSeed(state.seed);
  elements.resultFiles.textContent = String(state.touchedFiles.length);
  elements.resultLines.textContent = String(state.changedLines);
  elements.resultContext.textContent = String(state.context);
  elements.resultScope.textContent = String(state.acceptedScopeCount);
  elements.resultStage.textContent = MACHINE_LABELS[stage];
}

function render() {
  const phase = state.phase;
  elements.gameShell.dataset.phase = phase;
  elements.ticketTitle.textContent = state.ticket.title;
  elements.ticketBrief.textContent = state.ticket.brief;
  renderMetrics();
  renderChecks();
  renderMachine();
  renderProposal();
  if (state.lastReveal) renderReveal();
  if (phase === 'result') renderResult();

  elements.start.hidden = phase !== 'briefing';
  elements.start.disabled = phase !== 'briefing';
  elements.proposal.hidden = phase !== 'deciding';
  elements.reveal.hidden = phase !== 'revealed';
  elements.result.hidden = phase !== 'result';
  elements.approve.disabled = phase !== 'deciding';
  elements.reject.disabled = phase !== 'deciding';
  elements.next.disabled = phase !== 'revealed';
  elements.resultShare.disabled = phase !== 'result';
  elements.newTicket.disabled = phase !== 'result';
  elements.share.textContent = phase === 'result' ? 'Challenge a friend' : 'Share challenge';

  const ready = canShip(state);
  elements.ship.disabled = !ready;
  if (phase === 'result') {
    elements.shipCondition.textContent = 'Run complete.';
  } else if (ready) {
    elements.shipCondition.textContent = 'Ready. Pull the lever before the agent keeps going.';
  } else {
    const remaining = 3 - state.checks.length;
    elements.shipCondition.textContent = `Finish ${remaining} acceptance checks to ship.`;
  }
}

function focusAfterTransition(previous, next) {
  window.requestAnimationFrame(() => {
    if (next.phase === 'deciding') elements.proposalHeading.focus();
    else if (next.phase === 'revealed') elements.revealHeading.focus();
    else if (next.phase === 'result') elements.resultHeading.focus();
  });
}

function announceTransition(previous, next) {
  if (next.phase === 'result') {
    announce(`${outcomeTitle(next)}. ${next.context} context. ${next.touchedFiles.length} files. ${next.changedLines} lines.`);
  } else if (previous.phase === 'deciding' && next.lastReveal) {
    const action = next.lastReveal.action === 'approve' ? 'Approved' : 'Rejected';
    announce(`${action}. ${next.lastReveal.verdict}. ${next.context} context. ${next.touchedFiles.length} files. ${next.changedLines} lines.`);
  } else if (previous.phase === 'briefing' && next.phase === 'deciding') {
    announce('Repair started. Review proposal 1.');
  }
}

function transition(reducer, motionName) {
  const previous = state;
  const next = reducer(state);
  if (next === state) return;

  window.clearTimeout(motionTimer);
  elements.proposal.removeAttribute('aria-hidden');
  const duration = reducedMotion ? 0 : ({ approve: 450, reject: 300, ship: 400 }[motionName] ?? 0);
  const preserveProposal = duration > 0
    && next.phase === 'revealed'
    && (motionName === 'approve' || motionName === 'reject');

  state = next;
  if (motionName === 'approve' || motionName === 'reject' || motionName === 'ship') {
    playCue(motionName);
  }
  elements.gameShell.dataset.motion = duration > 0 ? motionName : 'idle';
  render();
  if (preserveProposal) {
    elements.proposal.hidden = false;
    elements.proposal.setAttribute('aria-hidden', 'true');
  }
  announceTransition(previous, next);
  focusAfterTransition(previous, next);

  if (duration === 0) return;
  motionTimer = window.setTimeout(() => {
    if (state !== next) return;
    elements.gameShell.dataset.motion = 'idle';
    if (state.phase === 'revealed') elements.proposal.hidden = true;
    elements.proposal.removeAttribute('aria-hidden');
  }, duration);
}

function isInteractiveTarget(target) {
  return target instanceof HTMLElement && (
    Boolean(target.closest('button, input, textarea, select, a[href]'))
    || target.isContentEditable
  );
}

function setShortcuts(enabled) {
  shortcutsEnabled = enabled;
  elements.shortcuts.setAttribute('aria-pressed', String(shortcutsEnabled));
  elements.shortcuts.textContent = shortcutsEnabled ? 'Shortcuts on' : 'Shortcuts off';
}

function setSound(enabled) {
  soundEnabled = soundAvailable && enabled;
  if (!soundEnabled) {
    soundRequest += 1;
    for (const cue of Object.values(cues)) cue.pause();
  }
  elements.sound.setAttribute('aria-pressed', String(soundEnabled));
  elements.sound.textContent = soundEnabled ? 'Sound on' : 'Sound off';
}

function disableSound() {
  soundAvailable = false;
  setSound(false);
  elements.sound.disabled = true;
  elements.bootStatus.textContent = 'Sound unavailable. Continuing in silence.';
}

function initializeAudio() {
  try {
    cues = {
      approve: new Audio('./assets/approve.mp3'),
      reject: new Audio('./assets/reject.mp3'),
      ship: new Audio('./assets/ship.mp3'),
    };
    for (const cue of Object.values(cues)) {
      cue.preload = 'auto';
      cue.addEventListener('error', disableSound);
    }
    elements.sound.disabled = false;
  } catch {
    window.requestAnimationFrame(disableSound);
  }
}

function playCue(name) {
  const cue = cues[name];
  if (!soundEnabled || !cue) return;
  const request = soundRequest + 1;
  soundRequest = request;
  cue.currentTime = 0;
  cue.play().catch(() => {
    if (request === soundRequest) disableSound();
  });
}

async function shareChallenge() {
  const text = shareText(state, window.location.href);
  const url = challengeUrl(window.location.href, state.seed);
  elements.challengeFallback.hidden = true;
  try {
    if (typeof navigator.share === 'function') {
      elements.bootStatus.textContent = 'Share sheet opened. Nothing is sent until you choose a destination.';
      try {
        await navigator.share({ title: 'One Bug, Please', text });
        elements.bootStatus.textContent = 'Share sheet closed.';
        return;
      } catch (error) {
        if (error?.name === 'AbortError') {
          elements.bootStatus.textContent = 'Share cancelled.';
          return;
        }
      }
    }
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    elements.bootStatus.textContent = 'Challenge copied.';
  } catch {
    elements.challengeFallback.hidden = false;
    elements.challengeUrl.value = url;
    elements.challengeUrl.focus();
    elements.challengeUrl.select();
    elements.bootStatus.textContent = 'Copy the selected challenge URL.';
  }
}

function playNewTicket() {
  const url = new URL(window.location.href);
  url.searchParams.delete('seed');
  url.searchParams.delete('boot');
  url.hash = '';
  window.location.assign(url);
}

function bindControls() {
  elements.start.addEventListener('click', () => transition(startGame, 'start'));
  elements.approve.addEventListener('click', () => transition(approve, 'approve'));
  elements.reject.addEventListener('click', () => transition(reject, 'reject'));
  elements.next.addEventListener('click', () => transition(nextProposal, 'next'));
  elements.ship.addEventListener('click', () => transition(ship, 'ship'));
  elements.sound.addEventListener('click', () => setSound(!soundEnabled));
  elements.shortcuts.addEventListener('click', () => setShortcuts(!shortcutsEnabled));
  elements.share.addEventListener('click', () => { void shareChallenge(); });
  elements.resultShare.addEventListener('click', () => { void shareChallenge(); });
  elements.newTicket.addEventListener('click', playNewTicket);

  window.addEventListener('keydown', (event) => {
    if (!shortcutsEnabled || event.altKey || event.ctrlKey || event.metaKey || isInteractiveTarget(event.target)) return;
    switch (event.key) {
      case 'a':
      case 'A':
        if (state.phase !== 'deciding') return;
        elements.approve.click();
        break;
      case 'r':
      case 'R':
        if (state.phase !== 'deciding') return;
        elements.reject.click();
        break;
      case 'Enter':
        if (state.phase !== 'revealed') return;
        elements.next.click();
        break;
      case 's':
      case 'S':
        if (!canShip(state)) return;
        elements.ship.click();
        break;
      default:
        return;
    }
    event.preventDefault();
  });
}

function boot() {
  const seed = resolveSeed();
  state = createGame(seed);
  if (!state) throw new Error('Seed did not create a game');

  const motion = motionPreference();
  reducedMotion = Boolean(motion.matches);
  if (typeof motion.addEventListener === 'function') {
    motion.addEventListener('change', (event) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        machineRequest += 1;
        pendingMachineStage = null;
        window.clearTimeout(machineTimer);
        hidePreviousMachine();
        renderMachine();
      }
    });
  }

  for (const image of [elements.machinePrevious, elements.machineCurrent]) {
    image.addEventListener('error', () => { image.hidden = true; });
    if (image.complete && image.naturalWidth === 0) image.hidden = true;
  }

  bindControls();
  setShortcuts(true);
  render();
  elements.share.disabled = false;
  elements.shortcuts.disabled = false;
  elements.bootStatus.textContent = 'Repair bench ready.';
}

let gameBooted = false;
try {
  elements = collectElements();
  if (!BOOT_ID) throw new Error('Missing boot id');
  if (installBootGuard()) {
    boot();
    gameBooted = true;
  }
} catch {
  const status = elements?.bootStatus ?? document.getElementById('boot-status');
  if (status) status.textContent = 'The game could not start. Refresh this page to try again.';
}

if (gameBooted) initializeAudio();
