import test from 'node:test';
import assert from 'node:assert/strict';

const row = (value) => JSON.stringify(value);

const basicTranscript = [
  row({
    type: 'user',
    timestamp: '2026-08-24T10:00:00.000Z',
    cwd: '/Users/alex/project',
    message: { role: 'user', content: 'Fix the clipping bug. Nothing else.' },
  }),
  row({
    type: 'assistant',
    timestamp: '2026-08-24T10:01:00.000Z',
    message: { role: 'assistant', content: [{ type: 'text', text: 'Fixed the clipping bug.' }] },
  }),
].join('\n');

test('extracts the first human request from a Claude Code transcript', async () => {
  const module = await import('./core.mjs').catch(() => ({}));
  assert.equal(typeof module.parseTranscript, 'function');

  const result = module.parseTranscript(basicTranscript);

  assert.equal(result.request, 'Fix the clipping bug. Nothing else.');
});

test('stops the receipt when the next human request begins', async () => {
  const { parseTranscript } = await import('./core.mjs');
  const transcript = [
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:00.000Z',
      cwd: '/Users/alex/project',
      message: { role: 'user', content: 'Fix A.' },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:00:20.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: '1', name: 'Write', input: { file_path: '/Users/alex/project/A' } }],
      },
    }),
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:30.000Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'ok' }] },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:01:00.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'A done.' }] },
    }),
    row({
      type: 'user',
      timestamp: '2026-08-24T10:02:00.000Z',
      message: { role: 'user', content: 'Rewrite B.' },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:03:00.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '2', name: 'Write', input: { file_path: '/Users/alex/project/B' } },
          { type: 'text', text: 'B done.' },
        ],
      },
    }),
  ].join('\n');

  assert.deepEqual(parseTranscript(transcript), {
    request: 'Fix A.',
    elapsedMs: 60_000,
    toolCalls: 1,
    malformedLines: 0,
    filesWritten: ['./A'],
    testCommands: [],
    finalReply: 'A done.',
  });
});

test('removes injected reminders before reading the first request', async () => {
  const { parseTranscript } = await import('./core.mjs');
  const transcript = [
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:00.000Z',
      message: {
        role: 'user',
        content: '<system-reminder>Tool state changed.</system-reminder>\nFix the clipping bug.',
      },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:01:00.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
    }),
  ].join('\n');

  assert.equal(parseTranscript(transcript).request, 'Fix the clipping bug.');
});

test('reports the transcript activity that was directly observed', async () => {
  const { parseTranscript } = await import('./core.mjs');
  const transcript = [
    'not json',
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:00.000Z',
      cwd: '/Users/alex/project',
      message: { role: 'user', content: 'Fix the clipping bug.' },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:00:20.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '1', name: 'Read', input: { file_path: '/Users/alex/project/src/a.js' } },
          { type: 'tool_use', id: '2', name: 'Write', input: { file_path: '/Users/alex/project/src/a.js' } },
        ],
      },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:01:00.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '3', name: 'Write', input: { file_path: '/Users/alex/project/src/a.js' } },
          { type: 'tool_use', id: '4', name: 'Bash', input: { command: 'node --test src/a.test.js' } },
          { type: 'tool_use', id: '5', name: 'NotebookEdit', input: { notebook_path: '/Users/alex/notes.ipynb' } },
        ],
      },
    }),
    row({
      type: 'user',
      timestamp: '2026-08-24T10:01:05.000Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: '4', content: 'pass' }] },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:02:05.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Fixed the clipping bug.' }] },
    }),
  ].join('\n');

  assert.deepEqual(parseTranscript(transcript), {
    request: 'Fix the clipping bug.',
    elapsedMs: 125_000,
    toolCalls: 5,
    malformedLines: 1,
    filesWritten: ['./src/a.js', '~/notes.ipynb'],
    testCommands: ['node --test src/a.test.js'],
    finalReply: 'Fixed the clipping bug.',
  });
});

test('reports malformed non-empty lines as possible omissions', async () => {
  const { formatReceipt, parseTranscript } = await import('./core.mjs');
  const summary = parseTranscript(`\nnot json\n${basicTranscript}\n`);

  assert.equal(summary.malformedLines, 1);
  assert.match(formatReceipt(summary), /WARNING\n1 malformed transcript line was skipped\. Activity may be missing\./);
});

test('recognizes named test scripts without treating installs as tests', async () => {
  const { parseTranscript } = await import('./core.mjs');
  const transcript = [
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:00.000Z',
      message: { role: 'user', content: 'Fix it.' },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:01:00.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '1', name: 'Bash', input: { command: 'npm install vitest' } },
          { type: 'tool_use', id: '2', name: 'Bash', input: { command: 'cd app && npm run test:unit -- --watch=false' } },
        ],
      },
    }),
  ].join('\n');

  assert.deepEqual(parseTranscript(transcript).testCommands, ['cd app && npm run test:unit -- --watch=false']);
});

test('formats a private, factual receipt for review', async () => {
  const { formatReceipt } = await import('./core.mjs');
  assert.equal(typeof formatReceipt, 'function');

  const receipt = formatReceipt({
    request: 'Fix /Users/alex/project/a.js with sk-ant-api03-abcdefghijklmnopqrstuvwxyz.',
    elapsedMs: 125_000,
    toolCalls: 4,
    filesWritten: ['./a.js', '/Users/alex/notes.txt'],
    testCommands: ['node --test a.test.js'],
    finalReply: 'Done. Email alex@example.com.',
  });

  assert.match(receipt, /REQUEST EXCERPT\nFix ~\/project\/a\.js with \[secret redacted\]\./);
  assert.match(receipt, /Elapsed: 2m 5s/);
  assert.match(receipt, /Tool calls: 4/);
  assert.match(receipt, /DIRECT WRITE CALLS \(2\)\n\.\/a\.js\n~\/notes\.txt/);
  assert.match(receipt, /TEST COMMANDS \(1\)\nnode --test a\.test\.js/);
  assert.match(receipt, /FINAL REPLY EXCERPT\nDone\. Email \[email redacted\]\./);
  assert.match(receipt, /Shell commands may have changed other files\./);
  assert.doesNotMatch(receipt, /alex|sk-ant/);
});

test('masks common modern secrets and home-folder names', async () => {
  const { formatReceipt } = await import('./core.mjs');
  const receipt = formatReceipt({
    request: 'Use github_pat_11AA0abcdefghijklmnopqrstuvwxyz0123456789 and AKIAIOSFODNN7EXAMPLE in C:\\Users\\Alice\\project.',
    elapsedMs: 1_000,
    toolCalls: 0,
    filesWritten: ['C:\\Users\\Alice\\notes.txt', '/root/.ssh/config'],
    testCommands: [],
    finalReply: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlMTIzNDU2',
  });

  assert.doesNotMatch(receipt, /github_pat_|AKIAIOSFODNN7EXAMPLE|eyJhbGci|Alice|C:\\Users|\/root/);
  assert.match(receipt, /\[secret redacted\]/);
  assert.match(receipt, /~\\notes\.txt/);
  assert.match(receipt, /~\/\.ssh\/config/);
});

test('normalizes Windows project paths before showing write targets', async () => {
  const { parseTranscript } = await import('./core.mjs');
  const transcript = [
    row({
      type: 'user',
      timestamp: '2026-08-24T10:00:00.000Z',
      cwd: 'C:\\Users\\Alice\\project',
      message: { role: 'user', content: 'Fix it.' },
    }),
    row({
      type: 'assistant',
      timestamp: '2026-08-24T10:01:00.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '1', name: 'Write', input: { file_path: 'C:\\Users\\Alice\\project\\src\\a.js' } },
          { type: 'tool_use', id: '2', name: 'NotebookEdit', input: { notebook_path: 'C:\\Users\\Alice\\notes.ipynb' } },
        ],
      },
    }),
  ].join('\n');

  assert.deepEqual(parseTranscript(transcript).filesWritten, ['./src/a.js', '~/notes.ipynb']);
});

test('caps long request and final reply excerpts without hiding the omission', async () => {
  const { formatReceipt } = await import('./core.mjs');
  const receipt = formatReceipt({
    request: 'R'.repeat(700),
    elapsedMs: 1_000,
    toolCalls: 0,
    filesWritten: [],
    testCommands: [],
    finalReply: 'F'.repeat(650),
  });

  assert.match(receipt, new RegExp(`REQUEST EXCERPT\\n${'R'.repeat(600)}\\n\\[100 more characters omitted\\]`));
  assert.match(receipt, new RegExp(`FINAL REPLY EXCERPT\\n${'F'.repeat(600)}\\n\\[50 more characters omitted\\]`));
  assert.doesNotMatch(receipt, /R{601}|F{601}/);
});

test('builds a Markdown lifeboat from every visible conversation turn', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  assert.equal(typeof buildConversationMarkdown, 'function');

  const transcript = [
    row({
      type: 'user',
      message: {
        role: 'user',
        content: '<system-reminder>Tool state changed.</system-reminder>\nFix the clipping bug.',
      },
    }),
    row({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will inspect it.' },
          { type: 'tool_use', id: '1', name: 'Read', input: { file_path: '/project/app.js' } },
        ],
      },
    }),
    row({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'source' }] },
    }),
    row({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'The clipping bug is fixed.' }] },
    }),
    row({
      type: 'user',
      message: { role: 'user', content: 'Now explain the change.' },
    }),
  ].join('\n');

  assert.equal(buildConversationMarkdown(transcript), [
    '# Conversation lifeboat',
    '',
    '> Rescued from visible text in a local Claude Code transcript. Review before sharing.',
    '',
    '## You',
    '',
    '> Fix the clipping bug.',
    '',
    '## Claude',
    '',
    '> I will inspect it.',
    '',
    '## Claude',
    '',
    '> The clipping bug is fixed.',
    '',
    '## You',
    '',
    '> Now explain the change.',
    '',
    '---',
    '',
    '4 visible messages rescued. Tool calls and tool results were not included.',
    'This file cannot recover text that is absent from the local transcript.',
  ].join('\n'));
});

test('removes injected reminders from rescued assistant turns', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  const transcript = row({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: '<system-reminder>Internal state.</system-reminder>\nKeep this reply.',
    },
  });

  assert.match(buildConversationMarkdown(transcript), /## Claude\n\n> Keep this reply\./);
  assert.doesNotMatch(buildConversationMarkdown(transcript), /system-reminder|Internal state/);
});

test('removes nested injected reminder blocks completely', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  const transcript = row({
    type: 'user',
    message: {
      role: 'user',
      content: '<system-reminder>Outer secret.<system-reminder>Inner secret.</system-reminder>Outer tail.</system-reminder>Keep this request.',
    },
  });

  const markdown = buildConversationMarkdown(transcript);
  assert.match(markdown, /## You\n\n> Keep this request\./);
  assert.doesNotMatch(markdown, /system-reminder|secret|Outer tail/);
});

test('preserves indentation and delimits transcript-authored Markdown', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  const transcript = row({
    type: 'user',
    message: {
      role: 'user',
      content: '    const answer = 42;\n## Claude\n<script>alert("not markup")</script>',
    },
  });

  const markdown = buildConversationMarkdown(transcript);
  assert.match(markdown, /## You\n\n>     const answer = 42;\n> ## Claude\n> &lt;script&gt;alert\("not markup"\)&lt;\/script&gt;/);
  assert.doesNotMatch(markdown, /\n## Claude\n<script>/);
});

test('masks private values without truncating rescued messages', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  const longReply = `Read /Users/taylor/project. Email taylor@example.com. Token sk-ant-api03-abcdefghijklmnopqrstuvwxyz. ${'x'.repeat(700)}`;
  const transcript = row({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: longReply }] },
  });

  const markdown = buildConversationMarkdown(transcript);

  assert.match(markdown, /Read ~\/project\. Email \[email redacted\]\. Token \[secret redacted\]\./);
  assert.match(markdown, /x{700}/);
  assert.doesNotMatch(markdown, /taylor|sk-ant-api03/);
});

test('discloses malformed transcript lines in the lifeboat', async () => {
  const { buildConversationMarkdown } = await import('./core.mjs');
  const markdown = buildConversationMarkdown([
    'not json',
    row({ type: 'user', message: { role: 'user', content: 'Keep this message.' } }),
  ].join('\n'));

  assert.match(markdown, /Warning: 1 malformed transcript line was skipped\. Visible messages may be missing\./);
});
