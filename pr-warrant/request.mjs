import { createWarrant } from './core.mjs?v=pr-warrant-20260825-02';

const REQUEST_TIMEOUT_MS = 15000;

export async function fetchWarrant(
  reference,
  signal,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const requestController = new AbortController();
  let timedOut = false;
  const forwardAbort = () => requestController.abort(signal?.reason);

  if (signal?.aborted) {
    forwardAbort();
  } else {
    signal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(reference.apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: requestController.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('GitHub could not find that public pull request. Check the URL and visibility.');
      }
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('The anonymous GitHub API limit is exhausted. Wait for it to reset, then try again.');
      }
      throw new Error(`GitHub returned ${response.status}. Try again in a moment.`);
    }

    return createWarrant(reference, await response.json());
  } catch (error) {
    if (timedOut) {
      throw new Error('The GitHub request took too long. Try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
