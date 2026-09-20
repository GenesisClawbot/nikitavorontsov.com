export const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SEED_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

export function normalizeSeed(raw) {
  const normalized = String(raw ?? '').toUpperCase().replaceAll('-', '');
  return SEED_PATTERN.test(normalized) ? normalized : null;
}

export function formatSeed(seed) {
  return `${seed.slice(0, 4)}-${seed.slice(4)}`;
}

export function createRandomSeed(fill) {
  const bytes = new Uint8Array(8);
  fill(bytes);
  return [...bytes].map((value) => SEED_ALPHABET[value % 32]).join('');
}

export function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function chooseSlot([start, end], random) {
  return start + Math.floor(random() * (end - start + 1));
}

export const TICKETS = [
  {
    id: 'dropdown-clips',
    title: 'Profile dropdown clips behind the settings panel',
    brief: 'At 768 pixels wide, the profile menu opens under the settings panel edge.',
    checks: [
      { id: 'reproduce', label: 'Reproduce at 768 px' },
      { id: 'repair', label: 'Correct the stacking boundary' },
      { id: 'regression', label: 'Add the focused regression' },
    ],
    proposals: [
      { id: 'dropdown-reproduce', title: 'Pin down the failing width', pitch: 'Add a focused browser case that opens the menu beside the settings panel at 768 pixels.', files: ['tests/profile-menu.spec.mjs'], lines: 24, contextCost: 9, kind: 'necessary', checkId: 'reproduce', scopeWeight: 0, reveal: 'The overlap only appears at the tablet boundary. This proves the failure without widening the job.' },
      { id: 'dropdown-boundary', title: 'Move the menu above its local panel', pitch: 'Adjust the profile shell stacking context and keep the menu inside its current overlay boundary.', files: ['ui/profile/profile-shell.css', 'ui/profile/profile-menu.mjs'], lines: 18, contextCost: 12, kind: 'necessary', checkId: 'repair', scopeWeight: 0, reveal: 'The menu needed one local stacking correction. The rest of the overlay system can stay put.' },
      { id: 'dropdown-regression', title: 'Lock the overlap case', pitch: 'Assert that the open menu stays above the settings panel at the failing width and with keyboard focus.', files: ['tests/profile-menu.spec.mjs', 'tests/helpers/focus-menu.mjs'], lines: 31, contextCost: 10, kind: 'necessary', checkId: 'regression', scopeWeight: 0, reveal: 'This protects the exact width and focus path that failed.' },
      { id: 'dropdown-portal', title: 'Move every floating surface into a portal', pitch: 'Create one document-level host for menus, tooltips, dialogs, and future floating controls.', files: ['ui/overlay/portal-host.mjs', 'ui/overlay/portal.css', 'ui/profile/profile-menu.mjs', 'ui/tooltips/tooltip.mjs', 'ui/dialogs/dialog.mjs', 'app-shell.mjs'], lines: 186, contextCost: 25, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'A portal platform replaces several working boundaries to solve one local overlap.' },
      { id: 'dropdown-spring', title: 'Give the menu a spring entrance', pitch: 'Add a shared motion helper and tune overshoot for pointer and keyboard opening.', files: ['ui/motion/spring.mjs', 'ui/profile/profile-menu.mjs', 'ui/profile/profile-shell.css'], lines: 76, contextCost: 13, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'The menu did not fail because it lacked an entrance animation.' },
      { id: 'dropdown-z-index-registry', title: 'Create a global layer registry', pitch: 'Replace local layer values with named tokens for navigation, menus, panels, dialogs, and notices.', files: ['styles/layers.css', 'ui/profile/profile-shell.css', 'ui/settings/settings-panel.css', 'ui/dialogs/dialog.css'], lines: 104, contextCost: 18, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'A global registry expands the blast radius beyond the two elements in conflict.' },
      { id: 'dropdown-settings-redesign', title: 'Recompose the settings panel', pitch: 'Turn the panel into a resizable rail so floating controls have more room at tablet widths.', files: ['ui/settings/settings-panel.mjs', 'ui/settings/settings-panel.css', 'ui/settings/settings-layout.mjs', 'tests/settings-panel.spec.mjs', 'styles/breakpoints.css'], lines: 152, contextCost: 22, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'The settings panel does not need a new layout to stop covering the menu.' },
      { id: 'dropdown-component-migration', title: 'Adopt the new popover primitive', pitch: 'Replace the profile menu with the experimental popover component and migrate its consumers.', files: ['ui/popover/popover.mjs', 'ui/popover/popover.css', 'ui/profile/profile-menu.mjs', 'ui/navigation/account-menu.mjs', 'ui/projects/project-menu.mjs', 'tests/popover.spec.mjs', 'tests/profile-menu.spec.mjs', 'app-shell.mjs'], lines: 318, contextCost: 29, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'The experimental primitive turns one clipping fix into a component migration.' },
      { id: 'dropdown-screenshot-matrix', title: 'Capture every menu at six widths', pitch: 'Add a visual matrix for profile, account, project, and help menus across desktop and mobile.', files: ['tests/visual/menu-matrix.spec.mjs', 'tests/visual/fixtures/menus.mjs', 'tests/visual/config.mjs'], lines: 92, contextCost: 15, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'A broad screenshot matrix is useful work, but it is not the focused regression this ticket asks for.' },
      { id: 'dropdown-profile-store', title: 'Normalize profile menu state', pitch: 'Move open state, focus state, and selected account into a shared profile store.', files: ['state/profile-store.mjs', 'ui/profile/profile-menu.mjs', 'ui/profile/profile-button.mjs', 'ui/navigation/account-switcher.mjs', 'tests/profile-store.test.mjs'], lines: 144, contextCost: 20, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'The clipping is visual. Replacing local state does not correct the stacking boundary.' },
    ],
  },
  {
    id: 'save-stays-disabled',
    title: 'Save button stays disabled after an edit',
    brief: 'Changing a project title marks the form visually, but Save remains disabled.',
    checks: [
      { id: 'reproduce', label: 'Reproduce the dirty transition' },
      { id: 'repair', label: 'Repair the state check' },
      { id: 'regression', label: 'Add the transition regression' },
    ],
    proposals: [
      { id: 'save-reproduce', title: 'Trace one clean-to-dirty edit', pitch: 'Add a form-state case that changes the title once and observes the Save control.', files: ['tests/project-form-state.test.mjs'], lines: 22, contextCost: 8, kind: 'necessary', checkId: 'reproduce', scopeWeight: 0, reveal: 'The transition proves the form is dirty while the button still reads stale state.' },
      { id: 'save-selector', title: 'Read the current dirty flag', pitch: 'Replace the captured initial flag with the live form-state selector used by the Save control.', files: ['ui/projects/project-form.mjs', 'state/project-form-state.mjs'], lines: 17, contextCost: 11, kind: 'necessary', checkId: 'repair', scopeWeight: 0, reveal: 'The button subscribed to the initial value. Reading the live flag repairs the decision.' },
      { id: 'save-regression', title: 'Protect both directions', pitch: 'Assert that one edit enables Save and reverting that edit disables it again.', files: ['tests/project-form-state.test.mjs', 'tests/helpers/project-form.mjs'], lines: 36, contextCost: 12, kind: 'necessary', checkId: 'regression', scopeWeight: 0, reveal: 'The focused regression covers the broken transition and its inverse.' },
      { id: 'save-form-framework', title: 'Move every form to a form framework', pitch: 'Introduce a schema-driven form package and migrate project, profile, billing, and invite forms.', files: ['forms/schema-form.mjs', 'forms/schema-field.mjs', 'ui/projects/project-form.mjs', 'ui/profile/profile-form.mjs', 'ui/billing/billing-form.mjs', 'ui/invites/invite-form.mjs', 'tests/schema-form.test.mjs'], lines: 342, contextCost: 30, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'A form framework replaces working forms to repair one stale subscription.' },
      { id: 'save-autosave', title: 'Add background autosave', pitch: 'Debounce edits, persist drafts, surface sync state, and keep the button as a manual fallback.', files: ['state/autosave.mjs', 'api/project-drafts.mjs', 'ui/projects/project-form.mjs', 'ui/projects/save-state.mjs', 'tests/autosave.test.mjs', 'server/project-drafts.mjs'], lines: 226, contextCost: 26, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'Autosave adds a second persistence path instead of fixing the disabled first one.' },
      { id: 'save-undo-history', title: 'Keep a local edit history', pitch: 'Store field snapshots so the project form can offer undo and redo before saving.', files: ['state/edit-history.mjs', 'ui/projects/project-form.mjs', 'ui/projects/history-controls.mjs', 'tests/edit-history.test.mjs'], lines: 128, contextCost: 18, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'Undo history does not make the existing Save control observe current state.' },
      { id: 'save-button-animation', title: 'Animate the Save state change', pitch: 'Add a short color and label transition when Save becomes available.', files: ['ui/projects/save-button.css', 'ui/projects/project-form.mjs'], lines: 29, contextCost: 6, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'A cheap animation still leaves the stale state check untouched.' },
      { id: 'save-state-machine', title: 'Model the form as a state machine', pitch: 'Replace boolean form flags with explicit pristine, dirty, saving, saved, and failed states.', files: ['state/project-form-machine.mjs', 'ui/projects/project-form.mjs', 'ui/projects/save-state.mjs', 'tests/project-form-machine.test.mjs', 'tests/project-form-state.test.mjs'], lines: 176, contextCost: 22, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'A state machine can clarify future work, but the current bug is one stale selector.' },
      { id: 'save-shortcut', title: 'Add a keyboard save command', pitch: 'Bind Command-S and Control-S across project forms with a shared shortcut service.', files: ['ui/shortcuts/save-shortcut.mjs', 'ui/shortcuts/registry.mjs', 'ui/projects/project-form.mjs', 'tests/save-shortcut.test.mjs'], lines: 88, contextCost: 14, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'A shortcut would call the same disabled action. It does not repair the dirty transition.' },
      { id: 'save-draft-indicator', title: 'Add a draft status rail', pitch: 'Show field-level dirty marks, last saved time, and a pending-change count beside the form.', files: ['ui/projects/draft-status.mjs', 'ui/projects/draft-status.css', 'ui/projects/project-form.mjs', 'state/project-form-state.mjs'], lines: 116, contextCost: 17, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'More state display does not make the Save control consume the state it already has.' },
    ],
  },
  {
    id: 'mobile-image-jumps',
    title: 'Mobile image jumps after it loads',
    brief: 'A project card moves down when its preview image finishes loading on a narrow screen.',
    checks: [
      { id: 'reproduce', label: 'Reproduce at a narrow viewport' },
      { id: 'repair', label: 'Reserve the image geometry' },
      { id: 'regression', label: 'Add the layout regression' },
    ],
    proposals: [
      { id: 'image-reproduce', title: 'Measure the narrow loading shift', pitch: 'Delay the preview response in a 390-pixel browser case and record the card position before and after load.', files: ['tests/project-card-layout.spec.mjs'], lines: 28, contextCost: 9, kind: 'necessary', checkId: 'reproduce', scopeWeight: 0, reveal: 'The delayed response isolates the jump at the narrow layout without changing production behavior.' },
      { id: 'image-geometry', title: 'Reserve the preview box', pitch: 'Give the project preview its authored aspect ratio before the image bytes arrive.', files: ['ui/projects/project-card.css', 'ui/projects/project-card.mjs'], lines: 15, contextCost: 13, kind: 'necessary', checkId: 'repair', scopeWeight: 0, reveal: 'The card needed stable geometry before load. The image pipeline can remain unchanged.' },
      { id: 'image-regression', title: 'Lock the card position', pitch: 'Assert that the card footer keeps the same vertical position across the delayed image load.', files: ['tests/project-card-layout.spec.mjs', 'tests/helpers/delayed-image.mjs'], lines: 34, contextCost: 11, kind: 'necessary', checkId: 'regression', scopeWeight: 0, reveal: 'The focused check protects the visible shift that prompted the ticket.' },
      { id: 'image-cdn', title: 'Build an image transformation service', pitch: 'Add signed resize URLs, format negotiation, edge caching, and project-level image presets.', files: ['server/image-transform.mjs', 'server/image-signing.mjs', 'api/image-presets.mjs', 'ui/projects/project-card.mjs', 'config/cdn.mjs', 'tests/image-transform.test.mjs'], lines: 284, contextCost: 28, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'Image delivery can improve, but it is not required to reserve one known box.' },
      { id: 'image-blurhash', title: 'Generate blur placeholders', pitch: 'Store a compact placeholder for each preview and crossfade it into the loaded image.', files: ['media/blur-placeholder.mjs', 'jobs/preview-metadata.mjs', 'ui/projects/project-card.mjs', 'ui/projects/project-card.css', 'tests/blur-placeholder.test.mjs'], lines: 164, contextCost: 21, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'A placeholder may look pleasant, but stable geometry alone fixes the jump.' },
      { id: 'image-carousel', title: 'Turn previews into a carousel', pitch: 'Let each project card display several images with swipe, arrow, and dot controls.', files: ['ui/projects/preview-carousel.mjs', 'ui/projects/preview-carousel.css', 'ui/projects/project-card.mjs', 'tests/preview-carousel.spec.mjs', 'state/project-previews.mjs'], lines: 208, contextCost: 24, kind: 'scope', checkId: null, scopeWeight: 3, reveal: 'A carousel multiplies loading states when the ticket asks for one stable preview.' },
      { id: 'image-fade', title: 'Fade the preview into place', pitch: 'Add opacity and scale easing after image decode so loading feels softer.', files: ['ui/projects/project-card.css', 'ui/projects/project-card.mjs'], lines: 32, contextCost: 6, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'Motion can disguise the jump. It does not reserve the missing space.' },
      { id: 'image-skeleton', title: 'Add a card skeleton system', pitch: 'Create shared skeleton shapes for project cards, lists, profile rows, and settings panels.', files: ['ui/skeleton/skeleton.mjs', 'ui/skeleton/skeleton.css', 'ui/projects/project-card.mjs', 'ui/projects/project-list.mjs', 'ui/profile/profile-row.mjs', 'ui/settings/settings-panel.mjs'], lines: 192, contextCost: 20, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'A site-wide skeleton system is larger than the one geometry rule the preview lacks.' },
      { id: 'image-observer', title: 'Replace image loading with one observer', pitch: 'Create a shared intersection observer for every deferred image in the application.', files: ['media/lazy-image.mjs', 'media/image-observer.mjs', 'ui/projects/project-card.mjs', 'ui/profile/avatar.mjs', 'ui/gallery/gallery-image.mjs', 'tests/lazy-image.test.mjs'], lines: 148, contextCost: 19, kind: 'scope', checkId: null, scopeWeight: 2, reveal: 'Changing when images load does not guarantee that their layout space exists first.' },
      { id: 'image-performance-panel', title: 'Add image timing diagnostics', pitch: 'Record decode, transfer, cache, and layout timing in a developer-only project panel.', files: ['dev/image-timing.mjs', 'dev/performance-panel.mjs', 'ui/projects/project-card.mjs', 'styles/dev-panel.css'], lines: 96, contextCost: 14, kind: 'scope', checkId: null, scopeWeight: 1, reveal: 'The delayed test already proves the failure. A diagnostics panel does not repair it.' },
    ],
  },
];

export function buildChallenge(rawSeed) {
  const seed = normalizeSeed(rawSeed);
  if (!seed) return null;

  const random = mulberry32(hashSeed(seed));
  const ticket = TICKETS[Math.floor(random() * TICKETS.length)];
  const necessary = shuffle(ticket.proposals.filter(({ kind }) => kind === 'necessary'), random);
  const scope = shuffle(ticket.proposals.filter(({ kind }) => kind === 'scope'), random);
  const slots = [
    chooseSlot([0, 1], random),
    chooseSlot([2, 4], random),
    chooseSlot([5, 7], random),
  ];
  const deck = Array(10);
  slots.forEach((slot, index) => {
    deck[slot] = necessary[index];
  });
  let scopeIndex = 0;
  for (let index = 0; index < deck.length; index += 1) {
    if (!deck[index]) deck[index] = scope[scopeIndex++];
  }
  return { seed, ticket, deck };
}

export function createGame(rawSeed) {
  const challenge = buildChallenge(rawSeed);
  if (!challenge) return null;
  return {
    ...challenge,
    phase: 'briefing',
    turn: 1,
    context: 100,
    checks: [],
    touchedFiles: [],
    changedLines: 0,
    scopeWeight: 0,
    acceptedScopeCount: 0,
    decisions: [],
    lastReveal: null,
    endReason: null,
  };
}

export function startGame(state) {
  if (!state || state.phase !== 'briefing') return state;
  return { ...state, phase: 'deciding' };
}

function currentProposal(state) {
  return state.deck[state.turn - 1];
}

function revealFor(proposal, action) {
  const missedCheck = action === 'reject' && proposal.kind === 'necessary';
  return {
    proposalId: proposal.id,
    action,
    verdict: proposal.kind === 'necessary' ? 'NEEDED' : 'SCOPE CREEP',
    text: missedCheck ? `${proposal.reveal} This run cannot ship now.` : proposal.reveal,
  };
}

function finishIfEmpty(state) {
  if (state.context > 0) return state;
  return { ...state, context: 0, phase: 'result', endReason: 'meltdown' };
}

export function approve(state) {
  if (!state || state.phase !== 'deciding') return state;
  const proposal = currentProposal(state);
  if (!proposal || state.decisions.some(({ proposalId }) => proposalId === proposal.id)) return state;
  const checks = proposal.checkId && !state.checks.includes(proposal.checkId)
    ? [...state.checks, proposal.checkId]
    : state.checks;
  const touchedFiles = [...new Set([...state.touchedFiles, ...proposal.files])];
  return finishIfEmpty({
    ...state,
    phase: 'revealed',
    context: Math.max(0, state.context - proposal.contextCost),
    checks,
    touchedFiles,
    changedLines: state.changedLines + proposal.lines,
    scopeWeight: state.scopeWeight + (proposal.kind === 'scope' ? proposal.scopeWeight : 0),
    acceptedScopeCount: state.acceptedScopeCount + (proposal.kind === 'scope' ? 1 : 0),
    decisions: [...state.decisions, { proposalId: proposal.id, action: 'approve' }],
    lastReveal: revealFor(proposal, 'approve'),
  });
}

export function reject(state) {
  if (!state || state.phase !== 'deciding') return state;
  const proposal = currentProposal(state);
  if (!proposal || state.decisions.some(({ proposalId }) => proposalId === proposal.id)) return state;
  return finishIfEmpty({
    ...state,
    phase: 'revealed',
    context: Math.max(0, state.context - 2),
    decisions: [...state.decisions, { proposalId: proposal.id, action: 'reject' }],
    lastReveal: revealFor(proposal, 'reject'),
  });
}

export function nextProposal(state) {
  if (!state || state.phase !== 'revealed') return state;
  if (state.turn >= state.deck.length) {
    return {
      ...state,
      phase: 'result',
      endReason: state.checks.length === 3 ? 'review-loop' : 'unfixed',
    };
  }
  return { ...state, phase: 'deciding', turn: state.turn + 1, lastReveal: null };
}

export function canShip(state) {
  return Boolean(
    state
    && state.context > 0
    && state.checks.length === 3
    && (state.phase === 'deciding' || state.phase === 'revealed'),
  );
}

export function ship(state) {
  if (!canShip(state)) return state;
  return { ...state, phase: 'result', endReason: 'shipped' };
}

export function machineStage(scopeWeight) {
  if (scopeWeight >= 6) return 3;
  if (scopeWeight >= 3) return 2;
  if (scopeWeight >= 1) return 1;
  return 0;
}

export function outcomeTitle(state) {
  if (state.endReason === 'meltdown') return 'CONTEXT MELTDOWN';
  if (state.endReason === 'unfixed') return 'BUG STILL PRESENT';
  if (state.endReason === 'review-loop') return 'REVIEW LOOP';
  if (
    state.endReason === 'shipped'
    && state.acceptedScopeCount === 0
    && state.scopeWeight === 0
    && state.context >= 55
  ) {
    return 'SURGICAL PATCH';
  }
  if (state.endReason === 'shipped' && state.scopeWeight >= 3) {
    return 'REACTOR-ASSISTED FIX';
  }
  return 'PATCH LANDED';
}

export function challengeUrl(baseUrl, seed) {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', formatSeed(seed));
  return url.href;
}

export function shareText(state, baseUrl) {
  const url = challengeUrl(baseUrl, state.seed);
  if (state.phase !== 'result') {
    return `One Bug, Please: ${state.ticket.title}.\nBeat my run. Same bug. Same agent. Your move: ${url}`;
  }
  return [
    `One Bug, Please: ${outcomeTitle(state)}.`,
    `${state.touchedFiles.length} files. ${state.changedLines} lines. ${state.context} context left.`,
    `Same bug. Same agent. Your move: ${url}`,
  ].join('\n');
}
