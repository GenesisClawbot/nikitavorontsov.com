import test from 'node:test';
import assert from 'node:assert/strict';

const request = await import('./request.mjs').catch(() => ({}));

const reference = {
  owner: 'cli',
  repo: 'cli',
  number: '123',
  slug: 'cli/cli',
  canonicalUrl: 'https://github.com/cli/cli/pull/123',
  apiUrl: 'https://api.github.com/repos/cli/cli/pulls/123',
};

const payload = {
  number: 123,
  title: 'Tweak flags language',
  state: 'closed',
  merged: true,
  commits: 4,
  changed_files: 3,
  additions: 14,
  deletions: 15,
  base: {
    ref: 'master',
    sha: '187efe78f3218a455869d18f74d54423fa530daa',
    repo: { full_name: 'cli/cli' },
  },
  head: {
    ref: 'flags-language',
    sha: '29c93182cf3b9568152d2e5bc1eeb223aab0512c',
  },
};

test('fetches only the parsed API target and returns a validated warrant', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const fetchImpl = async (...args) => {
    calls.push(args);
    return { ok: true, status: 200, headers: new Headers(), json: async () => payload };
  };

  const warrant = await request.fetchWarrant?.(reference, signal, fetchImpl);

  assert.equal(warrant.repo, 'cli/cli');
  assert.equal(warrant.headSha, payload.head.sha);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], reference.apiUrl);
  assert.ok(calls[0][1].signal instanceof AbortSignal);
  assert.equal(calls[0][1].signal.aborted, false);
  assert.equal(calls[0][1].headers.Accept, 'application/vnd.github+json');
});

test('stops a stalled GitHub request after a bounded wait', async () => {
  const caller = new AbortController();
  const stalledFetch = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const missingTimeout = new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('request remained pending')), 50);
  });

  await assert.rejects(
    Promise.race([
      request.fetchWarrant?.(reference, caller.signal, stalledFetch, 5),
      missingTimeout,
    ]),
    /GitHub request took too long/i,
  );
});

test('explains missing public PRs and anonymous API rate limits', async () => {
  const responseFor = (status, remaining = '42') => ({
    ok: false,
    status,
    headers: new Headers({ 'x-ratelimit-remaining': remaining }),
  });

  await assert.rejects(
    request.fetchWarrant?.(reference, new AbortController().signal, async () => responseFor(404)),
    /could not find that public pull request/i,
  );
  await assert.rejects(
    request.fetchWarrant?.(reference, new AbortController().signal, async () => responseFor(403, '0')),
    /anonymous GitHub API limit/i,
  );
  await assert.rejects(
    request.fetchWarrant?.(reference, new AbortController().signal, async () => responseFor(503)),
    /GitHub returned 503/i,
  );
});
