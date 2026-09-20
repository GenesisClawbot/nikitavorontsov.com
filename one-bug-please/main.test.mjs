import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChallenge } from './game.mjs';

const elementIds = [
  'game-shell', 'boot-status', 'ticket-title', 'ticket-brief', 'seed', 'turn',
  'context', 'context-fuse', 'checks', 'files', 'lines', 'machine-frame',
  'machine-previous', 'machine-current', 'machine-stage', 'proposal',
  'proposal-number', 'proposal-heading', 'proposal-pitch', 'proposal-paths',
  'proposal-lines', 'proposal-cost', 'approve', 'reject', 'reveal',
  'reveal-verdict', 'reveal-heading', 'reveal-copy', 'next', 'start', 'ship',
  'ship-condition', 'share', 'sound', 'shortcuts', 'result', 'result-heading',
  'result-ticket', 'result-seed', 'result-files', 'result-lines', 'result-context',
  'result-scope', 'result-stage', 'result-share', 'new-ticket', 'challenge-fallback',
  'challenge-url', 'live-region',
];

const buttonIds = new Set([
  'approve', 'reject', 'next', 'start', 'ship', 'share', 'sound', 'shortcuts', 'result-share', 'new-ticket',
]);
const imageIds = new Set(['machine-previous', 'machine-current']);
let importNumber = 0;

class FakeElement {
  constructor(tagName = 'div', document = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.parentElement = null;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.isContentEditable = false;
    this.textContent = '';
    this.complete = false;
    this.naturalWidth = 1;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = {
      toggle: (name, force) => {
        if (!this.classes) this.classes = new Set();
        if (force) this.classes.add(name);
        else this.classes.delete(name);
      },
    };
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  click() {
    if (!this.disabled) this.dispatch('click', { target: this });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  select() {
    this.selectionStart = 0;
    this.selectionEnd = this.value?.length ?? 0;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...children) {
    for (const child of children) {
      if (child instanceof FakeElement) child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  matches(selectors) {
    return selectors.split(',').some((part) => {
      const selector = part.trim();
      if (selector === '[contenteditable="true"]') return this.isContentEditable;
      const match = selector.match(/^([a-z]+)(?:\[href\])?$/i);
      if (!match || this.tagName !== match[1].toUpperCase()) return false;
      return !selector.endsWith('[href]') || this.attributes.has('href');
    });
  }

  closest(selectors) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selectors)) return node;
    }
    return null;
  }
}

function installHarness({
  reducedMotion = true,
  locationHref = 'http://127.0.0.1:4173/one-bug-please/?seed=2345-6789',
  storedBootId = null,
  navigatorValue = {},
} = {}) {
  const prior = new Map();
  const install = (name, value) => {
    prior.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };

  const document = {
    activeElement: null,
    elements: new Map(),
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    getElementById(id) {
      return this.elements.get(id) ?? null;
    },
  };
  document.documentElement = new FakeElement('html', document);
  document.documentElement.dataset.bootId = 'one-bug-please-20260828-01';

  const elements = {};
  for (const id of elementIds) {
    const tagName = buttonIds.has(id) ? 'button'
      : imageIds.has(id) ? 'img'
        : id === 'challenge-url' ? 'input' : 'div';
    const element = new FakeElement(tagName, document);
    document.elements.set(id, element);
    elements[id] = element;
  }
  elements['machine-current'].setAttribute('src', './assets/machine-stage-0.webp');
  elements['machine-current'].complete = true;
  elements['machine-current'].naturalWidth = 1200;
  elements['machine-previous'].hidden = true;
  for (const id of buttonIds) elements[id].disabled = true;

  const windowListeners = new Map();
  const timers = new Map();
  const replacementNavigations = [];
  let motionListener;
  let nextTimer = 1;
  const location = {
    href: locationHref,
    replace(value) {
      replacementNavigations.push(String(value));
      this.href = String(value);
    },
    assign(value) { this.href = String(value); },
  };
  const window = {
    location,
    history: {
      replaceState(_state, _unused, value) { location.href = String(value); },
    },
    localStorage: {
      values: new Map(),
      getItem(key) { return this.values.get(key) ?? null; },
      setItem(key, value) { this.values.set(key, String(value)); },
    },
    crypto: {
      getRandomValues(bytes) { return bytes.fill(7); },
    },
    matchMedia() {
      return {
        matches: reducedMotion,
        addEventListener(type, listener) {
          if (type === 'change') motionListener = listener;
        },
      };
    },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    setTimeout(callback, delay) {
      const id = nextTimer;
      nextTimer += 1;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  if (storedBootId !== null) {
    window.localStorage.values.set('one-bug-please-boot-id', String(storedBootId));
  }

  const audios = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.playing = false;
      this.pauseCalls = 0;
      this.listeners = new Map();
      audios.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    play() {
      this.playing = true;
      return Promise.resolve();
    }

    pause() {
      this.playing = false;
      this.pauseCalls += 1;
    }
  }

  const pendingImages = [];
  class FakeImage {
    constructor() {
      this.listeners = new Map();
      pendingImages.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    set src(value) {
      this._src = value;
    }

    get src() {
      return this._src;
    }

    dispatch(type) {
      this.listeners.get(type)?.();
    }
  }

  install('HTMLElement', FakeElement);
  install('document', document);
  install('window', window);
  install('navigator', navigatorValue);
  install('Audio', FakeAudio);
  install('Image', FakeImage);

  return {
    elements,
    audios,
    pendingImages,
    replacementNavigations,
    async boot() {
      importNumber += 1;
      await import(`./main.mjs?test=${importNumber}`);
      assert.equal(elements['boot-status'].textContent, 'Repair bench ready.');
    },
    key(key, options = {}) {
      let prevented = false;
      const event = {
        key,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target: elements['game-shell'],
        preventDefault() { prevented = true; },
        ...options,
      };
      for (const listener of windowListeners.get('keydown') ?? []) listener(event);
      return { prevented };
    },
    runTimers(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay !== delay) continue;
        timers.delete(id);
        timer.callback();
      }
    },
    setReducedMotion(matches) {
      motionListener?.({ matches });
    },
    restore() {
      for (const [name, descriptor] of prior) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

async function withHarness(options, callback) {
  const harness = installHarness(options);
  try {
    await harness.boot();
    await callback(harness);
  } finally {
    harness.restore();
  }
}

test('stale HTML boots when the newer boot query is already present', async () => {
  const newerBootId = 'one-bug-please-20260828-02';
  await withHarness({
    locationHref: `http://127.0.0.1:4173/one-bug-please/?seed=2345-6789&boot=${newerBootId}`,
    storedBootId: newerBootId,
  }, async ({ elements, replacementNavigations }) => {
    assert.deepEqual(replacementNavigations, []);
    assert.equal(elements['boot-status'].textContent, 'Repair bench ready.');
    assert.equal(elements.start.disabled, false);
  });
});

test('briefing ship status reports the remaining acceptance checks', async () => {
  await withHarness({}, async ({ elements }) => {
    assert.equal(elements['ship-condition'].textContent, 'Finish 3 acceptance checks to ship.');
  });
});

test('ship-ready status uses the required lever instruction', async () => {
  const challenge = buildChallenge('23456789');
  const necessaryTitles = new Set(
    challenge.deck.filter(({ kind }) => kind === 'necessary').map(({ title }) => title),
  );

  await withHarness({}, async ({ elements }) => {
    elements.start.click();
    for (let steps = 0; steps < 20 && elements.ship.disabled; steps += 1) {
      if (elements['game-shell'].dataset.phase === 'deciding') {
        const control = necessaryTitles.has(elements['proposal-heading'].textContent)
          ? elements.approve
          : elements.reject;
        control.click();
      } else {
        elements.next.click();
      }
    }

    assert.equal(elements.ship.disabled, false);
    assert.equal(
      elements['ship-condition'].textContent,
      'Ready. Pull the lever before the agent keeps going.',
    );
  });
});

test('the shortcut control turns single-character shortcuts off for the session', async () => {
  await withHarness({}, async ({ elements, key }) => {
    elements.start.click();
    elements.shortcuts.click();

    assert.equal(elements.shortcuts.getAttribute('aria-pressed'), 'false');
    assert.equal(elements.shortcuts.textContent, 'Shortcuts off');
    const disabledEvent = key('r');
    assert.equal(elements['game-shell'].dataset.phase, 'deciding');
    assert.equal(elements.context.textContent, '100');
    assert.equal(disabledEvent.prevented, false);

    elements.shortcuts.click();
    const enabledEvent = key('r');
    assert.equal(elements['game-shell'].dataset.phase, 'revealed');
    assert.equal(elements.context.textContent, '98');
    assert.equal(enabledEvent.prevented, true);
  });
});

test('modified browser shortcuts never make game decisions', async () => {
  await withHarness({}, async ({ elements, key }) => {
    elements.start.click();
    const event = key('r', { ctrlKey: true });
    assert.equal(elements['game-shell'].dataset.phase, 'deciding');
    assert.equal(elements.context.textContent, '100');
    assert.equal(event.prevented, false);
  });
});

test('inactive shortcuts do not block browser behavior', async () => {
  await withHarness({}, async ({ elements, key }) => {
    const event = key('Enter');
    assert.equal(elements['game-shell'].dataset.phase, 'briefing');
    assert.equal(event.prevented, false);
  });
});

test('Enter on a link remains browser navigation', async () => {
  await withHarness({}, async ({ elements, key }) => {
    elements.start.click();
    key('r');
    const link = new FakeElement('a', elements['game-shell'].ownerDocument);
    link.setAttribute('href', '/ledger/');
    const event = key('Enter', { target: link });
    assert.equal(elements['game-shell'].dataset.phase, 'revealed');
    assert.equal(elements.turn.textContent, '1 / 10');
    assert.equal(event.prevented, false);
  });
});

test('a failed Web Share attempt falls back to the clipboard', async () => {
  const clipboardWrites = [];
  const navigatorValue = {
    share: async () => { throw new Error('Share unavailable'); },
    clipboard: {
      async writeText(value) { clipboardWrites.push(value); },
    },
  };

  await withHarness({ navigatorValue }, async ({ elements }) => {
    elements.share.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(clipboardWrites.length, 1);
    assert.equal(elements['challenge-fallback'].hidden, true);
    assert.equal(elements['boot-status'].textContent, 'Challenge copied.');
  });
});

test('machine keeps the current image until the next stage has loaded', async () => {
  await withHarness({ reducedMotion: false }, async ({ elements, pendingImages, runTimers }) => {
    elements.start.click();
    elements.approve.click();
    assert.equal(pendingImages.length, 1);
    assert.equal(elements['machine-current'].getAttribute('src'), './assets/machine-stage-0.webp');
    assert.equal(elements['machine-previous'].hidden, true);

    pendingImages[0].dispatch('load');
    assert.equal(elements['machine-current'].getAttribute('src'), './assets/machine-stage-1.webp');
    assert.equal(elements['machine-previous'].getAttribute('src'), './assets/machine-stage-0.webp');
    assert.equal(elements['machine-previous'].hidden, false);

    runTimers(450);
    assert.equal(elements['machine-previous'].hidden, true);
  });
});

test('a superseding preload clears the previous crossfade layer immediately', async () => {
  await withHarness({ reducedMotion: false }, async ({ elements, pendingImages }) => {
    elements.start.click();
    elements.approve.click();
    pendingImages[0].dispatch('load');
    assert.equal(elements['machine-previous'].hidden, false);

    elements.next.click();
    elements.approve.click();
    elements.next.click();
    elements.approve.click();

    assert.equal(pendingImages.length, 2);
    assert.equal(elements['machine-current'].getAttribute('src'), './assets/machine-stage-1.webp');
    assert.equal(elements['machine-previous'].hidden, true);
    assert.equal(elements['machine-previous'].getAttribute('src'), null);
  });
});

test('enabling reduced motion cancels a pending crossfade and shows the current stage', async () => {
  await withHarness({ reducedMotion: false }, async ({ elements, pendingImages, setReducedMotion }) => {
    elements.start.click();
    elements.approve.click();
    assert.equal(pendingImages.length, 1);

    setReducedMotion(true);
    assert.equal(elements['machine-current'].getAttribute('src'), './assets/machine-stage-1.webp');
    assert.equal(elements['machine-previous'].hidden, true);

    pendingImages[0].dispatch('load');
    assert.equal(elements['machine-frame'].dataset.swap, 'idle');
    assert.equal(elements['machine-previous'].hidden, true);
  });
});

test('failed replacement preload hides stale machine art', async () => {
  await withHarness({ reducedMotion: false }, async ({ elements, pendingImages }) => {
    elements.start.click();
    elements.approve.click();
    assert.equal(elements['machine-current'].getAttribute('src'), './assets/machine-stage-0.webp');

    pendingImages[0].dispatch('error');
    assert.equal(elements['machine-current'].hidden, true);
    assert.equal(elements['machine-previous'].hidden, true);
  });
});

test('direct result transitions announce the outcome', async () => {
  await withHarness({}, async ({ elements }) => {
    elements.start.click();
    for (let steps = 0; steps < 20 && elements['game-shell'].dataset.phase !== 'result'; steps += 1) {
      if (elements['game-shell'].dataset.phase === 'deciding') elements.approve.click();
      else elements.next.click();
    }
    assert.equal(elements['result-heading'].textContent, 'CONTEXT MELTDOWN');
    assert.match(elements['live-region'].textContent, /^CONTEXT MELTDOWN\./);
  });
});

test('turning sound off stops an active cue', async () => {
  await withHarness({}, async ({ elements, audios }) => {
    elements.start.click();
    elements.sound.click();
    elements.approve.click();
    assert.equal(audios[0].playing, true);

    elements.sound.click();
    assert.equal(elements.sound.getAttribute('aria-pressed'), 'false');
    assert.equal(audios[0].playing, false);
    assert.equal(audios[0].pauseCalls, 1);
  });
});

test('turning sound off does not turn an interrupted play into permanent failure', async () => {
  await withHarness({}, async ({ elements, audios }) => {
    let rejectPlay;
    audios[0].play = () => new Promise((_resolve, reject) => {
      rejectPlay = reject;
    });

    elements.start.click();
    elements.sound.click();
    elements.approve.click();
    elements.sound.click();

    const interrupted = new Error('play() interrupted by pause');
    interrupted.name = 'AbortError';
    rejectPlay(interrupted);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(elements.sound.disabled, false);
    assert.equal(elements['boot-status'].textContent, 'Repair bench ready.');
    elements.sound.click();
    assert.equal(elements.sound.getAttribute('aria-pressed'), 'true');
  });
});
