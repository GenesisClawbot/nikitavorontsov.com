import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_ALPHABET,
  TICKETS,
  approve,
  buildChallenge,
  canShip,
  challengeUrl,
  createGame,
  createRandomSeed,
  formatSeed,
  machineStage,
  nextProposal,
  normalizeSeed,
  outcomeTitle,
  reject,
  shareText,
  ship,
  startGame,
} from './game.mjs';

test('normalizes valid seeds and rejects ambiguous or malformed values', () => {
  assert.equal(SEED_ALPHABET, '23456789ABCDEFGHJKLMNPQRSTUVWXYZ');
  assert.equal(normalizeSeed('abcd-efgh'), 'ABCDEFGH');
  assert.equal(normalizeSeed('23456789'), '23456789');
  assert.equal(normalizeSeed('ABCD-EFGO'), null);
  assert.equal(normalizeSeed('ABC-DEF'), null);
  assert.equal(normalizeSeed('ABCD-EFGH-J'), null);
  assert.equal(formatSeed('ABCDEFGH'), 'ABCD-EFGH');
});

test('creates an eight-character seed from injected random bytes', () => {
  const seed = createRandomSeed((bytes) => {
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7]);
    return bytes;
  });
  assert.equal(seed, '23456789');
  assert.equal(formatSeed(seed), '2345-6789');
});

test('same seed gives byte-for-byte equal ticket and proposal ids', () => {
  const first = buildChallenge('2345-6789');
  const second = buildChallenge('23456789');
  assert.deepEqual(
    { ticket: first.ticket.id, deck: first.deck.map(({ id }) => id) },
    { ticket: second.ticket.id, deck: second.deck.map(({ id }) => id) },
  );
});

test('known seeds cover all three packs and more than one order', () => {
  const seeds = ['2345-6789', 'ABCD-EFGH', 'JKLM-NPQR', 'STUV-WXYZ'];
  const challenges = seeds.map(buildChallenge);
  assert.equal(new Set(challenges.map(({ ticket }) => ticket.id)).size, 3);
  assert.ok(new Set(challenges.map(({ deck }) => deck.map(({ id }) => id).join(','))).size > 1);
});

test('every authored ticket has exactly three necessary and seven scope proposals', () => {
  assert.equal(TICKETS.length, 3);
  for (const ticket of TICKETS) {
    assert.equal(ticket.proposals.length, 10);
    assert.equal(ticket.proposals.filter(({ kind }) => kind === 'necessary').length, 3);
    assert.equal(ticket.proposals.filter(({ kind }) => kind === 'scope').length, 7);
  }
});

test('constructed decks place necessary work in all three fair ranges', () => {
  for (const seed of ['2345-6789', 'ABCD-EFGH', 'JKLM-NPQR', 'STUV-WXYZ']) {
    const kinds = buildChallenge(seed).deck.map(({ kind }) => kind);
    assert.equal(kinds.length, 10);
    assert.equal(kinds.filter((kind) => kind === 'necessary').length, 3);
    assert.equal(kinds.filter((kind) => kind === 'scope').length, 7);
    assert.equal(kinds.slice(0, 2).filter((kind) => kind === 'necessary').length, 1);
    assert.equal(kinds.slice(2, 5).filter((kind) => kind === 'necessary').length, 1);
    assert.equal(kinds.slice(5, 8).filter((kind) => kind === 'necessary').length, 1);
    assert.ok(kinds.slice(8).every((kind) => kind === 'scope'));
  }
});

function stateAt(kind) {
  const game = startGame(createGame('2345-6789'));
  const index = game.deck.findIndex((proposal) => proposal.kind === kind);
  return { ...game, turn: index + 1 };
}

test('briefing starts with the exact initial resources', () => {
  const state = createGame('2345-6789');
  assert.equal(state.phase, 'briefing');
  assert.equal(state.turn, 1);
  assert.equal(state.context, 100);
  assert.deepEqual(state.checks, []);
  assert.deepEqual(state.touchedFiles, []);
  assert.equal(state.changedLines, 0);
  assert.equal(state.scopeWeight, 0);
  assert.equal(state.acceptedScopeCount, 0);
});

test('approve applies necessary patch data once and reveals the verdict', () => {
  const state = stateAt('necessary');
  const proposal = state.deck[state.turn - 1];
  const approved = approve(state);
  assert.equal(approved.context, 100 - proposal.contextCost);
  assert.deepEqual(approved.touchedFiles, [...new Set(proposal.files)]);
  assert.equal(approved.changedLines, proposal.lines);
  assert.deepEqual(approved.checks, [proposal.checkId]);
  assert.equal(approved.scopeWeight, 0);
  assert.equal(approved.phase, 'revealed');
  assert.equal(approved.lastReveal.verdict, 'NEEDED');
  assert.strictEqual(approve(approved), approved);
});

test('approve applies scope weight, scope count, and unique files once', () => {
  const state = stateAt('scope');
  const proposal = state.deck[state.turn - 1];
  const approved = approve({ ...state, touchedFiles: [proposal.files[0]] });
  assert.equal(approved.scopeWeight, proposal.scopeWeight);
  assert.equal(approved.acceptedScopeCount, 1);
  assert.equal(approved.touchedFiles.length, new Set(proposal.files).size);
  assert.equal(approved.lastReveal.verdict, 'SCOPE CREEP');
  assert.strictEqual(approve(approved), approved);
});

test('reject charges exactly two context and applies no patch data', () => {
  const state = stateAt('necessary');
  const rejected = reject(state);
  assert.equal(rejected.context, 98);
  assert.deepEqual(rejected.touchedFiles, []);
  assert.equal(rejected.changedLines, 0);
  assert.deepEqual(rejected.checks, []);
  assert.equal(rejected.phase, 'revealed');
  assert.equal(rejected.lastReveal.verdict, 'NEEDED');
  assert.match(rejected.lastReveal.text, /This run cannot ship now\.$/);
  assert.strictEqual(reject(rejected), rejected);
});

test('ship stays blocked below three checks and ends immediately at three', () => {
  const state = stateAt('scope');
  assert.equal(canShip(state), false);
  assert.strictEqual(ship(state), state);
  const ready = { ...state, checks: ['reproduce', 'repair', 'regression'], context: 61 };
  assert.equal(canShip(ready), true);
  const shipped = ship(ready);
  assert.equal(shipped.phase, 'result');
  assert.equal(shipped.endReason, 'shipped');
});

test('context clamps at zero and ends in meltdown', () => {
  const state = stateAt('scope');
  const melted = approve({ ...state, context: 1 });
  assert.equal(melted.context, 0);
  assert.equal(melted.phase, 'result');
  assert.equal(melted.endReason, 'meltdown');
});

test('deck end distinguishes an unfixed bug from a review loop', () => {
  const base = { ...stateAt('scope'), phase: 'revealed', turn: 10 };
  const unfixed = nextProposal({ ...base, checks: ['reproduce', 'repair'] });
  assert.equal(unfixed.endReason, 'unfixed');
  assert.equal(outcomeTitle(unfixed), 'BUG STILL PRESENT');
  const loop = nextProposal({ ...base, checks: ['reproduce', 'repair', 'regression'] });
  assert.equal(loop.endReason, 'review-loop');
  assert.equal(outcomeTitle(loop), 'REVIEW LOOP');
});

test('machine stages depend only on approved scope weight', () => {
  assert.equal(machineStage(0), 0);
  assert.equal(machineStage(1), 1);
  assert.equal(machineStage(2), 1);
  assert.equal(machineStage(3), 2);
  assert.equal(machineStage(5), 2);
  assert.equal(machineStage(6), 3);
  assert.equal(machineStage(99), 3);
});

test('shipped outcome thresholds use approved scope count and include the zero-scope low-context fallback', () => {
  assert.equal(outcomeTitle({ endReason: 'shipped', scopeWeight: 0, acceptedScopeCount: 0, context: 55 }), 'SURGICAL PATCH');
  assert.equal(outcomeTitle({ endReason: 'shipped', scopeWeight: 0, acceptedScopeCount: 0, context: 54 }), 'PATCH LANDED');
  assert.equal(outcomeTitle({ endReason: 'shipped', scopeWeight: 0, acceptedScopeCount: 1, context: 70 }), 'PATCH LANDED');
  assert.equal(outcomeTitle({ endReason: 'shipped', scopeWeight: 2, acceptedScopeCount: 1, context: 70 }), 'PATCH LANDED');
  assert.equal(outcomeTitle({ endReason: 'shipped', scopeWeight: 3, acceptedScopeCount: 1, context: 70 }), 'REACTOR-ASSISTED FIX');
  assert.equal(outcomeTitle({ endReason: 'meltdown', scopeWeight: 0, acceptedScopeCount: 0, context: 0 }), 'CONTEXT MELTDOWN');
});

test('challenge URL has only the formatted seed', () => {
  assert.equal(
    challengeUrl('https://jamiecole.page/one-bug-please/?old=1#result', 'ABCDEFGH'),
    'https://jamiecole.page/one-bug-please/?seed=ABCD-EFGH',
  );
});

test('briefing share text names the ticket without invented run values', () => {
  const state = createGame('ABCDEFGH');
  assert.equal(
    shareText(state, 'https://jamiecole.page/one-bug-please/?boot=old'),
    `One Bug, Please: ${state.ticket.title}.\nBeat my run. Same bug. Same agent. Your move: https://jamiecole.page/one-bug-please/?seed=ABCD-EFGH`,
  );
  assert.doesNotMatch(shareText(state, 'https://jamiecole.page/one-bug-please/'), /\d+ files|\d+ lines|context left/);
});

test('result share text contains only computed state values and its challenge URL', () => {
  const state = {
    ...createGame('ABCDEFGH'),
    phase: 'result',
    endReason: 'shipped',
    scopeWeight: 0,
    acceptedScopeCount: 0,
    context: 61,
    touchedFiles: ['ui/a.mjs', 'tests/a.test.mjs'],
    changedLines: 49,
  };
  assert.equal(
    shareText(state, 'https://jamiecole.page/one-bug-please/?boot=old'),
    'One Bug, Please: SURGICAL PATCH.\n2 files. 49 lines. 61 context left.\nSame bug. Same agent. Your move: https://jamiecole.page/one-bug-please/?seed=ABCD-EFGH',
  );
});
