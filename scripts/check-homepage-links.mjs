#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = fs.realpathSync(path.resolve(scriptDir, ".."));
const homepagePath = path.join(siteRoot, "index.html");
const baseUrl = new URL("https://homepage.invalid/");
const linkAttributes = new Set(["href", "src", "srcset", "poster"]);
const rawTextElements = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes"]);
const namedReferences = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["quot", '"'],
]);

function decodeHtmlReferences(value) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, reference) => {
    if (reference[0] !== "#") {
      return namedReferences.get(reference.toLowerCase()) ?? match;
    }

    const isHex = reference[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(reference.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return "\uFFFD";
    }
    return String.fromCodePoint(codePoint);
  });
}

function findTagEnd(html, start) {
  let quote = "";
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function parseAttributes(source) {
  const attributes = new Map();
  let index = 0;

  while (index < source.length) {
    while (index < source.length && (/\s/.test(source[index]) || source[index] === "/")) index += 1;
    if (index >= source.length) break;

    const nameStart = index;
    while (index < source.length && !/[\s=/>]/.test(source[index])) index += 1;
    if (index === nameStart) {
      index += 1;
      continue;
    }

    const name = source.slice(nameStart, index).toLowerCase();
    while (index < source.length && /\s/.test(source[index])) index += 1;

    let value = "";
    if (source[index] === "=") {
      index += 1;
      while (index < source.length && /\s/.test(source[index])) index += 1;

      const quote = source[index] === '"' || source[index] === "'" ? source[index] : "";
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) index += 1;
        value = source.slice(valueStart, index);
        if (source[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < source.length && !/\s/.test(source[index])) index += 1;
        value = source.slice(valueStart, index);
      }
    }

    // The HTML tokenizer keeps the first value when an attribute is duplicated.
    if (!attributes.has(name)) attributes.set(name, decodeHtmlReferences(value));
  }

  return attributes;
}

function* startTags(html) {
  let index = 0;
  const lowerHtml = html.toLowerCase();

  while (index < html.length) {
    const start = html.indexOf("<", index);
    if (start < 0) return;

    if (html.startsWith("<!--", start)) {
      const commentEnd = html.indexOf("-->", start + 4);
      index = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }

    const afterOpen = html[start + 1];
    if (!afterOpen) return;
    if (afterOpen === "/" || afterOpen === "!" || afterOpen === "?") {
      const end = findTagEnd(html, start + 1);
      index = end < 0 ? html.length : end + 1;
      continue;
    }
    if (!/[A-Za-z]/.test(afterOpen)) {
      index = start + 1;
      continue;
    }

    let nameEnd = start + 1;
    while (nameEnd < html.length && !/[\s/>]/.test(html[nameEnd])) nameEnd += 1;
    const tagName = html.slice(start + 1, nameEnd).toLowerCase();
    const end = findTagEnd(html, nameEnd);
    if (end < 0) return;

    yield {
      tagName,
      attributes: parseAttributes(html.slice(nameEnd, end)),
      start,
    };

    index = end + 1;
    if (tagName === "plaintext") return;
    if (rawTextElements.has(tagName)) {
      let closeStart = lowerHtml.indexOf(`</${tagName}`, index);
      while (closeStart >= 0 && !/[\s/>]/.test(html[closeStart + tagName.length + 2] ?? ">")) {
        closeStart = lowerHtml.indexOf(`</${tagName}`, closeStart + tagName.length + 2);
      }
      if (closeStart < 0) return;
      const closeEnd = findTagEnd(html, closeStart + 2);
      index = closeEnd < 0 ? html.length : closeEnd + 1;
    }
  }
}

function lineAndColumn(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (lineStarts[middle] <= offset) low = middle + 1;
    else high = middle;
  }
  const lineIndex = low - 1;
  return { line: lineIndex + 1, column: offset - lineStarts[lineIndex] + 1 };
}

function splitSrcset(value) {
  const candidates = [];
  let index = 0;

  while (index < value.length) {
    while (index < value.length && (/[\t\n\f\r ]/.test(value[index]) || value[index] === ",")) index += 1;
    if (index >= value.length) break;

    const urlStart = index;
    while (index < value.length && !/[\t\n\f\r ]/.test(value[index])) index += 1;
    let url = value.slice(urlStart, index);
    let endedWithComma = false;
    while (url.endsWith(",")) {
      url = url.slice(0, -1);
      endedWithComma = true;
    }
    if (url) candidates.push(url);
    if (endedWithComma) continue;

    let parentheses = 0;
    while (index < value.length) {
      const character = value[index];
      if (character === "(") parentheses += 1;
      else if (character === ")" && parentheses > 0) parentheses -= 1;
      else if (character === "," && parentheses === 0) {
        index += 1;
        break;
      }
      index += 1;
    }
  }

  return candidates;
}

function isWithinRoot(candidate) {
  return candidate === siteRoot || candidate.startsWith(`${siteRoot}${path.sep}`);
}

function inspectInsideRoot(relativePath) {
  let target = path.resolve(siteRoot, relativePath);
  let symlinkHops = 0;

  while (true) {
    if (!isWithinRoot(target)) {
      return { error: "resolves outside the repository; refusing to inspect it" };
    }

    const relative = path.relative(siteRoot, target);
    const segments = relative ? relative.split(path.sep).filter(Boolean) : [];
    let cursor = siteRoot;
    let restart = false;

    for (let position = 0; position < segments.length; position += 1) {
      const candidate = path.join(cursor, segments[position]);
      let info;
      try {
        info = fs.lstatSync(candidate);
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") {
          return { error: "does not exist" };
        }
        return { error: `cannot inspect path (${error.message})` };
      }

      if (info.isSymbolicLink()) {
        symlinkHops += 1;
        if (symlinkHops > 40) return { error: "contains a symlink loop" };

        let linkTarget;
        try {
          linkTarget = fs.readlinkSync(candidate);
        } catch (error) {
          return { error: `cannot read symlink (${error.message})` };
        }
        const expanded = path.resolve(path.dirname(candidate), linkTarget, ...segments.slice(position + 1));
        if (!isWithinRoot(expanded)) {
          return { error: "contains a symlink that resolves outside the repository; refusing to inspect it" };
        }
        target = expanded;
        restart = true;
        break;
      }

      if (position < segments.length - 1 && !info.isDirectory()) {
        return { error: "a parent path component is not a directory" };
      }
      cursor = candidate;
    }

    if (restart) continue;

    let finalInfo;
    try {
      finalInfo = fs.lstatSync(target);
    } catch (error) {
      return { error: `cannot inspect target (${error.message})` };
    }
    return { info: finalInfo, path: target };
  }
}

function isDevelopmentEntry(tagName, attributeName, value) {
  if (tagName !== "script" || attributeName !== "src") return false;
  try {
    const url = new URL(value, baseUrl);
    if (url.origin !== baseUrl.origin) return false;
    const pathname = decodeURIComponent(url.pathname);
    return pathname === "/@vite/client" || pathname.startsWith("/@vite/") || pathname === "/src" || pathname.startsWith("/src/");
  } catch {
    return false;
  }
}

function describeSource(tag, attribute, value, location) {
  return `index.html:${location.line}:${location.column} <${tag.tagName}> ${attribute}=${JSON.stringify(value)}`;
}

function main() {
  let html;
  try {
    html = fs.readFileSync(homepagePath, "utf8");
  } catch (error) {
    console.error(`Cannot read homepage at ${homepagePath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const lineStarts = [0];
  for (let index = 0; index < html.length; index += 1) {
    if (html[index] === "\n") lineStarts.push(index + 1);
  }

  const tags = [...startTags(html)];
  const fragments = new Set();
  for (const tag of tags) {
    const id = tag.attributes.get("id");
    const anchorName = tag.tagName === "a" ? tag.attributes.get("name") : undefined;
    if (id !== undefined) fragments.add(id);
    if (anchorName !== undefined) fragments.add(anchorName);
  }

  const failures = [];
  const externalDestinations = [];
  let checked = 0;
  let ignoredData = 0;
  let ignoredDevelopmentEntries = 0;

  const checkReference = (tag, attributeName, value) => {
    const rawValue = value;
    const source = describeSource(tag, attributeName, rawValue, lineAndColumn(lineStarts, tag.start));
    const trimmed = value.trim();

    if (/^data:/i.test(trimmed)) {
      ignoredData += 1;
      return;
    }
    if (isDevelopmentEntry(tag.tagName, attributeName, trimmed)) {
      ignoredDevelopmentEntries += 1;
      return;
    }

    let url;
    try {
      url = new URL(trimmed, baseUrl);
    } catch (error) {
      failures.push(`${source}: invalid URL (${error.message})`);
      return;
    }

    if (/^(?:https?:)?\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || url.origin !== baseUrl.origin || url.protocol !== baseUrl.protocol) {
      externalDestinations.push(`${source} -> ${url.href}`);
      return;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(url.pathname);
    } catch (error) {
      failures.push(`${source}: invalid path encoding (${error.message})`);
      return;
    }
    if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
      failures.push(`${source}: path contains an invalid character`);
      return;
    }

    if (url.hash && (decodedPath === "/" || decodedPath === "/index.html")) {
      let fragment;
      try {
        fragment = decodeURIComponent(url.hash.slice(1));
      } catch (error) {
        failures.push(`${source}: invalid fragment encoding (${error.message})`);
        return;
      }
      if (!fragments.has(fragment)) {
        failures.push(`${source}: fragment #${fragment} does not match an id or anchor name in the root HTML`);
      }
    }

    const trailingSlash = decodedPath.endsWith("/");
    const relativePath = decodedPath.replace(/^\/+/, "");
    const result = inspectInsideRoot(relativePath);
    checked += 1;
    if (result.error) {
      failures.push(`${source}: ${result.error}`);
      return;
    }

    if (result.info.isDirectory()) {
      const indexResult = inspectInsideRoot(path.join(relativePath, "index.html"));
      if (indexResult.error || !indexResult.info?.isFile()) {
        failures.push(`${source}: directory has no usable index.html${indexResult.error ? ` (${indexResult.error})` : ""}`);
      }
      return;
    }

    if (!result.info.isFile()) {
      failures.push(`${source}: target exists but is not a file or directory`);
    } else if (trailingSlash) {
      failures.push(`${source}: URL ends with / but target is a file`);
    }
  };

  for (const tag of tags) {
    for (const [attributeName, attributeValue] of tag.attributes) {
      if (!linkAttributes.has(attributeName)) continue;
      if (attributeName === "srcset") {
        for (const candidate of splitSrcset(attributeValue)) {
          checkReference(tag, attributeName, candidate);
        }
      } else {
        checkReference(tag, attributeName, attributeValue);
      }
    }
  }

  if (externalDestinations.length) {
    console.log(`External destinations (reported only; not fetched): ${externalDestinations.length}`);
    for (const destination of externalDestinations) console.log(`  ${destination}`);
  }
  if (ignoredData || ignoredDevelopmentEntries) {
    console.log(`Skipped ${ignoredData} data URL(s) and ${ignoredDevelopmentEntries} development-only module entry(ies).`);
  }

  if (failures.length) {
    console.error(`Found ${failures.length} broken homepage reference(s) (${checked} local file or directory target(s) checked):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Homepage links look good: ${checked} local file or directory target(s) checked.`);
}

main();
