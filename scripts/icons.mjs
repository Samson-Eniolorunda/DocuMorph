// Renders the raster icon set from the logo: node scripts/icons.mjs
// Set PW_CHROMIUM_PATH to use an installed Chromium. Output is committed; run this only when the logo changes.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const MARK = `
  <path d="M10 7h8l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="#ffffff" opacity="0.95"/>
  <path d="M18 7v5h5" fill="none" stroke="#0f766e" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M12.5 19.5h7m0 0-2.5-2.5m2.5 2.5L17 22" fill="none" stroke="#0f766e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
// Rounded: browser tabs and the install icon. Square: the Apple touch icon (iOS rounds it itself).
const rounded = svg(`<rect width="32" height="32" rx="8" fill="#0f766e"/>${MARK}`);
const square = svg(`<rect width="32" height="32" fill="#0f766e"/>${MARK}`);
// Maskable: the mark is drawn inside the central 80 % so any mask shape keeps it whole.
const maskable = svg(
  `<rect width="32" height="32" fill="#0f766e"/><g transform="translate(3.2 3.2) scale(0.8)">${MARK}</g>`,
);

const executablePath = process.env.PW_CHROMIUM_PATH;
const browser = await chromium.launch(
  executablePath ? { executablePath, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
);
const page = await browser.newPage();

async function png(markup, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${markup.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  return page.screenshot({ omitBackground: true, type: "png" });
}

writeFileSync("public/icons/icon-192.png", await png(rounded, 192));
writeFileSync("public/icons/icon-512.png", await png(rounded, 512));
writeFileSync("public/icons/icon-maskable-512.png", await png(maskable, 512));
writeFileSync("src/app/apple-icon.png", await png(square, 180));

// favicon.ico: one 32 px PNG inside an ICO container, which every current browser reads.
const small = await png(rounded, 32);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.set([32, 32, 0, 0], 6); // width, height, palette, reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(small.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync("src/app/favicon.ico", Buffer.concat([header, small]));
await browser.close();
