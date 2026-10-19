// One-off: compress the LoginForm hero background into a phone-sized WebP.
// Usage: node scripts/compress-hero-artwork.mjs
// Resolves sharp from the pnpm store (sharp is only a transitive override here,
// not hoisted into the root node_modules).
import { createRequire } from "node:module";
import fs from "node:fs";

// sharp is only a transitive pnpm override — not hoisted into the root
// node_modules — so locate it inside the store. Resolving *from* the store
// directory makes node walk into node_modules/sharp next to it.
const store = fs
  .readdirSync("node_modules/.pnpm", { withFileTypes: true })
  .find((d) => d.isDirectory() && d.name.startsWith("sharp@"));
if (!store) throw new Error("sharp not found in node_modules/.pnpm");

const require = createRequire(
  process.cwd() + `/node_modules/.pnpm/${store.name}/node_modules/index.js`
);
const sharp = require("sharp");

const src = "public/campus-twilight.png";
const dest = "public/campus-twilight.webp";

const info = await sharp(src)
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 80 })
  .toFile(dest);

console.log(`OK ${src} -> ${dest}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)} KB`);
