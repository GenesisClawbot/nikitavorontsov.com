import test from 'node:test';
import assert from 'node:assert/strict';

const selection = await import('./selection.mjs').catch(() => ({}));
const createSelectionBelt = selection.createSelectionBelt ?? (() => {
  throw new Error('createSelectionBelt is not implemented');
});

function localFile(name, size, lastModified, type = '') {
  return { name, size, lastModified, type, webkitRelativePath: '' };
}

test('keeps separate selections even when browser metadata matches', () => {
  const belt = createSelectionBelt(1_000);
  const first = localFile('CLAUDE.md', 300, 100);
  const matchingMetadata = localFile('CLAUDE.md', 300, 100);
  const distinctMetadata = localFile('CLAUDE.md', 300, 101);

  assert.deepEqual(belt.add([first]), { added: 1, rejected: [] });
  assert.deepEqual(belt.add([matchingMetadata]), { added: 1, rejected: [] });
  assert.deepEqual(belt.add([distinctMetadata]), { added: 1, rejected: [] });
  assert.equal(belt.entries.length, 3);
});

test('freezes a stable snapshot while files are being weighed', () => {
  const belt = createSelectionBelt(1_000);
  const first = localFile('a.md', 200, 1);
  const second = localFile('b.md', 200, 2);
  belt.add([first, second]);

  const snapshot = belt.lock();
  assert.deepEqual(snapshot.map(({ file }) => file), [first, second]);
  assert.equal(belt.remove(snapshot[0].id), false);
  assert.equal(belt.clear(), false);
  assert.deepEqual(belt.add([localFile('c.md', 200, 3)]), {
    added: 0,
    rejected: [],
  });
  assert.deepEqual(belt.entries.map(({ file }) => file), [first, second]);

  belt.unlock();
  assert.equal(belt.remove(snapshot[0].id), true);
  assert.equal(belt.entries.length, 1);
});

test('enforces a file-count limit independently of the byte limit', () => {
  const belt = createSelectionBelt(1_000, 2);
  const first = localFile('a.md', 1, 1);
  const second = localFile('b.md', 1, 2);
  const third = localFile('c.md', 1, 3);

  assert.deepEqual(belt.add([first, second, third]), {
    added: 2,
    rejected: [{ file: third, reason: 'file-limit' }],
  });
  assert.deepEqual(belt.entries.map(({ file }) => file), [first, second]);
});

test('enforces accepted file types and the cumulative byte limit', () => {
  const belt = createSelectionBelt(500);
  const markdown = localFile('rules.md', 300, 1);
  const text = localFile('notes', 100, 2, 'text/plain');
  const tooLarge = localFile('more.txt', 101, 3);
  const binary = localFile('archive.zip', 10, 4, 'application/zip');

  assert.deepEqual(belt.add([markdown, text, tooLarge, binary]), {
    added: 2,
    rejected: [
      { file: tooLarge, reason: 'limit' },
      { file: binary, reason: 'type' },
    ],
  });
  assert.equal(belt.entries.reduce((sum, entry) => sum + entry.file.size, 0), 400);
});
