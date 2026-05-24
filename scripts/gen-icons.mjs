// Generates PWA PNG icons from the Font Awesome rupee glyph (vector path, so no
// system-font dependency). Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { faIndianRupeeSign } from "@fortawesome/free-solid-svg-icons";

const [gw, gh, , , pathData] = faIndianRupeeSign.icon;
const BG = "#1c1b18"; // ink
const FG = "#f5f2eb"; // ivory
const OUT = "client/public";
mkdirSync(OUT, { recursive: true });

function makeSvg({ size = 512, radius = 0, glyphRatio = 0.5 } = {}) {
  const s = (size * glyphRatio) / gh; // scale glyph to a fraction of the canvas height
  const tx = (size - gw * s) / 2;
  const ty = (size - gh * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${s})"><path d="${pathData}" fill="${FG}"/></g>
</svg>`;
}

async function png(svgStr, size, file) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(`${OUT}/${file}`);
  console.log("wrote", `${OUT}/${file}`);
}

const rounded = makeSvg({ size: 512, radius: 112, glyphRatio: 0.54 });
await png(rounded, 512, "icon-512.png");
await png(rounded, 192, "icon-192.png");
// Apple touch icon: full-bleed (iOS applies its own rounding)
await png(makeSvg({ size: 512, radius: 0, glyphRatio: 0.54 }), 180, "apple-touch-icon.png");
// Maskable: full-bleed with the glyph inside the safe zone (smaller)
await png(makeSvg({ size: 512, radius: 0, glyphRatio: 0.42 }), 512, "maskable-512.png");
console.log("icons generated.");
