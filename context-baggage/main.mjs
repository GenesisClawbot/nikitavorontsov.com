import { analyzeFiles, DUPLICATE_LIMITS } from './core.mjs?v=context-baggage-20260825-01';
import { createSelectionBelt } from './selection.mjs?v=context-baggage-20260825-01';

const MAX_TOTAL_MIB = 2;
const MAX_TOTAL_BYTES = MAX_TOTAL_MIB * 1024 * 1024;
const MAX_FILES = 100;
const MAX_VISIBLE_DUPLICATES = 100;
const selectionBelt = createSelectionBelt(MAX_TOTAL_BYTES, MAX_FILES);
const fileInput = document.querySelector('#file-input');
const chooseButton = document.querySelector('#choose-button');
const dropZone = document.querySelector('#drop-zone');
const fileList = document.querySelector('#file-list');
const weighButton = document.querySelector('#weigh-button');
const clearButton = document.querySelector('#clear-button');
const status = document.querySelector('#status');
const manifest = document.querySelector('#manifest');
const manifestHeading = document.querySelector('#manifest-heading');
const manifestStatus = document.querySelector('#manifest-status');
const totalBytes = document.querySelector('#total-bytes');
const totalLines = document.querySelector('#total-lines');
const totalWords = document.querySelector('#total-words');
const fileManifest = document.querySelector('#file-manifest');
const duplicateSummary = document.querySelector('#duplicate-summary');
const duplicateList = document.querySelector('#duplicate-list');
const integerFormat = new Intl.NumberFormat('en-US');
const percentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

let isWeighing = false;

function formatInteger(value) {
  return integerFormat.format(value);
}

function formatPercent(numerator, denominator) {
  if (denominator === 0) {
    return '0';
  }
  return percentFormat.format((numerator / denominator) * 100);
}

function plural(value, singular, pluralForm = `${singular}s`) {
  return value === 1 ? singular : pluralForm;
}

function invalidateManifest() {
  manifest.hidden = true;
  manifestStatus.textContent = '';
  totalBytes.textContent = '0 B';
  totalLines.textContent = '0';
  totalWords.textContent = '0';
  fileManifest.replaceChildren();
  duplicateSummary.textContent = '';
  duplicateList.replaceChildren();
}

function updateActions() {
  const hasFiles = selectionBelt.entries.length > 0;
  fileInput.disabled = isWeighing;
  chooseButton.disabled = isWeighing;
  weighButton.disabled = !hasFiles || isWeighing;
  clearButton.disabled = !hasFiles || isWeighing;
  for (const removeButton of fileList.querySelectorAll('.remove-button')) {
    removeButton.disabled = isWeighing;
  }
}

function createFileLabels(entries) {
  const totals = new Map();
  const seen = new Map();
  const labels = new Map();

  for (const entry of entries) {
    totals.set(entry.file.name, (totals.get(entry.file.name) ?? 0) + 1);
  }

  for (const entry of entries) {
    const selectionNumber = (seen.get(entry.file.name) ?? 0) + 1;
    seen.set(entry.file.name, selectionNumber);
    const label = totals.get(entry.file.name) === 1
      ? entry.file.name
      : `${entry.file.name} (selected ${selectionNumber})`;
    labels.set(entry.id, label);
  }

  return labels;
}

function removeFile(id) {
  const selectedFiles = selectionBelt.entries;
  const removedIndex = selectedFiles.findIndex((entry) => entry.id === id);
  if (removedIndex === -1 || !selectionBelt.remove(id)) {
    return;
  }

  const remainingCount = selectionBelt.entries.length;
  invalidateManifest();
  status.textContent = remainingCount === 0
    ? 'The belt is empty.'
    : `${remainingCount} ${plural(remainingCount, 'file')} waiting to weigh.`;
  renderQueue();

  const removeButtons = fileList.querySelectorAll('.remove-button');
  const nextRemoveButton = removeButtons[Math.min(removedIndex, removeButtons.length - 1)];
  if (nextRemoveButton) {
    nextRemoveButton.focus();
  } else {
    chooseButton.focus();
  }
}

function renderQueue() {
  const selectedFiles = selectionBelt.entries;
  const labels = createFileLabels(selectedFiles);
  fileList.replaceChildren();

  if (selectedFiles.length === 0) {
    const item = document.createElement('li');
    item.className = 'queued-file';
    const empty = document.createElement('span');
    empty.textContent = 'No files on the belt.';
    item.append(empty);
    fileList.append(item);
    updateActions();
    return;
  }

  for (const entry of selectedFiles) {
    const item = document.createElement('li');
    item.className = 'queued-file';

    const label = document.createElement('span');
    label.textContent = `${labels.get(entry.id)} · ${formatInteger(entry.file.size)} B`;

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.type = 'button';
    removeButton.disabled = isWeighing;
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove ${labels.get(entry.id)}`);
    removeButton.addEventListener('click', () => removeFile(entry.id));

    item.append(label, removeButton);
    fileList.append(item);
  }

  updateActions();
}

function addFiles(files) {
  const { added, rejected } = selectionBelt.add(files);

  invalidateManifest();
  renderQueue();

  const messages = [];
  if (added > 0) {
    messages.push(`Added ${added} ${plural(added, 'file')}.`);
  }
  for (const rejection of rejected) {
    if (rejection.reason === 'type') {
      messages.push(`${rejection.file.name} is not a UTF-8 text or Markdown file.`);
    } else if (rejection.reason === 'file-limit') {
      messages.push(`${rejection.file.name} was not added. Select up to ${MAX_FILES} files.`);
    } else if (rejection.reason === 'limit') {
      messages.push(`${rejection.file.name} was not added. Selected files are limited to ${MAX_TOTAL_MIB} MiB.`);
    } else {
      messages.push(`${rejection.file.name} was not added.`);
    }
  }
  status.textContent = messages.join(' ');
}

function renderFileManifest(result, labels) {
  fileManifest.replaceChildren();

  for (const file of result.files) {
    const percentage = formatPercent(file.byteShare.numerator, file.byteShare.denominator);
    const row = document.createElement('div');
    row.className = 'manifest-row';

    const name = document.createElement('span');
    name.className = 'manifest-name';
    name.textContent = labels.get(file.id) ?? file.id;

    const track = document.createElement('span');
    track.className = 'weight-track';
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${formatInteger(file.byteShare.numerator)} of ${formatInteger(file.byteShare.denominator)} selected bytes, ${percentage} percent`);

    const fill = document.createElement('span');
    fill.className = 'weight-fill';
    fill.style.width = `${percentage}%`;
    track.append(fill);

    const weight = document.createElement('span');
    weight.className = 'manifest-detail';
    weight.textContent = `${formatInteger(file.byteCount)} B · ${percentage}%`;

    const counts = document.createElement('span');
    counts.className = 'manifest-detail';
    counts.textContent = `${formatInteger(file.lineCount)} ${plural(file.lineCount, 'line')} · ${formatInteger(file.wordCount)} ${plural(file.wordCount, 'word')}`;

    row.append(name, track, weight, counts);
    fileManifest.append(row);
  }
}

function renderDuplicates(result, labels) {
  duplicateList.replaceChildren();

  if (result.duplicates.length === 0) {
    duplicateSummary.textContent = `No repeated block met both limits: ${DUPLICATE_LIMITS.wordCount} words and ${DUPLICATE_LIMITS.normalizedByteCount} normalized UTF-8 bytes.`;
    return;
  }

  const visibleDuplicates = result.duplicates.slice(0, MAX_VISIBLE_DUPLICATES);
  const overflowNotice = result.duplicates.length > visibleDuplicates.length
    ? ` Showing the first ${visibleDuplicates.length} by normalized byte weight.`
    : '';
  duplicateSummary.textContent = `${result.duplicates.length} repeated long ${plural(result.duplicates.length, 'passage')} found across selected entries. Matching is exact after whitespace is normalized.${overflowNotice}`;

  for (const duplicate of visibleDuplicates) {
    const item = document.createElement('li');
    item.className = 'duplicate-item';
    const locations = duplicate.occurrences.map((occurrence) => (
      `${labels.get(occurrence.fileId) ?? occurrence.fileId}, ${plural(occurrence.endLine - occurrence.startLine + 1, 'line')} ${occurrence.startLine}–${occurrence.endLine}`
    ));
    item.textContent = `${duplicate.id} · ${formatInteger(duplicate.normalizedByteCount)} normalized B · ${formatInteger(duplicate.wordCount)} words · ${locations.join('; ')}`;
    duplicateList.append(item);
  }
}

function renderManifest(result) {
  const lineCount = result.files.reduce((sum, file) => sum + file.lineCount, 0);
  const wordCount = result.files.reduce((sum, file) => sum + file.wordCount, 0);
  const labels = createFileLabels(selectionBelt.entries);

  totalBytes.textContent = `${formatInteger(result.totalByteCount)} B`;
  totalLines.textContent = formatInteger(lineCount);
  totalWords.textContent = formatInteger(wordCount);
  renderFileManifest(result, labels);
  renderDuplicates(result, labels);
  manifestStatus.textContent = `${result.files.length} ${plural(result.files.length, 'file')} weighed`;
}

function describeError(error) {
  if (error?.code === 'INVALID_UTF8') {
    const label = createFileLabels(selectionBelt.entries).get(error.fileId) ?? error.fileId;
    return `${label} is not valid UTF-8 text. Remove it and weigh the files again.`;
  }
  return error instanceof Error ? error.message : 'The files could not be weighed.';
}

async function weighFiles() {
  if (selectionBelt.entries.length === 0) {
    status.textContent = 'Choose at least one file first.';
    chooseButton.focus();
    return;
  }

  isWeighing = true;
  const weighingSelection = selectionBelt.lock();
  updateActions();
  invalidateManifest();
  status.textContent = 'Weighing local files…';
  let weighingFailed = false;

  try {
    const preparedFiles = await Promise.all(weighingSelection.map(async (entry) => ({
      id: entry.id,
      name: entry.file.name,
      data: new Uint8Array(await entry.file.arrayBuffer()),
    })));

    const result = analyzeFiles(preparedFiles);
    renderManifest(result);
    manifest.hidden = false;
    status.textContent = 'Manifest ready.';
    manifestHeading.focus();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    manifest.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    weighingFailed = true;
    manifest.hidden = true;
    status.textContent = describeError(error);
  } finally {
    selectionBelt.unlock();
    isWeighing = false;
    updateActions();
    if (weighingFailed) {
      weighButton.focus();
    }
  }
}

chooseButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
}

dropZone.addEventListener('drop', (event) => {
  addFiles(event.dataTransfer.files);
});

weighButton.addEventListener('click', weighFiles);
clearButton.addEventListener('click', () => {
  selectionBelt.clear();
  fileInput.value = '';
  status.textContent = 'The belt is empty.';
  invalidateManifest();
  renderQueue();
  chooseButton.focus();
});

renderQueue();
