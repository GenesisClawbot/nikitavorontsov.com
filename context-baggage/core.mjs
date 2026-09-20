const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
export const DUPLICATE_LIMITS = Object.freeze({
  wordCount: 40,
  normalizedByteCount: 240,
});

const WHITESPACE = /\s/u;

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }

  let terminators = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\r') {
      terminators += 1;
      if (text[index + 1] === '\n') {
        index += 1;
      }
    } else if (text[index] === '\n') {
      terminators += 1;
    }
  }

  return terminators + (/\r$|\n$/u.test(text) ? 0 : 1);
}

function countWords(text) {
  let wordCount = 0;
  let insideWord = false;

  for (const character of text) {
    if (WHITESPACE.test(character)) {
      insideWord = false;
    } else if (!insideWord) {
      wordCount += 1;
      insideWord = true;
    }
  }

  return wordCount;
}

function lineIsBlank(text, start, end) {
  for (let index = start; index < end; index += 1) {
    if (!WHITESPACE.test(text[index])) {
      return false;
    }
  }
  return true;
}

function collectBlocks(text, fileId, selectionIndex) {
  const blocks = [];
  let blockStartOffset = -1;
  let blockStartLine = 0;
  let blockEndOffset = 0;
  let blockEndLine = 0;

  function finishBlock() {
    if (blockStartOffset === -1) {
      return;
    }

    const normalized = text.slice(blockStartOffset, blockEndOffset).replace(/\s+/gu, ' ').trim();
    const wordCount = countWords(normalized);
    const normalizedByteCount = encoder.encode(normalized).byteLength;

    if (
      wordCount >= DUPLICATE_LIMITS.wordCount
      && normalizedByteCount >= DUPLICATE_LIMITS.normalizedByteCount
    ) {
      blocks.push({
        normalized,
        wordCount,
        normalizedByteCount,
        occurrence: {
          fileId,
          startLine: blockStartLine,
          endLine: blockEndLine,
          selectionIndex,
        },
      });
    }

    blockStartOffset = -1;
    blockStartLine = 0;
    blockEndOffset = 0;
    blockEndLine = 0;
  }

  function processLine(start, end, lineNumber) {
    if (lineIsBlank(text, start, end)) {
      finishBlock();
      return;
    }

    if (blockStartOffset === -1) {
      blockStartOffset = start;
      blockStartLine = lineNumber;
    }
    blockEndOffset = end;
    blockEndLine = lineNumber;
  }

  let lineStart = 0;
  let lineNumber = 1;
  let index = 0;

  while (index < text.length) {
    if (text[index] !== '\r' && text[index] !== '\n') {
      index += 1;
      continue;
    }

    processLine(lineStart, index, lineNumber);
    if (text[index] === '\r' && text[index + 1] === '\n') {
      index += 1;
    }
    index += 1;
    lineStart = index;
    lineNumber += 1;
  }

  processLine(lineStart, text.length, lineNumber);
  finishBlock();
  return blocks;
}

function validateAndDecode(files) {
  if (!Array.isArray(files)) {
    throw new TypeError('Files must be provided as an array.');
  }

  const ids = new Set();

  return files.map((file, selectionIndex) => {
    if (ids.has(file.id)) {
      throw new Error('Each file must have a unique id.');
    }
    ids.add(file.id);

    if (!(file.data instanceof Uint8Array)) {
      throw new TypeError(`File ${file.id} must provide Uint8Array data.`);
    }

    let text;
    try {
      text = decoder.decode(file.data);
    } catch {
      throw Object.assign(new Error(`File ${file.id} is not valid UTF-8.`), {
        code: 'INVALID_UTF8',
        fileId: file.id,
      });
    }

    return {
      id: file.id,
      name: file.name,
      data: file.data,
      text,
      selectionIndex,
    };
  });
}

export function analyzeFiles(files) {
  const decodedFiles = validateAndDecode(files);
  const totalByteCount = decodedFiles.reduce((sum, file) => sum + file.data.byteLength, 0);
  const duplicateGroups = new Map();

  const measuredFiles = decodedFiles.map((file) => {
    for (const block of collectBlocks(file.text, file.id, file.selectionIndex)) {
      const group = duplicateGroups.get(block.normalized) ?? {
        wordCount: block.wordCount,
        normalizedByteCount: block.normalizedByteCount,
        occurrences: [],
      };
      group.occurrences.push(block.occurrence);
      duplicateGroups.set(block.normalized, group);
    }

    return {
      id: file.id,
      name: file.name,
      byteCount: file.data.byteLength,
      lineCount: countLines(file.text),
      wordCount: countWords(file.text),
      byteShare: {
        numerator: file.data.byteLength,
        denominator: totalByteCount,
      },
      selectionIndex: file.selectionIndex,
    };
  });

  const duplicates = [...duplicateGroups.values()]
    .filter((group) => new Set(group.occurrences.map(({ fileId }) => fileId)).size >= 2)
    .sort((left, right) => (
      right.normalizedByteCount - left.normalizedByteCount
      || right.wordCount - left.wordCount
      || left.occurrences[0].selectionIndex - right.occurrences[0].selectionIndex
      || left.occurrences[0].startLine - right.occurrences[0].startLine
    ))
    .map((group, index) => ({
      id: `D${index + 1}`,
      wordCount: group.wordCount,
      normalizedByteCount: group.normalizedByteCount,
      occurrences: group.occurrences.map(({ fileId, startLine, endLine }) => ({
        fileId,
        startLine,
        endLine,
      })),
    }));

  return {
    totalByteCount,
    files: measuredFiles
      .sort((left, right) => right.byteCount - left.byteCount || left.selectionIndex - right.selectionIndex)
      .map(({ selectionIndex, ...file }) => file),
    duplicates,
  };
}
