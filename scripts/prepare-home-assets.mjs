import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Creative originals come from the documented WaveSpeed jobs. This step only
// exports web images and composes screenshots of the existing Runbook builds.
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/prepare-home-assets.mjs /path/to/originals",
  );
const output = resolve("assets/home");
await mkdir(output, { recursive: true });
const image = (name) => sharp(resolve(source, `${name}.png`));
await Promise.all([
  image("dragon")
    .resize(1920, 1080)
    .webp({ quality: 86 })
    .toFile(`${output}/dragon.webp`),
  image("dragon-sketch")
    .resize(1920, 1080)
    .webp({ quality: 84 })
    .toFile(`${output}/dragon-sketch.webp`),
  image("loaf")
    .resize(1920, 1080)
    .webp({ quality: 85 })
    .toFile(`${output}/loaf.webp`),
  image("dragon")
    .resize(1067, 600)
    .extract({ left: 0, top: 0, width: 840, height: 600 })
    .webp({ quality: 85 })
    .toFile(`${output}/dragon-card.webp`),
  image("loaf")
    .resize(1067, 600)
    .extend({ left: 333, right: 0, top: 0, bottom: 0, extendWith: "copy" })
    .webp({ quality: 85 })
    .toFile(`${output}/loaf-card.webp`),
  image("portrait-cutout")
    .resize(900, 900)
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(`${output}/portrait.webp`),
  image("portrait-cutout")
    .resize(240, 240)
    .webp({ quality: 85 })
    .toFile(`${output}/portrait-small.webp`),
  image("portrait-cutout").resize(64, 64).png().toFile(`${output}/favicon.png`),
]);
console.log("Exported homepage artwork and portrait images.");

// Optional third argument: the final 1440x900 browser capture for social sharing.
if (process.argv[3]) {
  await sharp(resolve(process.argv[3]))
    .extract({ left: 0, top: 72, width: 1440, height: 756 })
    .resize(1200, 630)
    .webp({ quality: 86 })
    .toFile(`${output}/og.webp`);
}
