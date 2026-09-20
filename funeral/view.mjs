export function announceStatus(element, message, schedule = queueMicrotask) {
  element.textContent = '';
  schedule(() => {
    element.textContent = message;
  });
}

export function fieldForError(message, fields) {
  if (message.startsWith('Monthly price')) return fields.monthlyPrice;
  if (message.startsWith('Months paid')) return fields.monthsPaid;
  if (message.startsWith('Useful sessions')) return fields.usefulSessions;
  if (
    message.startsWith('Take-home pay per hour')
    || message.startsWith('Entered amounts produce work time')
  ) return fields.hourlyTakeHome;
  return fields.currency;
}

export function showFormError(message, elements, schedule = queueMicrotask) {
  elements.section.hidden = true;
  elements.error.textContent = message;
  announceStatus(elements.status, `Could not complete autopsy. ${message}`, schedule);
  elements.field.focus();
}

export function showReceipt(data, elements, schedule = queueMicrotask) {
  elements.service.textContent = data.service;
  elements.monthly.textContent = data.monthly;
  elements.months.textContent = data.months;
  elements.usefulSessions.textContent = data.usefulSessions;
  elements.total.textContent = data.total;
  const hasWorkTime = data.workPerMonth !== null;
  elements.workTimeRows.hidden = !hasWorkTime;
  if (hasWorkTime) {
    elements.workPerMonth.textContent = data.workPerMonth;
    elements.workPerUsefulSession.textContent = data.workPerUsefulSession ?? 'Not measurable';
  }
  elements.each.textContent = data.each;
  elements.each.classList?.toggle('big-cost-long', data.each === 'Not measurable');
  elements.finding.textContent = data.finding;
  elements.section.hidden = false;
  announceStatus(elements.status, 'Autopsy complete. The receipt is ready.', schedule);
  elements.heading.focus();
}
