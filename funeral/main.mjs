import { calculateAutopsy, receiptData, shareText } from './calculate.mjs?v=subscription-autopsy-20260826-01';
import { deliverShare } from './share.mjs?v=subscription-autopsy-20260826-01';
import {
  announceStatus,
  fieldForError,
  showFormError,
  showReceipt,
} from './view.mjs?v=subscription-autopsy-20260826-01';

const form = document.querySelector('#autopsy-form');
const error = document.querySelector('#form-error');
const status = document.querySelector('#status');
const shareButton = document.querySelector('#share-button');
const printButton = document.querySelector('#print-button');

const receiptElements = {
  section: document.querySelector('#receipt'),
  heading: document.querySelector('#receipt-heading'),
  service: document.querySelector('#receipt-service'),
  monthly: document.querySelector('#receipt-monthly'),
  months: document.querySelector('#receipt-months'),
  usefulSessions: document.querySelector('#receipt-sessions'),
  total: document.querySelector('#receipt-total'),
  workTimeRows: document.querySelector('#work-time-rows'),
  workPerMonth: document.querySelector('#receipt-work-month'),
  workPerUsefulSession: document.querySelector('#receipt-work-session'),
  each: document.querySelector('#receipt-each'),
  finding: document.querySelector('#receipt-finding'),
  status,
};

let latestResult = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  error.textContent = '';

  try {
    latestResult = calculateAutopsy(Object.fromEntries(new FormData(form)));
    showReceipt(receiptData(latestResult), receiptElements);
  } catch (caught) {
    latestResult = null;
    const field = fieldForError(caught.message, {
      monthlyPrice: form.elements.monthlyPrice,
      monthsPaid: form.elements.monthsPaid,
      usefulSessions: form.elements.usefulSessions,
      hourlyTakeHome: form.elements.hourlyTakeHome,
      currency: form.elements.currency,
    });
    showFormError(caught.message, {
      section: receiptElements.section,
      error,
      status,
      field,
    });
  }
});

shareButton.addEventListener('click', async () => {
  if (!latestResult) return;

  try {
    const text = shareText(latestResult, new URL('./', window.location.href).href);
    const outcome = await deliverShare(text);
    announceStatus(
      status,
      outcome === 'shared' ? 'Receipt shared.' : 'Receipt copied to the clipboard.',
    );
  } catch (caught) {
    if (caught.name === 'AbortError') {
      announceStatus(status, 'Share cancelled.');
      return;
    }
    announceStatus(status, caught.message);
  }
});

printButton.addEventListener('click', () => {
  announceStatus(status, 'Print dialog opened.');
  window.print();
});
