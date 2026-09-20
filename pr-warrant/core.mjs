const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isDisplayRef(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && Array.from(value).every((char) => char >= ' ' && char !== String.fromCharCode(127));
}

function invalidResponse() {
  throw new Error('The GitHub response did not match the requested pull request.');
}

export function createWarrant(reference, payload) {
  const matchesRequest = payload
    && typeof payload === 'object'
    && String(payload.number) === reference.number
    && typeof payload.base?.repo?.full_name === 'string'
    && payload.base.repo.full_name.toLowerCase() === reference.slug.toLowerCase()
    && typeof payload.title === 'string'
    && payload.title.length <= 1024
    && ['open', 'closed'].includes(payload.state)
    && typeof payload.merged === 'boolean'
    && isDisplayRef(payload.base?.ref)
    && isDisplayRef(payload.head?.ref)
    && COMMIT_PATTERN.test(payload.base?.sha ?? '')
    && COMMIT_PATTERN.test(payload.head?.sha ?? '')
    && [payload.commits, payload.changed_files, payload.additions, payload.deletions].every(isCount);

  if (!matchesRequest) {
    invalidResponse();
  }

  return {
    repo: reference.slug,
    number: reference.number,
    canonicalUrl: reference.canonicalUrl,
    title: payload.title,
    status: payload.merged ? 'Merged' : payload.state === 'open' ? 'Open' : 'Closed',
    baseRef: payload.base.ref,
    baseSha: payload.base.sha,
    headRef: payload.head.ref,
    headSha: payload.head.sha,
    commits: payload.commits,
    changedFiles: payload.changed_files,
    additions: payload.additions,
    deletions: payload.deletions,
  };
}

export function buildReviewBrief(warrant) {
  return [
    'REVIEW WARRANT',
    `Repository: ${warrant.repo}`,
    `Pull request: #${warrant.number}`,
    `Pinned base: ${warrant.baseSha}`,
    `Pinned head: ${warrant.headSha}`,
    '',
    'Review only the three-dot diff between the pinned base and head.',
    'Before reviewing, run the shell check supplied with this warrant. If it exits nonzero, stop and report the mismatch.',
    'Do not substitute branch names, another PR, merged PR history, or a wider commit range.',
    '',
    'Report only verified high- or medium-severity defects that cause incorrect behavior, security or privacy harm, data loss, a crash, or a material failure of stated requirements.',
    'For each finding, give one concrete failure scenario and cite the affected file and line.',
    'Do not report style preferences, optional refactors, or speculative hardening.',
    'On follow-up, verify the cited fixes and check whether those fixes introduced a new high- or medium-severity defect inside the pinned diff.',
    'Do not reopen a resolved finding without a new reproducible failure scenario.',
    '',
    'Closed question: Does any verified high- or medium-severity defect remain in the pinned diff?',
    'End with exactly one verdict:',
    'YES: verified high- or medium-severity defects remain.',
    'NO: no verified high- or medium-severity defects remain.',
    'If YES, list only the remaining findings. If NO, stop.',
    'In your final response, state the repository and both SHAs you reviewed.',
  ].join(String.fromCharCode(10));
}

export function buildShellCheck(warrant) {
  const expectedRepo = warrant.repo.toLowerCase();
  return [
    'set -eu',
    '',
    `expected_repo='${expectedRepo}'`,
    `expected_base='${warrant.baseSha}'`,
    `expected_head='${warrant.headSha}'`,
    `pull_number='${warrant.number}'`,
    '',
    'origin_url=$(git remote get-url origin)',
    'case "$origin_url" in',
    '  https://github.com/*) actual_repo=${origin_url#https://github.com/} ;;',
    '  git@github.com:*) actual_repo=${origin_url#git@github.com:} ;;',
    '  ssh://git@github.com/*) actual_repo=${origin_url#ssh://git@github.com/} ;;',
    '  *) echo "PR WARRANT STOP: origin is not a supported GitHub remote" >&2; exit 1 ;;',
    'esac',
    'actual_repo=${actual_repo%.git}',
    `actual_repo_lower=$(printf '%s' "$actual_repo" | tr '[:upper:]' '[:lower:]')`,
    'if [ "$actual_repo_lower" != "$expected_repo" ]; then',
    '  echo "PR WARRANT STOP: origin is $actual_repo, expected $expected_repo" >&2',
    '  exit 1',
    'fi',
    '',
    'api_url="https://api.github.com/repos/$expected_repo/pulls/$pull_number"',
    'if ! command -v curl >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then',
    '  echo "PR WARRANT STOP: curl and python3 are required to verify the current PR" >&2',
    '  exit 1',
    'fi',
    'metadata=$(curl --fail --silent --show-error --max-time 15 -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$api_url")',
    "actual_base=$(printf '%s' \"$metadata\" | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"base\"][\"sha\"])')",
    "actual_api_head=$(printf '%s' \"$metadata\" | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"head\"][\"sha\"])')",
    'if [ "$actual_base" != "$expected_base" ]; then',
    '  echo "PR WARRANT STOP: PR base moved to $actual_base, expected $expected_base" >&2',
    '  exit 1',
    'fi',
    'if [ "$actual_api_head" != "$expected_head" ]; then',
    '  echo "PR WARRANT STOP: PR head moved to $actual_api_head, expected $expected_head" >&2',
    '  exit 1',
    'fi',
    '',
    'git fetch --quiet origin "refs/pull/$pull_number/head"',
    'actual_head=$(git rev-parse FETCH_HEAD)',
    'if [ "$actual_head" != "$expected_head" ]; then',
    '  echo "PR WARRANT STOP: PR head moved to $actual_head, expected $expected_head" >&2',
    '  exit 1',
    'fi',
    '',
    'if ! git cat-file -e "$expected_base^{commit}" 2>/dev/null; then',
    '  echo "PR WARRANT STOP: pinned base commit is missing locally; fetch its history and rerun" >&2',
    '  exit 1',
    'fi',
    '',
    'echo "PR WARRANT OK: $expected_repo#$pull_number $expected_base...$expected_head"',
    'git diff --name-status "$expected_base...$expected_head" --',
    'git diff "$expected_base...$expected_head" --',
  ].join(String.fromCharCode(10));
}

export function parsePullRequestUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error('Paste a full GitHub pull request URL.');
  }

  if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) {
    throw new Error('Use an https://github.com pull request URL.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const allowedTail = parts.length === 4 || (parts.length === 5 && ['files', 'commits', 'checks'].includes(parts[4]));
  const [owner, repo, kind, number] = parts;
  if (!allowedTail || kind !== 'pull' || !OWNER_PATTERN.test(owner ?? '') || !REPO_PATTERN.test(repo ?? '') || !/^[1-9]\d*$/.test(number ?? '')) {
    throw new Error('Use a GitHub URL shaped like https://github.com/owner/repo/pull/123.');
  }

  const slug = `${owner}/${repo}`;
  return {
    owner,
    repo,
    number,
    slug,
    canonicalUrl: `https://github.com/${slug}/pull/${number}`,
    apiUrl: `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
  };
}
