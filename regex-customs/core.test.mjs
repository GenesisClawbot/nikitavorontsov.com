import assert from 'node:assert/strict';
import test from 'node:test';

const core = await import('./core.mjs').catch(() => ({}));

test('counts the A-Z letters that a multilingual string contains', () => {
  assert.equal(typeof core.analyzeText, 'function');

  assert.deepEqual(core.analyzeText('ABC 한글 猫'), {
    asciiLetters: 3,
    unicodeLetters: 6,
    outsideAsciiLetters: 3,
    asciiCoverage: 0.5,
    scripts: [
      { id: 'latin', label: 'Latin', letters: 3 },
      { id: 'hangul', label: 'Hangul', letters: 2 },
      { id: 'han', label: 'Han', letters: 1 },
    ],
  });
});

test('counts non-ASCII Latin and astral letters as Unicode letter code points', () => {
  const result = core.analyzeText('café é 𐐀');

  assert.equal(result.asciiLetters, 4);
  assert.equal(result.unicodeLetters, 6);
  assert.equal(result.outsideAsciiLetters, 2);
  assert.equal(result.asciiCoverage, 4 / 6);
  assert.deepEqual(result.scripts, [
    { id: 'latin', label: 'Latin', letters: 5 },
    { id: 'other', label: 'Other scripts', letters: 1 },
  ]);
});

test('formats a declaration from counts without repeating the source text', () => {
  assert.equal(typeof core.formatDeclaration, 'function');

  const declaration = core.formatDeclaration(core.analyzeText('ABC 한글 猫'));

  assert.equal(
    declaration,
    'REGEX CUSTOMS DECLARATION\n' +
      '[A-Za-z]: 3 admitted\n' +
      '\\p{L}: 6 letter code points\n' +
      'Outside A-Z: 3\n' +
      'A-Z coverage: 50.0%\n' +
      'Scripts: Latin 3; Hangul 2; Han 1\n' +
      'Method: JavaScript Unicode property escapes; counts are letter code points, not words.',
  );
  assert.equal(declaration.includes('ABC 한글 猫'), false);
});
