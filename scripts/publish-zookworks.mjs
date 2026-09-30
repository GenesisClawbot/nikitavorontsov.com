#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const sourceArg = flag("source-dir");
if (!sourceArg) {
  throw new Error("Usage: node scripts/publish-zookworks.mjs --source-dir /path/to/zookworks [--output-dir zookworks]");
}

const sourceDir = resolve(sourceArg);
const outputDir = resolve(flag("output-dir") ?? "zookworks");
const distDir = resolve(sourceDir, "dist");

for (const required of ["index.html", "og.jpg", "THIRD_PARTY_NOTICES.txt"]) {
  try {
    await readFile(resolve(distDir, required));
  } catch {
    throw new Error(`ZOOKWORKS build is missing dist/${required}; run npm run build first`);
  }
}

const html = await readFile(resolve(distDir, "index.html"), "utf8");
if (!html.includes("https://nikitavorontsov.com/zookworks/") || !html.includes('data-domain="nikitavorontsov.com"')) {
  throw new Error("ZOOKWORKS build does not point at nikitavorontsov.com/zookworks/; check its index.html");
}

const { stdout: status } = await execFileAsync("git", ["-C", sourceDir, "status", "--porcelain"]);
if (status.trim()) {
  throw new Error("ZOOKWORKS checkout has uncommitted changes; commit and rebuild so source.json names the real source");
}
const { stdout } = await execFileAsync("git", ["-C", sourceDir, "rev-parse", "--verify", "HEAD"]);
const sourceCommit = stdout.trim();

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(distDir, outputDir, { recursive: true });

await writeFile(
  resolve(outputDir, "source.json"),
  `${JSON.stringify({ sourceRepository: "zookworks", sourceCommit, publicPath: "/zookworks/" }, null, 2)}\n`,
);

console.log(`Packaged ZOOKWORKS ${sourceCommit} at ${outputDir}`);
