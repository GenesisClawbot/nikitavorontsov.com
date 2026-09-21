const base = (process.env.SITE_URL || "https://nikitavorontsov.com").replace(/\/$/, "");
const paths = ["/", "/loaf/", "/loaf/og.png", "/pr-warrant/"];
const results = [];

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers: { "user-agent": "LOAF-release-check/1.0" },
    redirect: "follow",
  });
  const body = path.endsWith(".png") ? "" : await response.text();
  results.push({ path, status: response.status, finalUrl: response.url });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return body;
}

const root = await get("/");
const loaf = await get("/loaf/");
await get("/loaf/og.png");
await get("/pr-warrant/");
if (!root.includes('rel="canonical" href="https://nikitavorontsov.com/"')) throw new Error("root canonical is wrong");
if (!root.includes("./loaf/")) throw new Error("root LOAF link is missing");
if (!loaf.includes('rel="canonical" href="https://nikitavorontsov.com/loaf/"')) throw new Error("LOAF canonical is wrong");
if (!loaf.includes('data-domain="nikitavorontsov.com"')) throw new Error("Plausible domain is wrong");
if (!loaf.includes('src="./assets/')) throw new Error("LOAF JavaScript is not relative");

const manifestResponse = await fetch(`${base}/loaf/source.json`, { headers: { "user-agent": "LOAF-release-check/1.0" } });
if (!manifestResponse.ok) throw new Error(`/loaf/source.json returned HTTP ${manifestResponse.status}`);
const manifest = await manifestResponse.json();
if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || manifest.publicPath !== "/loaf/") throw new Error("LOAF source manifest is invalid");
console.log(JSON.stringify({ ok: true, base, results, sourceCommit: manifest.sourceCommit }, null, 2));
