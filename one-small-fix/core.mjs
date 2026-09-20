function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function stripInjectedBlocks(text) {
  const tagPattern = /<\/?system-reminder>/g;
  const visible = [];
  let depth = 0;
  let start = 0;
  let match;

  while ((match = tagPattern.exec(text))) {
    const closing = match[0][1] === '/';
    if (!closing) {
      if (depth === 0) visible.push(text.slice(start, match.index));
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) start = tagPattern.lastIndex;
    }
  }

  if (depth === 0) visible.push(text.slice(start));
  return visible.join('');
}

function removeInjectedBlocks(text) {
  return stripInjectedBlocks(text).trim();
}

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;
const TEST_COMMAND = /^(?:node\s+--test|npm\s+(?:run\s+)?test(?::[A-Za-z0-9_.-]+)?|pnpm\s+(?:run\s+)?test(?::[A-Za-z0-9_.-]+)?|yarn\s+(?:run\s+)?test(?::[A-Za-z0-9_.-]+)?|bun\s+test(?::[A-Za-z0-9_.-]+)?|(?:npx\s+)?(?:vitest|jest)|(?:npx\s+)?playwright\s+test|pytest|python3?\s+-m\s+pytest|cargo\s+test|go\s+test)(?:\s|$)/i;

function runsTests(command) {
  return command
    .split(/&&|\|\||;|\n/)
    .some((segment) => TEST_COMMAND.test(segment.trim()));
}

function relativePath(path, cwd) {
  const normalizedPath = path.replaceAll('\\', '/');
  const normalizedCwd = cwd?.replaceAll('\\', '/');
  if (normalizedCwd && normalizedPath.startsWith(`${normalizedCwd}/`)) {
    return `./${normalizedPath.slice(normalizedCwd.length + 1)}`;
  }
  return normalizedPath.replace(/(?:[A-Za-z]:)?\/Users\/[^/\s]+|\/home\/[^/\s]+|\/root(?=\/|\b)/g, '~');
}

function redactPrivateText(value) {
  return String(value ?? '')
    .replace(SECRET_VALUE, '[secret redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '~')
    .replace(/\/(?:Users|home)\/[^/\s]+|\/root(?=\/|\b)/g, '~')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function excerpt(value, limit = 600) {
  const safe = redactPrivateText(value);
  if (safe.length <= limit) return safe;
  return `${safe.slice(0, limit)}\n[${safe.length - limit} more characters omitted]`;
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'not recorded';
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function listOrFallback(values, fallback) {
  if (!values.length) return fallback;
  return values.map(redactPrivateText).join('\n');
}

function quoteMarkdown(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .split('\n')
    .map((line) => line ? `> ${line}` : '>')
    .join('\n');
}

export function buildConversationMarkdown(source) {
  const turns = [];
  let malformedLines = 0;

  for (const line of source.split('\n')) {
    if (!line.trim()) continue;

    let row;
    try {
      row = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    const role = row?.message?.role;
    if (row?.type !== role || (role !== 'user' && role !== 'assistant')) continue;

    const rawText = textFromContent(row.message.content);
    const visibleText = stripInjectedBlocks(rawText)
      .replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, '');
    if (!visibleText.trim()) continue;

    turns.push({
      speaker: role === 'user' ? 'You' : 'Claude',
      text: redactPrivateText(visibleText),
    });
  }

  const count = turns.length;
  return [
    '# Conversation lifeboat',
    '',
    '> Rescued from visible text in a local Claude Code transcript. Review before sharing.',
    ...(malformedLines ? [
      '>',
      `> Warning: ${malformedLines} malformed transcript ${malformedLines === 1 ? 'line was' : 'lines were'} skipped. Visible messages may be missing.`,
    ] : []),
    '',
    ...turns.flatMap((turn) => [
      `## ${turn.speaker}`,
      '',
      quoteMarkdown(turn.text),
      '',
    ]),
    '---',
    '',
    `${count} visible ${count === 1 ? 'message' : 'messages'} rescued. Tool calls and tool results were not included.`,
    'This file cannot recover text that is absent from the local transcript.',
  ].join('\n');
}

export function formatReceipt(summary) {
  const files = summary.filesWritten ?? [];
  const tests = summary.testCommands ?? [];
  return [
    'ONE SMALL FIX',
    'CLAUDE CODE SCOPE RECEIPT',
    '',
    'REQUEST EXCERPT',
    excerpt(summary.request),
    '',
    'OBSERVED',
    `Elapsed: ${formatDuration(summary.elapsedMs)}`,
    `Tool calls: ${summary.toolCalls}`,
    ...(summary.malformedLines ? [
      '',
      'WARNING',
      `${summary.malformedLines} malformed transcript ${summary.malformedLines === 1 ? 'line was' : 'lines were'} skipped. Activity may be missing.`,
    ] : []),
    '',
    `DIRECT WRITE CALLS (${files.length})`,
    listOrFallback(files, 'None observed through direct write calls.'),
    '',
    `TEST COMMANDS (${tests.length})`,
    listOrFallback(tests, 'None observed.'),
    '',
    'FINAL REPLY EXCERPT',
    excerpt(summary.finalReply || 'No final text found.'),
    '',
    'Observed from the transcript. Shell commands may have changed other files.',
  ].join('\n');
}

export function parseTranscript(source) {
  const rows = [];
  let malformedLines = 0;
  for (const line of source.split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      malformedLines += 1;
    }
  }

  let request = '';
  let cwd = null;
  let startedAt = null;
  let finishedAt = null;
  let finalReply = '';
  let toolCalls = 0;
  const filesWritten = new Set();
  const testCommands = new Set();

  for (const row of rows) {
    const content = row?.message?.content;
    const humanText = row?.type === 'user' && row?.message?.role === 'user'
      ? removeInjectedBlocks(textFromContent(content))
      : '';
    if (!request && humanText) {
      request = humanText;
      cwd = row.cwd ?? null;
      startedAt = Date.parse(row.timestamp);
    } else if (humanText) {
      break;
    }

    if (row?.type !== 'assistant' || row?.message?.role !== 'assistant') continue;
    const replyText = textFromContent(content).trim();
    if (replyText) {
      finalReply = replyText;
      finishedAt = Date.parse(row.timestamp);
    }

    const blocks = Array.isArray(content) ? content : [];
    for (const block of blocks) {
      if (block?.type !== 'tool_use') continue;
      toolCalls += 1;
      if (WRITE_TOOLS.has(block.name)) {
        const path = block.input?.file_path ?? block.input?.notebook_path;
        if (typeof path === 'string' && path) filesWritten.add(relativePath(path, cwd));
      }
      if (block.name === 'Bash' && typeof block.input?.command === 'string' && runsTests(block.input.command)) {
        testCommands.add(block.input.command.trim());
      }
    }
  }

  if (!request) throw new Error('No human request found. Choose a Claude Code JSONL transcript.');
  return {
    request,
    elapsedMs: Number.isFinite(startedAt) && Number.isFinite(finishedAt)
      ? Math.max(0, finishedAt - startedAt)
      : null,
    toolCalls,
    malformedLines,
    filesWritten: [...filesWritten],
    testCommands: [...testCommands],
    finalReply,
  };
}
