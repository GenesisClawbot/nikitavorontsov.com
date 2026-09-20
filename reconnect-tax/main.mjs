import { formatReceipt, parseReconnectLog } from './core.mjs?v=reconnect-tax-20260825-01';

const BOOT_ID = document.documentElement.dataset.build;
const BOOT_STORAGE_KEY = 'reconnect-tax-boot-id';

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
  // A blocked local store does not block log parsing.
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

const log = document.querySelector('#log');
const makeButton = document.querySelector('#make-button');
const status = document.querySelector('#status');
const receipt = document.querySelector('#receipt');
const receiptHeading = document.querySelector('#receipt-heading');
const receiptText = document.querySelector('#receipt-text');
const reviewCheck = document.querySelector('#review-check');
const copyButton = document.querySelector('#copy-button');
const saveButton = document.querySelector('#save-button');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function lockActions() {
  reviewCheck.checked = false;
  copyButton.disabled = true;
  saveButton.disabled = true;
}

reviewCheck.addEventListener('change', () => {
  copyButton.disabled = !reviewCheck.checked;
  saveButton.disabled = !reviewCheck.checked;
});

receiptText.addEventListener('input', () => {
  lockActions();
  status.textContent = 'Receipt changed. Review it again before you copy or download it.';
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(receiptText.value);
    status.textContent = 'Receipt copied.';
  } catch {
    status.textContent = 'Copy failed. Select the receipt text and copy it manually.';
    receiptText.focus();
    receiptText.select();
  }
});

saveButton.addEventListener('click', () => {
  const blob = new Blob([receiptText.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'reconnect-tax-receipt.txt';
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Receipt downloaded.';
});

makeButton.addEventListener('click', () => {
  try {
    const summary = parseReconnectLog(log.value);
    receiptText.value = formatReceipt(summary);
    lockActions();
    receipt.hidden = false;
    status.textContent = `Receipt ready. ${summary.noticeCount} matching notices found.`;
    receiptHeading.focus();
    receipt.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  } catch (error) {
    receipt.hidden = true;
    status.textContent = error.message;
    log.focus();
  }
});
