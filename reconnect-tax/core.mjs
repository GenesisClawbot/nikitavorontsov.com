export function formatReceipt(summary) {
  const items = summary.notices.map((notice, index) => (
    `${String(index + 1).padStart(2, '0')}  RECONNECTING ${notice.label}`
  ));

  return [
    'RECONNECT TAX',
    'TERMINAL INCIDENT RECEIPT',
    '',
    'ITEMIZED RETRIES',
    ...items,
    '',
    `TOTAL MATCHING NOTICES  ${summary.noticeCount}`,
    '',
    'FINANCIAL IMPACT',
    'Unknown. This log cannot show whether any retry was billed.',
    '',
    'Counted only RECONNECTING n/n markers in the text you pasted.',
  ].join('\n');
}

export function parseReconnectLog(source) {
  const notices = [...String(source ?? '').matchAll(/\breconnecting[ \t]+(\d+)[ \t]*\/[ \t]*(\d+)\b/gi)]
    .map((match) => {
      const attempt = match[1];
      const limit = match[2];
      return { attempt, limit, label: `${attempt}/${limit}` };
    });

  if (!notices.length) throw new Error('No reconnect notices found. Paste a log containing RECONNECTING 1/5-style lines.');
  return { noticeCount: notices.length, notices };
}
