#!/usr/bin/env node
// Build the animated SVG used as Onshape App Store summary image.
//
// What's new vs the bash version: instead of embedding fonts as woff2
// and letting the browser render them, we run opentype.js, extract
// the actual cubic Bézier outlines + segment endpoints for each font,
// and bake them into the SVG as <path d="..."> + <circle> dots.
//
// Benefits:
//   - Real anchor-point vertices at segment endpoints (true SketchViewer look)
//   - Renders identically everywhere (no @font-face fallback risk)
//   - Smaller file (no woff2 bytes), and renderable by rsvg-convert
//
// Run from repo root:
//   node scripts/build-appstore-thumbnail.mjs

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FULL = `${ROOT}/design/appstore-summary-animated.svg`;
// Chromeless variant for the landing page (no header / caption,
// just the sketch stage). Lives in /public so Next can serve it.
const OUT_STAGE = `${ROOT}/public/landing-hero-animated.svg`;
const WORD = "Hello";

// Google CSS API returns TTF when no User-Agent header is sent.
function fetchTTF(id, family) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(WORD)}`;
  const css = execSync(`curl -s '${url}'`).toString();
  const ttfUrl = css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/)?.[0];
  if (!ttfUrl) throw new Error(`No font URL for ${family}`);
  const tmp = `/tmp/${id}.ttf`;
  execSync(`curl -s -o '${tmp}' '${ttfUrl}'`);
  return tmp;
}

// Render "Hello" in `fontPath` at the given font size, LEFT-aligned so
// the leftmost ink lands at leftX, with the baseline at baselineY.
// Returns { d, points }.
function renderWord(fontPath, fontSize, leftX, baselineY) {
  const buf = readFileSync(fontPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const font = opentype.parse(ab);
  const path = font.getPath(WORD, 0, 0, fontSize);
  const bbox = path.getBoundingBox();
  // shift so leftmost ink lands at leftX and baseline at baselineY
  const dx = leftX - bbox.x1;
  const dy = baselineY;
  // Apply translation to commands (so points and path d are in canvas coords).
  for (const c of path.commands) {
    if (c.x !== undefined) c.x += dx;
    if (c.y !== undefined) c.y += dy;
    if (c.x1 !== undefined) c.x1 += dx;
    if (c.y1 !== undefined) c.y1 += dy;
    if (c.x2 !== undefined) c.x2 += dx;
    if (c.y2 !== undefined) c.y2 += dy;
  }
  const points = [];
  for (const c of path.commands) {
    if (c.type === "M" || c.type === "L" || c.type === "C" || c.type === "Q") {
      points.push([+c.x.toFixed(2), +c.y.toFixed(2)]);
    }
  }
  return { d: path.toPathData(2), points };
}

// === Fetch fonts ===
console.log("Fetching fonts...");
const sources = [
  // Each ~15-20% larger than the v3 sizes (78/78/78/62) to give the
  // word more visual weight in the thumbnail.
  { id: "playfair",  family: "Playfair+Display:ital,wght@1,700", size: 92 },
  { id: "lobster",   family: "Lobster",                          size: 88 },
  { id: "roboto",    family: "Roboto:wght@700",                  size: 88 },
  { id: "jetbrains", family: "JetBrains+Mono:wght@700",          size: 76 },
];
for (const s of sources) {
  s.path = fetchTTF(s.id, s.family);
}

// === Layout ===
// Stage uses 9 whole grid cells of 14 px = 126. Canvas height 197 −
// stage 126 = 71 px for header + caption. Split as 36 + 35 (1 px
// difference is visually indistinguishable; this is the closest we
// can get with whole-cell stage AND fixed canvas dimensions).
const CANVAS_W = 350;
const CANVAS_H = 197;
const GRID = 14;
// Whole stage shifted down by half a grid cell (7 px) for more
// breathing room above the text and a tighter caption strip.
const STAGE_NUDGE_DOWN = GRID / 2;                // 7
const HEADER_H = 36 + STAGE_NUDGE_DOWN;           // 43
const STAGE_TOP = HEADER_H;                       // 43
const STAGE_BOTTOM = HEADER_H + 9 * GRID;         // 169
const CAPTION_TOP = STAGE_BOTTOM;                 // 169
// Logo + wordmark are centered as a unit on the canvas mid-x. The
// wordmark width is eyeballed (system font; no programmatic measurer
// available at build time). Refine if the optical centering looks
// off in either rsvg-convert preview or the live browser render.
const LOGO_SIZE = 32;
const LOGO_RADIUS = LOGO_SIZE / 4.5;                  // ~7 for 32 — matches the proportions of the 18 px original
const LOGO_INNER_PAD = LOGO_SIZE * 0.18;              // glyph inset inside the gradient tile
const LOGO_INNER_SCALE = (LOGO_SIZE - 2 * LOGO_INNER_PAD) / 640;
const LOGO_GAP = 11;                                  // logo → text gap (scales with text)
const WORDMARK_FONT_SIZE = 20;                        // bumped from 11.5 to match the bigger logo
const WORDMARK_APPROX_WIDTH = 232;                    // 'Google Fonts for Onshape' @ 20 px system semibold + regular
const HEADER_GROUP_WIDTH = LOGO_SIZE + LOGO_GAP + WORDMARK_APPROX_WIDTH;
const LOGO_LEFT = (CANVAS_W - HEADER_GROUP_WIDTH) / 2;
const LOGO_TOP = (HEADER_H - LOGO_SIZE) / 2;
// Baseline ~0.35 × font-size below the optical center of the text.
const WORDMARK_BASELINE_Y = HEADER_H / 2 + WORDMARK_FONT_SIZE * 0.35;
// Text is LEFT-ALIGNED at TEXT_X with baseline at TEXT_BASELINE.
// The two thicker "origin" axes meet exactly at this (start, baseline)
// corner — i.e. at the 0,0 of the text frame.
const TEXT_X = 56;                                // 4 cells from left edge
const TEXT_BASELINE = 126 + STAGE_NUDGE_DOWN;     // 133

// === Extract curves + vertices ===
console.log("Extracting glyph curves...");
for (const s of sources) {
  Object.assign(s, renderWord(s.path, s.size, TEXT_X, TEXT_BASELINE));
}

// === Build SVG ===
const cycleSec = 8;
const slots = sources.length;            // 4
const slotPct = 100 / slots;             // 25%
const peakPct = slotPct * 0.8;           // 20% of cycle peak visible
function keyframesFor(i) {
  const startFade = i * slotPct;
  const peakEnd = startFade + peakPct;
  const fadeOut = startFade + slotPct;
  // wrap-around for the last slot
  const fmt = (p) => `${p.toFixed(2)}%`;
  if (i === 0) {
    return `0%, ${fmt(peakPct)} { opacity: 1; }
      ${fmt(slotPct)}, ${fmt(100 - slotPct + peakPct)} { opacity: 0; }
      100% { opacity: 1; }`;
  }
  return `0%, ${fmt(startFade)} { opacity: 0; }
      ${fmt(startFade + (slotPct - peakPct))}, ${fmt(peakEnd + (slotPct - peakPct))} { opacity: 1; }
      ${fmt(fadeOut + (slotPct - peakPct))}, 100% { opacity: 0; }`;
}

// Logo path (from design/logo-mark-only.svg).
const LOGO = `M200 64C213.3 64 224 74.7 224 88L224 144L360 144C373.3 144 384 154.7 384 168C384 181.3 373.3 192 360 192L343.8 192L327.3 230.4C308.7 273.9 282.1 313.2 249.4 346.4C263.3 355.6 278 363.8 293.4 370.8L354.3 398.7L426.1 238.2C430 229.6 438.5 224 448 224C457.5 224 466 229.6 469.9 238.2L605.9 542.2C611.3 554.3 605.9 568.5 593.8 573.9C581.7 579.3 567.5 573.9 562.1 561.8L532.7 496L363.4 496L334 561.8C328.6 573.9 314.4 579.3 302.3 573.9C290.2 568.5 284.8 554.3 290.2 542.2L334.8 442.5L273.5 414.4C252 404.5 231.6 392.7 212.6 379.2C195.1 392.8 176.3 404.9 156.4 415.3L99.1 445.3C87.4 451.5 72.9 446.9 66.7 435.2C60.5 423.5 65.1 409 76.8 402.8L134 372.8C148 365.5 161.4 357.1 174.1 348C146.6 322.4 123 292.8 104.1 260C97.5 248.5 101.4 233.8 112.9 227.2C124.4 220.6 139.1 224.5 145.7 236C163.1 266.3 185.2 293.5 211.1 316.7C241.6 286.9 266.2 251.2 283.3 211.4L291.6 192L56 192C42.7 192 32 181.3 32 168C32 154.7 42.8 144 56 144L176 144L176 88C176 74.7 186.7 64 200 64zM511.2 448L448 306.8L384.8 448L511.2 448z`;

const glyphGroups = sources.map((s, i) => {
  const dots = s.points
    .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.4"/>`)
    .join("");
  return `<g class="g${i}" opacity="${i === 0 ? 1 : 0}">
      <path d="${s.d}" fill="none" stroke="#1189e3" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
      <g fill="#1189e3" stroke="#ffffff" stroke-width="0.5">${dots}</g>
    </g>`;
}).join("\n    ");

const keyframeBlocks = sources.map((_, i) =>
  `@keyframes cyc${i} { ${keyframesFor(i)} }`
).join("\n      ");

const animClasses = sources.map((_, i) =>
  `.g${i} { animation: cyc${i} ${cycleSec}s infinite; }`
).join("\n      ");

// Shared bits used by both SVG outputs.
const sharedDefs = `<defs>
    <style>
      ${animClasses}
      ${keyframeBlocks}
    </style>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F48635"/>
      <stop offset="100%" stop-color="#ed3338"/>
    </linearGradient>
    <pattern id="grid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse">
      <path d="M ${GRID} 0 L 0 0 0 ${GRID}" fill="none" stroke="#eaedf2" stroke-width="0.7"/>
    </pattern>
  </defs>`;

// Stage = grid + origin axes + cycling glyphs. Same in both outputs.
const stage = `<g>
    <rect x="0" y="${STAGE_TOP}" width="${CANVAS_W}" height="${STAGE_BOTTOM - STAGE_TOP}" fill="#fdfbf8"/>
    <rect x="0" y="${STAGE_TOP}" width="${CANVAS_W}" height="${STAGE_BOTTOM - STAGE_TOP}" fill="url(#grid)"/>
    <line x1="0" y1="${TEXT_BASELINE}" x2="${CANVAS_W}" y2="${TEXT_BASELINE}"
          stroke="#cbd5e1" stroke-width="0.7"/>
    <line x1="${TEXT_X}" y1="${STAGE_TOP}" x2="${TEXT_X}" y2="${STAGE_BOTTOM}"
          stroke="#cbd5e1" stroke-width="0.7"/>
  </g>
  ${glyphGroups}`;

// === Output A: App Store summary (full chrome) ===
const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}">
  ${sharedDefs}

  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#ffffff"/>

  <!-- Header -->
  <g>
    <g transform="translate(${LOGO_LEFT}, ${LOGO_TOP})">
      <rect width="${LOGO_SIZE}" height="${LOGO_SIZE}" rx="${LOGO_RADIUS}" ry="${LOGO_RADIUS}" fill="url(#brand)"/>
      <g transform="translate(${LOGO_INNER_PAD}, ${LOGO_INNER_PAD}) scale(${LOGO_INNER_SCALE})" fill="#ffffff">
        <path d="${LOGO}"/>
      </g>
    </g>
    <text x="${LOGO_LEFT + LOGO_SIZE + LOGO_GAP}" y="${WORDMARK_BASELINE_Y}" xml:space="preserve"
          font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif"
          font-weight="600" font-size="${WORDMARK_FONT_SIZE}" fill="#0f1216"
          >Google Fonts <tspan font-weight="400" fill="#94a0b0">for Onshape</tspan></text>
    <line x1="0" y1="${HEADER_H}" x2="${CANVAS_W}" y2="${HEADER_H}" stroke="#eef1f5" stroke-width="0.7"/>
  </g>

  ${stage}

  <!-- Caption -->
  <g>
    <rect x="0" y="${CAPTION_TOP}" width="${CANVAS_W}" height="${CANVAS_H - CAPTION_TOP}" fill="#ffffff"/>
    <line x1="0" y1="${CAPTION_TOP}" x2="${CANVAS_W}" y2="${CAPTION_TOP}" stroke="#eef1f5" stroke-width="0.7"/>
    <text x="175" y="${CAPTION_TOP + (CANVAS_H - CAPTION_TOP) / 2 + 3}" text-anchor="middle" xml:space="preserve"
          font-family="-apple-system, 'SF Mono', Menlo, monospace"
          font-size="9" font-weight="500" letter-spacing="1.4" fill="#4a5260"
          >1,900+ GOOGLE FONTS <tspan fill="#94a0b0">or</tspan> CUSTOM .otf/.ttf FONT</text>
  </g>
</svg>
`;

// === Output B: Landing hero (chromeless — just the stage portion) ===
// Same glyph coordinates, but the viewBox is windowed to the stage
// region so header + caption simply aren't in view.
const STAGE_H = STAGE_BOTTOM - STAGE_TOP;
const stageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${STAGE_TOP} ${CANVAS_W} ${STAGE_H}" width="${CANVAS_W}" height="${STAGE_H}" preserveAspectRatio="xMidYMid meet">
  ${sharedDefs}
  ${stage}
</svg>
`;

writeFileSync(OUT_FULL, fullSvg);
writeFileSync(OUT_STAGE, stageSvg);
const ptStr = sources.map(s => `${s.id}=${s.points.length}pts`).join(", ");
console.log(`Built ${OUT_FULL} (${Buffer.byteLength(fullSvg)} bytes, ${ptStr})`);
console.log(`Built ${OUT_STAGE} (${Buffer.byteLength(stageSvg)} bytes)`);
