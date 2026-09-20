import test from 'node:test';
import assert from 'node:assert/strict';

test('flags security and privacy sentences without joining lines', async () => {
  const module = await import('./core.mjs').catch(() => ({}));
  assert.equal(typeof module.findFlaggedClaims, 'function');

  const claims = module.findFlaggedClaims([
    'The cron posted at noon.',
    'No data leaves your browser.',
    'It also added encrypted backups! The footer changed.',
  ].join('\n'));

  assert.deepEqual(claims.map(({ text, terms }) => ({ text, terms })), [
    { text: 'No data leaves your browser.', terms: ['no data leaves'] },
    { text: 'It also added encrypted backups!', terms: ['encrypt'] },
  ]);
});

test('uses word boundaries for short risk terms', async () => {
  const { findFlaggedClaims } = await import('./core.mjs');

  assert.deepEqual(findFlaggedClaims('The obscure bug became less obscure.'), []);
  assert.deepEqual(findFlaggedClaims('Auth now checks the session.').map((claim) => claim.terms), [
    ['auth'],
  ]);
});

test('keeps a claim ID stable when an unrelated sentence is inserted', async () => {
  const { findFlaggedClaims } = await import('./core.mjs');

  const before = findFlaggedClaims('The release is private.');
  const after = findFlaggedClaims('Version two shipped. The release is private.');

  assert.equal(before[0].id, after[0].id);
});

test('gives duplicate claims separate IDs', async () => {
  const { findFlaggedClaims } = await import('./core.mjs');

  const claims = findFlaggedClaims('Encrypted at rest. Encrypted at rest.');

  assert.equal(claims.length, 2);
  assert.notEqual(claims[0].id, claims[1].id);
});

test('accepts only a substantial quote copied from the supplied source', async () => {
  const { quoteAppearsInSource } = await import('./core.mjs');
  const source = 'Release notes: Session tokens are encrypted at rest before storage.';

  assert.equal(quoteAppearsInSource('encrypted', source), false);
  assert.equal(quoteAppearsInSource('Session tokens are encrypted at rest', source), true);
  assert.equal(quoteAppearsInSource('session tokens are encrypted at rest', source), false);
  assert.equal(quoteAppearsInSource('Session tokens are encrypted in transit', source), false);
});

test('rejects a source fragment that does not share the claim watched terms', async () => {
  const { canCopyDraft, findFlaggedClaims } = await import('./core.mjs');
  const draft = 'Customer records are encrypted.';
  const [claim] = findFlaggedClaims(draft);
  const source = 'Release date: 25 August 2026. Authentication now uses a shorter session.';

  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: { [claim.id]: 'Release date: 25 August 2026.' },
  }), false);
  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: { [claim.id]: 'Authentication now uses a shorter session.' },
  }), false);
});

test('requires a source quote to cover every watched term in its claim', async () => {
  const { canCopyDraft, findFlaggedClaims } = await import('./core.mjs');
  const draft = 'The worker is secure and sandboxed.';
  const [claim] = findFlaggedClaims(draft);
  const source = 'The worker runs in a sandbox. The worker is secure and sandboxed.';

  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: { [claim.id]: 'The worker runs in a sandbox.' },
  }), false);
  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: { [claim.id]: 'The worker is secure and sandboxed.' },
  }), true);
});

test('unlocks a non-empty draft only when every flagged claim has a source quote', async () => {
  const { canCopyDraft, findFlaggedClaims } = await import('./core.mjs');
  const draft = 'Now sandboxed. Private by default.';
  const source = 'The worker is now sandboxed. New projects are private by default.';
  const [sandboxed, privateClaim] = findFlaggedClaims(draft);

  assert.equal(canCopyDraft({ draft, source, evidence: {} }), false);
  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: { [sandboxed.id]: 'The worker is now sandboxed' },
  }), false);
  assert.equal(canCopyDraft({
    draft,
    source,
    evidence: {
      [sandboxed.id]: 'The worker is now sandboxed',
      [privateClaim.id]: 'New projects are private by default',
    },
  }), true);
});

test('removing the unsupported flagged sentence removes the gate', async () => {
  const { canCopyDraft } = await import('./core.mjs');

  assert.equal(canCopyDraft({
    draft: 'A smaller footer shipped.',
    source: '',
    evidence: {},
  }), true);
  assert.equal(canCopyDraft({ draft: '   ', source: '', evidence: {} }), false);
});
