import { buildConversationMarkdown, formatReceipt, parseTranscript } from './core.mjs?v=one-small-fix-20260825-01';

const BOOT_ID = document.documentElement.dataset.build;
const BOOT_STORAGE_KEY = 'one-small-fix-boot-id';

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
  // A blocked local store does not block transcript parsing.
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

const transcriptInput = document.querySelector('#transcript');
const dropzone = document.querySelector('#dropzone');
const receipt = document.querySelector('#receipt');
const receiptHeading = document.querySelector('#receipt-heading');
const outputKind = document.querySelector('#output-kind');
const outputLabel = document.querySelector('#output-label');
const receiptText = document.querySelector('#receipt-text');
const scopeNote = document.querySelector('#scope-note');
const privacyCheck = document.querySelector('#privacy-check');
const privacyCheckText = document.querySelector('#privacy-check-text');
const copyButton = document.querySelector('#copy-button');
const saveButton = document.querySelector('#save-button');
const status = document.querySelector('#status');
const metricDuration = document.querySelector('#metric-duration');
const metricTools = document.querySelector('#metric-tools');
const metricWrites = document.querySelector('#metric-writes');
const metricTests = document.querySelector('#metric-tests');
const writeList = document.querySelector('#write-list');
const testList = document.querySelector('#test-list');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const outputSettings = {
  receipt: {
    heading: 'Scope receipt',
    label: 'Edit scope receipt before sharing',
    note: 'The request and final reply are 600-character excerpts. Home-folder names, email addresses, and common token shapes are masked. Direct write calls include Edit, Write, and NotebookEdit calls. Shell commands can change other files. Review everything yourself.',
    checked: 'I checked the scope receipt for private paths, secrets, names, and details I do not want to share.',
    filename: 'one-small-fix-scope-receipt.txt',
    type: 'text/plain;charset=utf-8',
  },
  conversation: {
    heading: 'Conversation lifeboat',
    label: 'Edit conversation lifeboat before sharing',
    note: 'This includes every visible human and assistant text turn found in the local transcript. Tool calls, tool results, and injected reminders are removed. Home-folder names, email addresses, and common token shapes are masked. Text absent from the transcript cannot be recovered. Review everything yourself.',
    checked: 'I checked the conversation lifeboat for private paths, secrets, names, and details I do not want to share.',
    filename: 'one-small-fix-conversation-lifeboat.md',
    type: 'text/markdown;charset=utf-8',
  },
};

let outputs = null;

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'Unknown';
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function fillList(list, values, emptyText) {
  list.replaceChildren();
  const entries = values.length ? values : [emptyText];
  for (const value of entries) {
    const item = document.createElement('li');
    item.textContent = value;
    if (!values.length) item.className = 'empty-row';
    list.append(item);
  }
}

function lockActions() {
  privacyCheck.checked = false;
  copyButton.disabled = true;
  saveButton.disabled = true;
}

function hideReceipt() {
  receipt.hidden = true;
  outputs = null;
  lockActions();
}

function renderOutput() {
  if (!outputs) return;
  const kind = outputKind.value;
  const settings = outputSettings[kind];
  receiptHeading.textContent = settings.heading;
  outputLabel.textContent = settings.label;
  scopeNote.textContent = settings.note;
  privacyCheckText.textContent = settings.checked;
  receiptText.value = outputs[kind];
  copyButton.textContent = `Copy checked ${kind === 'receipt' ? 'receipt' : 'lifeboat'}`;
  saveButton.textContent = `Save checked ${kind === 'receipt' ? '.txt' : '.md'}`;
  lockActions();
}

function showReceipt(summary, source) {
  metricDuration.textContent = formatDuration(summary.elapsedMs);
  metricTools.textContent = String(summary.toolCalls);
  metricWrites.textContent = String(summary.filesWritten.length);
  metricTests.textContent = String(summary.testCommands.length);
  fillList(writeList, summary.filesWritten, 'None observed through direct write calls.');
  fillList(testList, summary.testCommands, 'None observed.');
  outputs = {
    receipt: formatReceipt(summary),
    conversation: buildConversationMarkdown(source),
  };
  outputKind.value = 'receipt';
  renderOutput();
  receipt.hidden = false;
  receiptHeading.focus();
  receipt.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

async function readTranscript(file) {
  if (!file) return;
  status.textContent = `Reading ${file.name} locally.`;
  try {
    const source = await file.text();
    const summary = parseTranscript(source);
    showReceipt(summary, source);
    status.textContent = 'Outputs ready. Read the scope receipt before you copy or save it.';
  } catch (error) {
    hideReceipt();
    status.textContent = error instanceof Error ? error.message : 'This transcript could not be read.';
    transcriptInput.value = '';
    transcriptInput.focus();
  }
}

transcriptInput.addEventListener('change', () => {
  readTranscript(transcriptInput.files?.[0]);
});

for (const eventName of ['dragenter', 'dragover']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  });
}

dropzone.addEventListener('drop', (event) => {
  readTranscript(event.dataTransfer?.files?.[0]);
});

outputKind.addEventListener('change', () => {
  renderOutput();
  status.textContent = `Read the ${outputSettings[outputKind.value].heading.toLowerCase()} before you copy or save it.`;
});

privacyCheck.addEventListener('change', () => {
  const outputName = outputSettings[outputKind.value].heading;
  copyButton.disabled = !privacyCheck.checked;
  saveButton.disabled = !privacyCheck.checked;
  status.textContent = privacyCheck.checked
    ? `${outputName} checked. Copy or save when ready.`
    : `Read the ${outputName.toLowerCase()} before you copy or save it.`;
});

receiptText.addEventListener('input', () => {
  if (outputs) outputs[outputKind.value] = receiptText.value;
  if (!privacyCheck.checked) return;
  const outputName = outputSettings[outputKind.value].heading;
  lockActions();
  status.textContent = `${outputName} changed. Check it again before you copy or save it.`;
});

copyButton.addEventListener('click', async () => {
  const outputName = outputSettings[outputKind.value].heading;
  try {
    await navigator.clipboard.writeText(receiptText.value);
    status.textContent = `${outputName} copied.`;
  } catch {
    status.textContent = `Copy failed. Select the ${outputName.toLowerCase()} text and copy it manually.`;
    receiptText.focus();
    receiptText.select();
  }
});

saveButton.addEventListener('click', () => {
  const settings = outputSettings[outputKind.value];
  const blob = new Blob([`${receiptText.value}\n`], { type: settings.type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = settings.filename;
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = `${settings.heading} saved.`;
});
