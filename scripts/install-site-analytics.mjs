import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
export const analyticsTag = '<script defer src="/analytics.js"></script>';

export function siteHtmlPages() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "*.html"], {
    cwd: root,
    encoding: "utf8",
  }).split("\0").filter(Boolean);
}

export function withSiteAnalytics(html) {
  if (!/<head\b[^>]*>/i.test(html)) throw new Error("Page is missing its head element");
  let cleaned = html.replace(
    /[ \t]*<script\b(?=[^>]*\bsrc=["'](?:\/analytics\.js|https:\/\/plausible\.io\/js\/script(?:\.manual)?\.js)["'])[^>]*>\s*<\/script>[ \t]*\n?/gi,
    "",
  );
  // Archived lab pages block external scripts and connections by default.
  // Allow only the existing Plausible script path and event endpoint.
  cleaned = cleaned.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, (tag) =>
    tag.replace(/\bcontent="([^"]*)"/i, (_, policy) => {
      const updated = policy.split(";").map((directive) => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        const allowed = name === "script-src" ? "https://plausible.io/js/"
          : name === "connect-src" ? "https://plausible.io/api/event" : null;
        if (!allowed) return directive.trim();
        return [name, ...new Set([...sources.filter((source) => source !== "'none'"), allowed])].join(" ");
      }).join("; ");
      return `content="${updated}"`;
    }),
  );
  return cleaned.replace(/(<head\b[^>]*>)[ \t]*(?:\r?\n)?/i, (_, head) => `${head}\n  ${analyticsTag}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pages = siteHtmlPages();
  for (const page of pages) {
    const path = resolve(root, page);
    const html = await readFile(path, "utf8");
    const updated = withSiteAnalytics(html);
    if (updated !== html) await writeFile(path, updated);
  }
  console.log(`Shared analytics installed on ${pages.length} HTML pages`);
}
