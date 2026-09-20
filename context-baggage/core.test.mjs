import test from 'node:test';
import assert from 'node:assert/strict';

const core = await import('./core.mjs').catch(() => ({}));
const analyzeFiles = core.analyzeFiles ?? (() => {
  throw new Error('analyzeFiles is not implemented');
});
const encoder = new TextEncoder();

function file(id, text, name = `${id}.md`) {
  return { id, name, data: encoder.encode(text) };
}

function thresholdPassage() {
  return ['planet', ...Array(39).fill('apple')].join(' ');
}

test('counts raw UTF-8 bytes, words, BOM, and mixed line endings exactly', () => {
  const result = analyzeFiles([file('mixed', '﻿café\r\n猫 dog\n')]);

  assert.deepEqual(result.files[0], {
    id: 'mixed',
    name: 'mixed.md',
    byteCount: 18,
    lineCount: 2,
    wordCount: 3,
    byteShare: { numerator: 18, denominator: 18 },
  });
});

test('sorts by byte weight with stable ties and exact shares', () => {
  const result = analyzeFiles([
    file('a', 'aaa'),
    file('b', 'bb'),
    file('c', 'cc'),
  ]);

  assert.equal(result.totalByteCount, 7);
  assert.deepEqual(result.files.map(({ id, byteShare }) => ({ id, byteShare })), [
    { id: 'a', byteShare: { numerator: 3, denominator: 7 } },
    { id: 'b', byteShare: { numerator: 2, denominator: 7 } },
    { id: 'c', byteShare: { numerator: 2, denominator: 7 } },
  ]);
});

test('includes a duplicate block at both exact thresholds', () => {
  const passage = thresholdPassage();
  const result = analyzeFiles([file('a', passage), file('b', passage)]);

  assert.equal(encoder.encode(passage).byteLength, 240);
  assert.deepEqual(result.duplicates, [{
    id: 'D1',
    wordCount: 40,
    normalizedByteCount: 240,
    occurrences: [
      { fileId: 'a', startLine: 1, endLine: 1 },
      { fileId: 'b', startLine: 1, endLine: 1 },
    ],
  }]);
});

test('normalizes whitespace and groups occurrences across several files', () => {
  const words = Array.from({ length: 40 }, (_, index) => `word${String(index).padStart(2, '0')}`);
  const withSpaces = words.join(' ');
  const withTabs = words.join('\t');
  const overFourLines = Array.from({ length: 4 }, (_, index) => words.slice(index * 10, index * 10 + 10).join(' ')).join('\n');
  const result = analyzeFiles([
    file('spaces', withSpaces),
    file('tabs', withTabs),
    file('lines', overFourLines),
  ]);

  assert.deepEqual(result.duplicates, [{
    id: 'D1',
    wordCount: 40,
    normalizedByteCount: 279,
    occurrences: [
      { fileId: 'spaces', startLine: 1, endLine: 1 },
      { fileId: 'tabs', startLine: 1, endLine: 1 },
      { fileId: 'lines', startLine: 1, endLine: 4 },
    ],
  }]);
});

test('keeps case and punctuation significant when matching blocks', () => {
  const passage = Array.from({ length: 40 }, (_, index) => `word${String(index).padStart(2, '0')}`).join(' ');
  const changedCase = passage.replace('word17', 'Word17');
  const changedPunctuation = passage.replace('word17', 'word17,');

  assert.deepEqual(analyzeFiles([file('a', passage), file('b', changedCase)]).duplicates, []);
  assert.deepEqual(analyzeFiles([file('a', passage), file('b', changedPunctuation)]).duplicates, []);
});

test('enforces word and normalized-byte thresholds independently', () => {
  const tooFewWords = Array(39).fill('planet').join(' ');
  const tooFewBytes = Array(40).fill('abcd').join(' ');

  assert.ok(encoder.encode(tooFewWords).byteLength >= 240);
  assert.ok(tooFewBytes.split(/\s+/u).length >= 40);
  assert.deepEqual(analyzeFiles([file('a', tooFewWords), file('b', tooFewWords)]).duplicates, []);
  assert.deepEqual(analyzeFiles([file('a', tooFewBytes), file('b', tooFewBytes)]).duplicates, []);
});

test('matches whole blank-line-delimited blocks only', () => {
  const passage = thresholdPassage();

  assert.deepEqual(analyzeFiles([
    file('a', passage),
    file('b', `prefix ${passage}`),
  ]).duplicates, []);

  assert.equal(analyzeFiles([
    file('a', passage),
    file('b', `prefix\n\n${passage}`),
  ]).duplicates.length, 1);
});

test('does not report repetition confined to one file', () => {
  const passage = thresholdPassage();
  const result = analyzeFiles([file('a', `${passage}\n\n${passage}`)]);

  assert.deepEqual(result.duplicates, []);
});

test('rejects invalid UTF-8 without returning a partial summary', () => {
  assert.throws(() => analyzeFiles([
    file('valid', 'plain text'),
    { id: 'bad', name: 'secret-name.md', data: Uint8Array.from([0x61, 0xC3, 0x28]) },
  ]), {
    message: 'File bad is not valid UTF-8.',
  });
});

test('reports zero metrics and exact zero shares for empty files', () => {
  const result = analyzeFiles([file('a', ''), file('b', '')]);

  assert.equal(result.totalByteCount, 0);
  assert.deepEqual(result.files, [
    {
      id: 'a',
      name: 'a.md',
      byteCount: 0,
      lineCount: 0,
      wordCount: 0,
      byteShare: { numerator: 0, denominator: 0 },
    },
    {
      id: 'b',
      name: 'b.md',
      byteCount: 0,
      lineCount: 0,
      wordCount: 0,
      byteShare: { numerator: 0, denominator: 0 },
    },
  ]);
  assert.deepEqual(result.duplicates, []);
});

test('analyzes dense text without allocating match or split result arrays', () => {
  const originalMatch = String.prototype.match;
  const originalSplit = String.prototype.split;
  String.prototype.match = () => {
    throw new Error('String.match must not be used during analysis.');
  };
  String.prototype.split = () => {
    throw new Error('String.split must not be used during analysis.');
  };

  try {
    const passage = `${thresholdPassage()}\n`.repeat(2_000);
    const result = analyzeFiles([file('dense', passage)]);

    assert.equal(result.files[0].lineCount, 2_000);
    assert.equal(result.files[0].wordCount, 80_000);
  } finally {
    String.prototype.match = originalMatch;
    String.prototype.split = originalSplit;
  }
});

test('requires unique IDs and byte arrays, and never returns source text', () => {
  const sentinel = `private-sentinel ${thresholdPassage()}`;
  const result = analyzeFiles([file('a', sentinel), file('b', sentinel)]);

  assert.doesNotMatch(JSON.stringify(result), /private-sentinel/);
  assert.throws(() => analyzeFiles([file('same', 'a'), file('same', 'b')]), {
    message: 'Each file must have a unique id.',
  });
  assert.throws(() => analyzeFiles([{ id: 'a', name: 'a.md', data: 'not bytes' }]), {
    message: 'File a must provide Uint8Array data.',
  });
});
