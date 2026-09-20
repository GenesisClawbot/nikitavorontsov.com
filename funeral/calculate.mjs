const CURRENCY_SYMBOLS = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

function parseMoney(value, label) {
  const text = String(value ?? '').trim();
  if (/^\d+\.\d{3,}$/.test(text)) {
    throw new Error(`${label} must use no more than two decimal places.`);
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(`${label} must be more than zero.`);
  }

  const [whole, fraction = ''] = text.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error(`${label} is too large.`);
  if (minor <= 0) throw new Error(`${label} must be more than zero.`);
  return minor;
}

function parseMonthlyPrice(value) {
  return parseMoney(value, 'Monthly price');
}

function parseHourlyTakeHome(value) {
  if (String(value ?? '').trim() === '') return null;
  return parseMoney(value, 'Take-home pay per hour');
}

function calculateWorkMinutes(minor, hourlyMinor, divisor = 1) {
  const numerator = BigInt(minor) * 60n;
  const denominator = BigInt(hourlyMinor) * BigInt(divisor);
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Entered amounts produce work time that is too large.');
  }
  return Number(rounded);
}

function parseWholeNumber(value, minimum, message) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(message);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < minimum) throw new Error(message);
  return number;
}

export function calculateAutopsy(input) {
  if (!Object.hasOwn(CURRENCY_SYMBOLS, input.currency)) {
    throw new Error('Choose GBP, USD, or EUR.');
  }

  const monthlyMinor = parseMonthlyPrice(input.monthlyPrice);
  const hourlyTakeHomeMinor = parseHourlyTakeHome(input.hourlyTakeHome);
  const monthsPaid = parseWholeNumber(
    input.monthsPaid,
    1,
    'Months paid must be a whole number of at least one.',
  );
  const usefulSessions = parseWholeNumber(
    input.usefulSessions,
    0,
    'Useful sessions must be a whole number of zero or more.',
  );
  const totalMinor = monthlyMinor * monthsPaid;
  if (!Number.isSafeInteger(totalMinor)) {
    throw new Error('Months paid produces a total that is too large.');
  }

  const workMinutesPerMonth = hourlyTakeHomeMinor === null
    ? null
    : calculateWorkMinutes(monthlyMinor, hourlyTakeHomeMinor);
  const workMinutesPerUsefulSession = hourlyTakeHomeMinor === null || usefulSessions === 0
    ? null
    : calculateWorkMinutes(totalMinor, hourlyTakeHomeMinor, usefulSessions);

  return {
    service: String(input.service ?? '').trim() || 'Unnamed subscription',
    monthlyMinor,
    monthsPaid,
    usefulSessions,
    currency: input.currency,
    totalMinor,
    costPerUsefulSessionMinor: usefulSessions > 0
      ? Math.round(totalMinor / usefulSessions)
      : null,
    hourlyTakeHomeMinor,
    workMinutesPerMonth,
    workMinutesPerUsefulSession,
  };
}

export function formatMoney(minor, currency) {
  const symbol = CURRENCY_SYMBOLS[currency];
  const amount = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${symbol}${amount}`;
}

export function formatWorkTime(minutes) {
  if (minutes === 0) return 'Less than 1 min';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function receiptData(result) {
  const hasUsefulSessions = result.usefulSessions > 0;
  return {
    service: result.service,
    monthly: formatMoney(result.monthlyMinor, result.currency),
    months: String(result.monthsPaid),
    usefulSessions: String(result.usefulSessions),
    total: formatMoney(result.totalMinor, result.currency),
    each: hasUsefulSessions
      ? formatMoney(result.costPerUsefulSessionMinor, result.currency)
      : 'Not measurable',
    workPerMonth: result.workMinutesPerMonth === null
      ? null
      : formatWorkTime(result.workMinutesPerMonth),
    workPerUsefulSession: result.workMinutesPerUsefulSession === null
      ? null
      : formatWorkTime(result.workMinutesPerUsefulSession),
    finding: hasUsefulSessions
      ? 'The corpse can explain itself.'
      : 'Division by zero has entered the chat.',
  };
}

export function shareText(result, url) {
  if (result.hourlyTakeHomeMinor !== null) {
    if (result.usefulSessions === 0) {
      const workPerMonth = formatWorkTime(result.workMinutesPerMonth);
      return `Subscription autopsy: I traded ${workPerMonth} of take-home pay each month and counted 0 useful sessions with ${result.service}. Division by zero has entered the chat. ${url}`;
    }

    const workPerUsefulSession = formatWorkTime(result.workMinutesPerUsefulSession);
    return `Subscription autopsy: I traded ${workPerUsefulSession} of take-home pay for each of ${result.usefulSessions} useful sessions with ${result.service}. The corpse can explain itself. ${url}`;
  }

  const total = formatMoney(result.totalMinor, result.currency);
  if (result.usefulSessions === 0) {
    return `Subscription autopsy: I paid ${total} and counted 0 useful sessions with ${result.service}. Division by zero has entered the chat. ${url}`;
  }

  const each = formatMoney(result.costPerUsefulSessionMinor, result.currency);
  return `Subscription autopsy: I paid ${total} for ${result.usefulSessions} useful sessions with ${result.service}. That is ${each} each. The corpse can explain itself. ${url}`;
}
