const scripts = [
  { id: 'latin', label: 'Latin', pattern: /\p{Script=Latin}/u },
  { id: 'hangul', label: 'Hangul', pattern: /\p{Script=Hangul}/u },
  { id: 'han', label: 'Han', pattern: /\p{Script=Han}/u },
];

export function formatDeclaration(result) {
  const coverage = result.asciiCoverage === null
    ? 'not applicable'
    : `${(result.asciiCoverage * 100).toFixed(1)}%`;
  const scriptSummary = result.scripts.length > 0
    ? result.scripts.map(({ label, letters }) => `${label} ${letters}`).join('; ')
    : 'none';

  return [
    'REGEX CUSTOMS DECLARATION',
    `[A-Za-z]: ${result.asciiLetters} admitted`,
    `\\p{L}: ${result.unicodeLetters} letter code points`,
    `Outside A-Z: ${result.outsideAsciiLetters}`,
    `A-Z coverage: ${coverage}`,
    `Scripts: ${scriptSummary}`,
    'Method: JavaScript Unicode property escapes; counts are letter code points, not words.',
  ].join('\n');
}

export function analyzeText(source) {
  const counts = new Map(scripts.map(({ id }) => [id, 0]));
  let asciiLetters = 0;
  let unicodeLetters = 0;
  let otherLetters = 0;

  for (const character of String(source ?? '')) {
    if (!/\p{L}/u.test(character)) continue;

    unicodeLetters += 1;
    if (/[A-Za-z]/.test(character)) asciiLetters += 1;

    const script = scripts.find(({ pattern }) => pattern.test(character));
    if (script) counts.set(script.id, counts.get(script.id) + 1);
    else otherLetters += 1;
  }

  return {
    asciiLetters,
    unicodeLetters,
    outsideAsciiLetters: unicodeLetters - asciiLetters,
    asciiCoverage: unicodeLetters === 0 ? null : asciiLetters / unicodeLetters,
    scripts: [
      ...scripts
        .map(({ id, label }) => ({ id, label, letters: counts.get(id) }))
        .filter(({ letters }) => letters > 0),
      ...(otherLetters > 0
        ? [{ id: 'other', label: 'Other scripts', letters: otherLetters }]
        : []),
    ],
  };
}
