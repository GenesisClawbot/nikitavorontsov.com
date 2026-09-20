import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fixtures = Object.freeze([
  { label: 'winter', value: '2024-01-15' },
  { label: 'summer', value: '2024-07-15' },
  { label: 'leap-day', value: '2024-02-29' },
]);

const timeZones = Object.freeze([
  'UTC',
  'Europe/London',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Pacific/Kiritimati',
]);

function validateDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(0);
  candidate.setUTCFullYear(year, month - 1, day);
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

const childSource = String.raw`
const fixtures = JSON.parse(process.argv[1]);
const rows = fixtures.map(({ label, value }) => {
  const [year, month, day] = value.split('-').map(Number);
  const localConstructThenIso = new Date(year, month - 1, day).toISOString().slice(0, 10);
  const parseAsUtcThenReadLocal = (() => {
    const date = new Date(value);
    const pad = (part) => String(part).padStart(2, '0');
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  })();
  return {
    timeZone: process.env.TZ,
    label,
    input: value,
    localConstructThenIso,
    parseAsUtcThenReadLocal,
    preserveValidatedDateOnlyString: validateDateOnly(value) ? value : null,
  };
});

function validateDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(0);
  candidate.setUTCFullYear(year, month - 1, day);
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

process.stdout.write(JSON.stringify({
  provenance: {
    node: process.version,
    v8: process.versions.v8,
    icu: process.versions.icu,
    tzEnvironment: process.env.TZ,
    resolvedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  rows,
}));
`;

const scriptPath = fileURLToPath(import.meta.url);
const childRuns = timeZones.map((timeZone) => {
  const result = spawnSync(process.execPath, ['-e', childSource, JSON.stringify(fixtures)], {
    encoding: 'utf8',
    env: { ...process.env, TZ: timeZone },
  });
  if (result.status !== 0) {
    throw new Error(`Child process failed for ${timeZone}: ${result.stderr || result.error}`);
  }
  return JSON.parse(result.stdout);
});

const rows = childRuns.flatMap(({ rows: zoneRows }) => zoneRows);
const expectedCases = new Map([
  ['UTC|winter', ['2024-01-15', '2024-01-15']],
  ['Europe/London|winter', ['2024-01-15', '2024-01-15']],
  ['Europe/London|summer', ['2024-07-14', '2024-07-15']],
  ['America/Los_Angeles|winter', ['2024-01-15', '2024-01-14']],
  ['Asia/Kolkata|winter', ['2024-01-14', '2024-01-15']],
  ['Pacific/Kiritimati|leap-day', ['2024-02-28', '2024-02-29']],
]);

for (const row of rows) {
  if (row.preserveValidatedDateOnlyString !== row.input) {
    throw new Error(`Date-only preservation failed for ${row.timeZone} ${row.input}`);
  }
  const expected = expectedCases.get(`${row.timeZone}|${row.label}`);
  if (expected && (row.localConstructThenIso !== expected[0] || row.parseAsUtcThenReadLocal !== expected[1])) {
    throw new Error(`Known-case assertion failed for ${row.timeZone} ${row.label}: ${JSON.stringify(row)}`);
  }
}

const invalidInputs = ['2023-02-29', '2024-02-30', '2024-2-09', '2024-02-09T00:00:00Z'];
const invalidDateChecks = invalidInputs.map((input) => ({ input, rejected: !validateDateOnly(input) }));
if (invalidDateChecks.some(({ rejected }) => !rejected)) {
  throw new Error('At least one invalid date-only string was accepted');
}

const result = {
  experiment: 'date-only-representation-time-zone-cases',
  sampleNote: 'Chosen edge cases only; these rows are not population error rates.',
  fixtures,
  timeZones,
  parentRuntime: {
    node: process.version,
    v8: process.versions.v8,
    icu: process.versions.icu,
    platform: process.platform,
    architecture: process.arch,
  },
  zoneProvenance: childRuns.map(({ provenance }) => provenance),
  invalidDateChecks,
  validation: {
    rowCount: rows.length,
    knownTimezoneAssertions: expectedCases.size,
    allPreservedStringsEqualInput: rows.every((row) => row.preserveValidatedDateOnlyString === row.input),
    allInvalidInputsRejected: invalidDateChecks.every(({ rejected }) => rejected),
  },
  rows,
};

const outputPath = path.join(path.dirname(scriptPath), 'raw-rows.json');
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${rows.length} rows across ${timeZones.length} time zones to ${outputPath}`);
console.log(`Runtime: ${process.version}; ICU ${process.versions.icu}; ${process.platform}/${process.arch}`);
