import { analyzeText, formatDeclaration } from './core.mjs?v=regex-customs-20260825-01';

const sourceText = document.querySelector('#source-text');
const inspectionForm = document.querySelector('#inspection-form');
const sampleButton = document.querySelector('#sample-button');
const clearButton = document.querySelector('#clear-button');
const copyButton = document.querySelector('#copy-button');
const status = document.querySelector('#status');
const resultPanel = document.querySelector('#result');
const resultHeading = document.querySelector('#result-heading');
const asciiCount = document.querySelector('#ascii-count');
const unicodeCount = document.querySelector('#unicode-count');
const outsideCount = document.querySelector('#outside-count');
const coverage = document.querySelector('#coverage');
const scriptTableBody = document.querySelector('#script-table-body');
const integerFormat = new Intl.NumberFormat('en-US');

let declaration = '';

function formatInteger(value) {
  return integerFormat.format(value);
}

function renderScripts(scripts) {
  scriptTableBody.replaceChildren();

  if (scripts.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.textContent = 'No letter code points found.';
    row.append(cell);
    scriptTableBody.append(row);
    return;
  }

  for (const script of scripts) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    const count = document.createElement('td');
    name.scope = 'row';
    name.textContent = script.label;
    count.textContent = formatInteger(script.letters);
    row.append(name, count);
    scriptTableBody.append(row);
  }
}

function renderResult(result) {
  asciiCount.textContent = formatInteger(result.asciiLetters);
  unicodeCount.textContent = formatInteger(result.unicodeLetters);
  outsideCount.textContent = formatInteger(result.outsideAsciiLetters);
  coverage.textContent = result.asciiCoverage === null
    ? 'Not applicable'
    : `${(result.asciiCoverage * 100).toFixed(1)}%`;
  renderScripts(result.scripts);

  declaration = formatDeclaration(result);
  copyButton.disabled = false;
  resultPanel.hidden = false;
  status.textContent = `Inspection complete. ${formatInteger(result.unicodeLetters)} letter code points checked.`;
  resultHeading.focus();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  resultPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

function inspectSource() {
  if (sourceText.value.length === 0) {
    resultPanel.hidden = true;
    copyButton.disabled = true;
    declaration = '';
    status.textContent = 'Paste text before inspection.';
    sourceText.focus();
    return;
  }

  const result = analyzeText(sourceText.value);
  renderResult(result);
}

inspectionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  inspectSource();
});

sampleButton.addEventListener('click', () => {
  sourceText.value = 'ABC 한글 猫';
  inspectSource();
});

clearButton.addEventListener('click', () => {
  sourceText.value = '';
  declaration = '';
  resultPanel.hidden = true;
  copyButton.disabled = true;
  scriptTableBody.replaceChildren();
  status.textContent = 'Inspection desk cleared.';
  sourceText.focus();
});

sourceText.addEventListener('input', () => {
  if (resultPanel.hidden) return;
  resultPanel.hidden = true;
  copyButton.disabled = true;
  declaration = '';
  status.textContent = 'Text changed. Inspect it again.';
});

copyButton.addEventListener('click', async () => {
  if (!declaration) return;

  try {
    await navigator.clipboard.writeText(declaration);
    status.textContent = 'Declaration copied. It contains counts and methods, not the pasted text.';
  } catch {
    status.textContent = 'The browser blocked copying. Select the counts from the declaration instead.';
    copyButton.focus();
  }
});

status.textContent = 'Paste text or try the sample. The inspection runs in this browser.';
