#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const loafDirArg = args.get("loaf-dir");
if (typeof loafDirArg !== "string" || loafDirArg.length === 0) {
  throw new Error("Usage: node scripts/publish-loaf.mjs --loaf-dir /path/to/loaf [--output-dir loaf]");
}

const loafDir = resolve(loafDirArg);
const outputDir = resolve(typeof args.get("output-dir") === "string" ? args.get("output-dir") : "loaf");
const distDir = resolve(loafDir, "dist");
const sourceIndex = resolve(distDir, "index.html");
const sourceOg = resolve(distDir, "og.png");

for (const requiredPath of [sourceIndex, sourceOg]) {
  try {
    await readFile(requiredPath);
  } catch {
    throw new Error(`LOAF build is missing ${requiredPath}; run npm run build first`);
  }
}

const { stdout } = await execFileAsync("git", ["-C", loafDir, "rev-parse", "--verify", "HEAD"]);
const sourceCommit = stdout.trim();
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error(`Unexpected LOAF source commit: ${sourceCommit}`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(distDir, outputDir, { recursive: true });

const outputIndex = resolve(outputDir, "index.html");
let html = await readFile(outputIndex, "utf8");
html = html.replaceAll("https://loaf-cat-stack.chargen.chatgpt.site", "https://nikitavorontsov.com/loaf");
html = html.replaceAll('data-domain="loaf-cat-stack.chargen.chatgpt.site"', 'data-domain="nikitavorontsov.com"');
await writeFile(outputIndex, html);

const outputAssets = resolve(outputDir, "assets");
const javascriptAssets = (await readdir(outputAssets)).filter(asset => asset.endsWith(".js"));
const javascriptContents = await Promise.all(javascriptAssets.map(asset => readFile(resolve(outputAssets, asset), "utf8")));
if (!javascriptContents.some(content => content.includes("supabase.co"))) {
  throw new Error("LOAF build is missing Cat Circle configuration; rebuild with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before publishing");
}
for (const asset of await readdir(outputAssets)) {
  if (!asset.endsWith(".css")) continue;
  const cssPath = resolve(outputAssets, asset);
  const css = await readFile(cssPath, "utf8");
  await writeFile(cssPath, css.replaceAll('url("/fonts/', 'url("../fonts/'));
}

await writeFile(
  resolve(outputDir, "source.json"),
  `${JSON.stringify({
    sourceRepository: "loaf-custom-cats",
    sourceCommit,
    publicPath: "/loaf/",
  }, null, 2)}\n`,
);

console.log(`Packaged LOAF ${sourceCommit} at ${outputDir}`);
