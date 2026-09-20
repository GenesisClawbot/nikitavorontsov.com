import {
  RISK_TERMS,
  canCopyDraft,
  findFlaggedClaims,
  quoteSupportsClaim,
} from './core.mjs?v=receipts-bot-20260825-01';

const BOOT_ID = document.documentElement.dataset.build;
const BOOT_STORAGE_KEY = 'receipts-bot-boot-id';

function hardReload(nextBootId) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('boot') === nextBootId) return;
  url.searchParams.set('boot', nextBootId);
  window.location.replace(url);
}

try {
  const latestBootId = window.localStorage.getItem(BOOT_STORAGE_KEY);
  if (latestBootId && latestBootId > BOOT_ID) {
    hardReload(latestBootId);
  } else if (!latestBootId || BOOT_ID > latestBootId) {
    window.localStorage.setItem(BOOT_STORAGE_KEY, BOOT_ID);
  }
} catch {
  // A blocked local store does not block the proof desk.
}

window.addEventListener('storage', (event) => {
  if (event.key === BOOT_STORAGE_KEY && event.newValue > BOOT_ID) {
    hardReload(event.newValue);
  }
});

const loadedUrl = new URL(window.location.href);
if (loadedUrl.searchParams.get('boot') === BOOT_ID) {
  loadedUrl.searchParams.delete('boot');
  window.history.replaceState(null, '', loadedUrl);
}

const draft = document.querySelector('#draft');
const source = document.querySelector('#source');
const checkButton = document.querySelector('#check-button');
const exampleButton = document.querySelector('#example-button');
const status = document.querySelector('#status');
const proof = document.querySelector('#proof');
const proofHeading = document.querySelector('#proof-heading');
const claimList = document.querySelector('#claim-list');
const gateStatus = document.querySelector('#gate-status');
const copyButton = document.querySelector('#copy-button');
const riskTerms = document.querySelector('#risk-terms');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const evidenceByClaim = new Map();
let currentClaims = [];

for (const label of RISK_TERMS) {
  const item = document.createElement('li');
  item.textContent = label;
  riskTerms.append(item);
}

function evidenceRecord() {
  return Object.fromEntries(evidenceByClaim);
}

function updateClaimStatus(claim, quoteInput, claimStatus, claimSlip) {
  const supported = quoteSupportsClaim(quoteInput.value, source.value, claim);
  claimSlip.dataset.state = supported ? 'matched' : 'open';
  claimStatus.textContent = supported
    ? 'Excerpt matches the supplied source and watched terms.'
    : 'Paste at least 12 exact characters from the source above that include every watched term.';
}

function updateGate() {
  const canCopy = canCopyDraft({
    draft: draft.value,
    source: source.value,
    evidence: evidenceRecord(),
  });
  copyButton.disabled = !canCopy;

  if (!currentClaims.length) {
    gateStatus.textContent = 'No watched terms found. That is not a truth verdict. Review the draft before you copy.';
    return;
  }

  const matched = currentClaims.filter((claim) => (
    quoteSupportsClaim(evidenceByClaim.get(claim.id), source.value, claim)
  )).length;
  gateStatus.textContent = canCopy
    ? `All ${matched} flagged sentences have matching source excerpts. Copy is unlocked.`
    : `${matched} of ${currentClaims.length} flagged sentences have matching source excerpts.`;
}

function makeClaimSlip(claim, index) {
  const claimSlip = document.createElement('article');
  claimSlip.className = 'claim-slip';

  const margin = document.createElement('p');
  margin.className = 'margin-note';
  margin.textContent = `Flag ${String(index + 1).padStart(2, '0')}`;

  const claimText = document.createElement('blockquote');
  claimText.className = 'claim-text';
  claimText.textContent = claim.text;

  const terms = document.createElement('div');
  terms.className = 'term-marks';
  terms.setAttribute('aria-label', 'Watched terms found');
  for (const label of claim.terms) {
    const term = document.createElement('span');
    term.textContent = label;
    terms.append(term);
  }

  const quoteId = `quote-${claim.id}`;
  const quoteLabel = document.createElement('label');
  quoteLabel.htmlFor = quoteId;
  quoteLabel.textContent = 'Paste a matching source excerpt';

  const quoteInput = document.createElement('textarea');
  quoteInput.id = quoteId;
  quoteInput.className = 'quote-input';
  quoteInput.rows = 3;
  quoteInput.value = evidenceByClaim.get(claim.id) ?? '';
  quoteInput.setAttribute('spellcheck', 'false');

  const claimStatus = document.createElement('p');
  claimStatus.className = 'claim-status';

  quoteInput.addEventListener('input', () => {
    evidenceByClaim.set(claim.id, quoteInput.value);
    updateClaimStatus(claim, quoteInput, claimStatus, claimSlip);
    updateGate();
  });

  claimSlip.append(margin, claimText, terms, quoteLabel, quoteInput, claimStatus);
  updateClaimStatus(claim, quoteInput, claimStatus, claimSlip);
  return claimSlip;
}

function renderProof() {
  currentClaims = findFlaggedClaims(draft.value);
  claimList.replaceChildren();

  if (!currentClaims.length) {
    const clearNote = document.createElement('p');
    clearNote.className = 'clear-note';
    clearNote.textContent = 'The tripwire found no watched terms. Read the draft anyway. Bots have a large vocabulary.';
    claimList.append(clearNote);
  } else {
    currentClaims.forEach((claim, index) => {
      claimList.append(makeClaimSlip(claim, index));
    });
  }

  updateGate();
}

function refreshProof() {
  status.textContent = '';
  if (proof.hidden) return;
  renderProof();
}

draft.addEventListener('input', refreshProof);
source.addEventListener('input', refreshProof);

checkButton.addEventListener('click', () => {
  if (!draft.value.trim()) {
    status.textContent = 'Paste the announcement draft first.';
    draft.focus();
    return;
  }

  proof.hidden = false;
  renderProof();
  status.textContent = `${currentClaims.length} flagged sentence${currentClaims.length === 1 ? '' : 's'} sent to the proof desk.`;
  proofHeading.focus();
  proof.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
});

exampleButton.addEventListener('click', () => {
  draft.value = [
    'Moonbox release bot says version two is here.',
    'The worker now runs in a secure sandbox.',
    'Every key is encrypted end-to-end.',
    'The moon icon is slightly rounder.',
  ].join(' ');
  source.value = [
    'Moonbox 2.0 release notes.',
    'The changelog says the worker now runs in a sandbox.',
    'The moon icon is now rounder.',
  ].join(' ');
  evidenceByClaim.clear();
  checkButton.click();
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    status.textContent = 'Current draft copied.';
  } catch {
    status.textContent = 'Copy failed. Select the draft and copy it manually.';
    draft.focus();
    draft.select();
  }
});

checkButton.disabled = false;
exampleButton.disabled = false;
status.textContent = '';
