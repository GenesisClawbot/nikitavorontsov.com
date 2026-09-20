import {
  buildReviewBrief,
  buildShellCheck,
  parsePullRequestUrl,
} from './core.mjs?v=pr-warrant-20260825-02';
import { fetchWarrant } from './request.mjs?v=pr-warrant-20260825-02';

const form = document.querySelector('#warrant-form');
const prUrl = document.querySelector('#pr-url');
const issueButton = document.querySelector('#issue-button');
const lookupStatus = document.querySelector('#lookup-status');
const warrantSection = document.querySelector('#warrant');
const warrantHeading = document.querySelector('#warrant-heading');
const prStatus = document.querySelector('#pr-status');
const caseId = document.querySelector('#case-id');
const prTitle = document.querySelector('#pr-title');
const canonicalLink = document.querySelector('#canonical-link');
const baseIdentity = document.querySelector('#base-identity');
const headIdentity = document.querySelector('#head-identity');
const commitCount = document.querySelector('#commit-count');
const fileCount = document.querySelector('#file-count');
const additionCount = document.querySelector('#addition-count');
const deletionCount = document.querySelector('#deletion-count');
const reviewBrief = document.querySelector('#review-brief');
const shellCheck = document.querySelector('#shell-check');
const copyBrief = document.querySelector('#copy-brief');
const copyCheck = document.querySelector('#copy-check');
const briefCopyStatus = document.querySelector('#brief-copy-status');
const checkCopyStatus = document.querySelector('#check-copy-status');
const integerFormat = new Intl.NumberFormat('en-US');

let activeController = null;
let requestNumber = 0;

function setBusy(isBusy) {
  issueButton.disabled = isBusy;
  issueButton.textContent = isBusy ? 'Checking exact PR' : 'Issue warrant';
}

function clearWarrant() {
  warrantSection.hidden = true;
  prStatus.textContent = '';
  caseId.textContent = '';
  prTitle.textContent = '';
  canonicalLink.removeAttribute('href');
  baseIdentity.textContent = '';
  headIdentity.textContent = '';
  commitCount.textContent = '0';
  fileCount.textContent = '0';
  additionCount.textContent = '0';
  deletionCount.textContent = '0';
  reviewBrief.textContent = '';
  shellCheck.textContent = '';
  briefCopyStatus.textContent = '';
  checkCopyStatus.textContent = '';
}

function renderWarrant(warrant) {
  prStatus.textContent = warrant.status;
  caseId.textContent = `${warrant.repo} / PR #${warrant.number}`;
  prTitle.textContent = warrant.title;
  canonicalLink.href = warrant.canonicalUrl;
  baseIdentity.textContent = `${warrant.baseRef} @ ${warrant.baseSha}`;
  headIdentity.textContent = `${warrant.headRef} @ ${warrant.headSha}`;
  commitCount.textContent = integerFormat.format(warrant.commits);
  fileCount.textContent = integerFormat.format(warrant.changedFiles);
  additionCount.textContent = `+${integerFormat.format(warrant.additions)}`;
  deletionCount.textContent = `−${integerFormat.format(warrant.deletions)}`;
  reviewBrief.textContent = buildReviewBrief(warrant);
  shellCheck.textContent = buildShellCheck(warrant);
  warrantSection.hidden = false;
}

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'The warrant could not be issued. Try again.';
}

async function issueWarrant() {
  const thisRequest = ++requestNumber;
  activeController?.abort();
  activeController = new AbortController();
  clearWarrant();

  let reference;
  try {
    reference = parsePullRequestUrl(prUrl.value);
  } catch (error) {
    activeController = null;
    lookupStatus.textContent = describeError(error);
    prUrl.focus();
    return;
  }

  setBusy(true);
  lookupStatus.textContent = `Checking ${reference.slug} pull request #${reference.number}…`;
  let lookupFailed = false;

  try {
    const warrant = await fetchWarrant(reference, activeController.signal);
    if (thisRequest !== requestNumber) {
      return;
    }

    renderWarrant(warrant);
    lookupStatus.textContent = 'Warrant ready. The base and head commits are pinned below.';
    warrantHeading.focus();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    warrantSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    if (thisRequest !== requestNumber || error?.name === 'AbortError') {
      return;
    }
    lookupStatus.textContent = describeError(error);
    lookupFailed = true;
  } finally {
    if (thisRequest === requestNumber) {
      activeController = null;
      setBusy(false);
      if (lookupFailed) {
        issueButton.focus();
      }
    }
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const previouslyFocused = document.activeElement;
    const copyArea = document.createElement('textarea');
    copyArea.value = text;
    copyArea.setAttribute('readonly', '');
    copyArea.style.position = 'fixed';
    copyArea.style.opacity = '0';
    document.body.append(copyArea);

    try {
      copyArea.select();
      if (!document.execCommand('copy')) {
        throw new Error('Copy failed');
      }
    } finally {
      copyArea.remove();
      previouslyFocused?.focus();
    }
  }
}

async function copyArtifact(source, status, label) {
  const text = source.textContent;
  const copyRequest = requestNumber;
  try {
    await copyText(text);
    if (copyRequest === requestNumber && source.textContent === text) {
      status.textContent = `${label} copied.`;
    }
  } catch {
    if (copyRequest === requestNumber && source.textContent === text) {
      status.textContent = `Could not copy the ${label.toLowerCase()}. Select the text and copy it manually.`;
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  issueWarrant();
});

prUrl.addEventListener('input', () => {
  if (activeController) {
    ++requestNumber;
    activeController.abort();
    activeController = null;
    setBusy(false);
  }
  lookupStatus.textContent = '';
  clearWarrant();
});

copyBrief.addEventListener('click', () => copyArtifact(reviewBrief, briefCopyStatus, 'Brief'));
copyCheck.addEventListener('click', () => copyArtifact(shellCheck, checkCopyStatus, 'Shell check'));

prUrl.disabled = false;
setBusy(false);
lookupStatus.textContent = '';
