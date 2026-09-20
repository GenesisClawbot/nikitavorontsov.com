function acceptsFile(file) {
  return file.type.startsWith('text/') || /\.(?:md|markdown|txt)$/iu.test(file.name);
}

export function createSelectionBelt(maxTotalBytes, maxFiles = Number.POSITIVE_INFINITY) {
  let entries = [];
  let nextFileId = 1;
  let locked = false;

  return {
    get entries() {
      return [...entries];
    },

    add(files) {
      if (locked) {
        return { added: 0, rejected: [] };
      }

      let selectedByteCount = entries.reduce((sum, entry) => sum + entry.file.size, 0);
      const rejected = [];
      let added = 0;

      for (const file of files) {
        if (!acceptsFile(file)) {
          rejected.push({ file, reason: 'type' });
          continue;
        }

        if (entries.length >= maxFiles) {
          rejected.push({ file, reason: 'file-limit' });
          continue;
        }

        if (selectedByteCount + file.size > maxTotalBytes) {
          rejected.push({ file, reason: 'limit' });
          continue;
        }

        entries.push({ id: `file-${nextFileId}`, file });
        nextFileId += 1;
        selectedByteCount += file.size;
        added += 1;
      }

      return { added, rejected };
    },

    remove(id) {
      if (locked || !entries.some((entry) => entry.id === id)) {
        return false;
      }

      entries = entries.filter((entry) => entry.id !== id);
      return true;
    },

    clear() {
      if (locked) {
        return false;
      }

      entries = [];
      return true;
    },

    lock() {
      locked = true;
      return [...entries];
    },

    unlock() {
      locked = false;
    },
  };
}
