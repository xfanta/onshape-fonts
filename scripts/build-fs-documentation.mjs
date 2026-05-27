#!/usr/bin/env node
// Build the FeatureScript documentation PDF for 'Google Fonts to Sketch'.
//
// Layout mirrors Onshape's official sample FS docs (Spur Gear, Port
// Feature, Fill Pattern): single A4-landscape page with a left column
// of info blocks and a right column of visuals.
//
// Pipeline:
//   SVG (mm units) → rsvg-convert -f pdf → design/pdf/google-fonts-to-sketch.pdf
//
// Run from repo root:
//   node scripts/build-fs-documentation.mjs

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_SVG = `${ROOT}/design/pdf/google-fonts-to-sketch.svg`;
const OUT_PDF = `${ROOT}/design/pdf/google-fonts-to-sketch.pdf`;
mkdirSync(dirname(OUT_PDF), { recursive: true });

// Embed the in-context screenshot via data: URI so the SVG is fully
// self-contained (rsvg-convert doesn't follow relative file paths).
function dataUri(path, mime) {
  const b64 = readFileSync(path).toString("base64");
  return `data:${mime};base64,${b64}`;
}
const heroImg = dataUri(`${ROOT}/public/screenshots/in-context.png`, "image/png");
const panelImg = dataUri(`${ROOT}/public/screenshots/panel.png`, "image/png");

// A4 landscape in mm
const W = 297;
const H = 210;
const MARGIN = 12;
const COL_GAP = 6;
const COL_W = (W - 2 * MARGIN - COL_GAP) / 2;            // 136.5 mm each
const LEFT_X = MARGIN;
const RIGHT_X = MARGIN + COL_W + COL_GAP;

// Brand colors / palette matching the Onshape sample docs
const BLUE = "#1366d6";
const TEXT = "#222222";
const NOTE = "#444444";
const MUTED = "#7a7a7a";

const LOGO_PATH = `M200 64C213.3 64 224 74.7 224 88L224 144L360 144C373.3 144 384 154.7 384 168C384 181.3 373.3 192 360 192L343.8 192L327.3 230.4C308.7 273.9 282.1 313.2 249.4 346.4C263.3 355.6 278 363.8 293.4 370.8L354.3 398.7L426.1 238.2C430 229.6 438.5 224 448 224C457.5 224 466 229.6 469.9 238.2L605.9 542.2C611.3 554.3 605.9 568.5 593.8 573.9C581.7 579.3 567.5 573.9 562.1 561.8L532.7 496L363.4 496L334 561.8C328.6 573.9 314.4 579.3 302.3 573.9C290.2 568.5 284.8 554.3 290.2 542.2L334.8 442.5L273.5 414.4C252 404.5 231.6 392.7 212.6 379.2C195.1 392.8 176.3 404.9 156.4 415.3L99.1 445.3C87.4 451.5 72.9 446.9 66.7 435.2C60.5 423.5 65.1 409 76.8 402.8L134 372.8C148 365.5 161.4 357.1 174.1 348C146.6 322.4 123 292.8 104.1 260C97.5 248.5 101.4 233.8 112.9 227.2C124.4 220.6 139.1 224.5 145.7 236C163.1 266.3 185.2 293.5 211.1 316.7C241.6 286.9 266.2 251.2 283.3 211.4L291.6 192L56 192C42.7 192 32 181.3 32 168C32 154.7 42.8 144 56 144L176 144L176 88C176 74.7 186.7 64 200 64zM511.2 448L448 306.8L384.8 448L511.2 448z`;

// === Content ===
const TITLE = "Google Fonts to Sketch";
const CREATED_BY = "Michal Fanta — onshape-fonts.xfanta.com";
const DESCRIPTION =
  "This custom feature renders text from any Google Fonts family (1,900+) or your own uploaded .ttf / .otf file onto the chosen sketch plane as native cubic-Bézier curves. Em-height, position, and rotation stay editable as live feature parameters.";
const PREREQUISITES =
  "A planar face or datum plane to receive the text. The curve data is supplied by the companion side panel — open Google Fonts from the Onshape right toolbar, type the text, pick a font, then click Insert there.";
const NOTES = [
  "Em-height controls the overall size — one em equals roughly the cap-to-baseline height of the font.",
  "Origin (optional vertex pick) is projected onto the sketch plane and becomes the (0, 0) of the text. Offset X / Y nudge from there.",
  "Rotation rotates the whole text around the (origin + offset) point.",
  "To change the text content, font, weight, or alignment after insertion, re-open the side panel and Insert a new feature — the existing feature's curve data is baked in.",
  "Free and open-source under PolyForm Noncommercial 1.0.0. Source: github.com/xfanta/onshape-fonts.",
];

// Wrap long strings to a max character count per line. Naive but good
// enough for the prose blocks; rsvg-convert doesn't word-wrap SVG text.
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line.length === 0) {
      line = w;
    } else if (line.length + 1 + w.length <= maxChars) {
      line += " " + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function tspans(lines, x, dy = "1.35em") {
  return lines.map((l, i) =>
    `<tspan x="${x}" ${i === 0 ? "" : `dy="${dy}"`}>${escape(l)}</tspan>`
  ).join("");
}
function escape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// === SVG ===
const charsPerLine = 60;                        // empirically tuned to col width @ 10pt
const descLines = wrap(DESCRIPTION, charsPerLine);
const preLines = wrap(PREREQUISITES, charsPerLine);
const notesLines = NOTES.map((n) => wrap(n, charsPerLine - 6));   // indent for list number

// Vertical cursor (mm)
let y = MARGIN + 4;

// Header (icon + title). Title sized to fit 'Google Fonts to Sketch'
// in the column width without bleeding into the right side.
const ICON_SIZE = 16;
const TITLE_SIZE = 8;
const headerY = y;
y = headerY + ICON_SIZE + 10;

const sections = [];

// Created by
sections.push({ title: "Created by:", lines: [CREATED_BY] });
sections.push({ title: "Description:", lines: descLines });
sections.push({ title: "Prerequisites:", lines: preLines });
sections.push({ title: "Notes:", notes: notesLines });

function sectionSvg(section, startY) {
  const SECTION_GAP = 5;
  const LINE_HEIGHT = 4.6;
  let cursor = startY;
  // Title (blue, underlined, bold)
  const titleEl = `<text x="${LEFT_X}" y="${cursor}" font-family="Helvetica, Arial, sans-serif" font-size="3.6" font-weight="700" fill="${BLUE}" text-decoration="underline">${section.title}</text>`;
  cursor += LINE_HEIGHT + 1;
  let bodyEl = "";
  if (section.notes) {
    // Numbered list
    section.notes.forEach((noteLines, idx) => {
      const num = `${idx + 1}.`;
      // First line: number + first wrapped line
      bodyEl += `<text x="${LEFT_X}" y="${cursor}" font-family="Helvetica, Arial, sans-serif" font-size="3.2" fill="${NOTE}">${escape(num)}</text>`;
      bodyEl += `<text x="${LEFT_X + 6}" y="${cursor}" font-family="Helvetica, Arial, sans-serif" font-size="3.2" fill="${NOTE}">${tspans(noteLines, LEFT_X + 6)}</text>`;
      cursor += noteLines.length * LINE_HEIGHT + 1.5;
    });
  } else {
    const lines = section.lines;
    bodyEl += `<text x="${LEFT_X}" y="${cursor}" font-family="Helvetica, Arial, sans-serif" font-size="3.2" fill="${TEXT}">${tspans(lines, LEFT_X)}</text>`;
    cursor += lines.length * LINE_HEIGHT;
  }
  cursor += SECTION_GAP;
  return { svg: titleEl + bodyEl, nextY: cursor };
}

let sectionsSvg = "";
let cy = y;
for (const s of sections) {
  const { svg, nextY } = sectionSvg(s, cy);
  sectionsSvg += svg;
  cy = nextY;
}

// === Right column visuals ===
// Top: panel screenshot (portrait, 1480×2368 native). Keep aspect.
const panelAspect = 2368 / 1480;     // ~1.6
const panelW = 55;                    // mm
const panelH = panelW * panelAspect;  // ~88 mm
const panelX = RIGHT_X;
const panelY = MARGIN + 4;

// Caption arrow + label pointing to panel
const panelCaptionX = panelX + panelW + 4;
const panelCaptionY = panelY + 10;

// Bottom: hero image (in-context, 5120×2630, aspect ~1.95)
const heroAspect = 2630 / 5120;
const heroW = COL_W;
const heroH = heroW * heroAspect;     // ~70 mm
const heroX = RIGHT_X;
const heroY = H - MARGIN - heroH;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F48635"/>
      <stop offset="100%" stop-color="#ed3338"/>
    </linearGradient>
  </defs>

  <!-- Page background -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- ===== LEFT COLUMN ===== -->
  <!-- Header: icon + title -->
  <g transform="translate(${LEFT_X}, ${headerY})">
    <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="2.5" ry="2.5" fill="url(#brand)"/>
    <g transform="translate(2, 2) scale(${(ICON_SIZE - 4) / 640})" fill="#ffffff">
      <path d="${LOGO_PATH}"/>
    </g>
    <text x="${ICON_SIZE + 5}" y="${ICON_SIZE * 0.78}"
          font-family="Helvetica, Arial, sans-serif"
          font-weight="700" font-size="${TITLE_SIZE}" fill="${BLUE}">${escape(TITLE)}</text>
  </g>

  ${sectionsSvg}

  <!-- ===== RIGHT COLUMN ===== -->
  <!-- Panel screenshot -->
  <g>
    <image x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}"
           href="${panelImg}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}"
          fill="none" stroke="#d6dbe2" stroke-width="0.2"/>
    <text x="${panelX + panelW / 2}" y="${panelY + panelH + 4}"
          text-anchor="middle"
          font-family="Helvetica, Arial, sans-serif"
          font-size="2.6" fill="${MUTED}">Companion side panel (web)</text>
  </g>

  <!-- Hero in-context image -->
  <g>
    <image x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}"
           href="${heroImg}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}"
          fill="none" stroke="#d6dbe2" stroke-width="0.2"/>
    <text x="${heroX + heroW / 2}" y="${heroY + heroH + 4}"
          text-anchor="middle"
          font-family="Helvetica, Arial, sans-serif"
          font-size="2.6" fill="${MUTED}">Panel open in an Onshape Part Studio — text inserted as native sketch curves</text>
  </g>

  <!-- Footer -->
  <text x="${W / 2}" y="${H - 4}"
        text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-size="2.6" fill="${MUTED}">
    onshape-fonts.xfanta.com · github.com/xfanta/onshape-fonts · PolyForm Noncommercial 1.0.0
  </text>
</svg>
`;

writeFileSync(OUT_SVG, svg);
execSync(`rsvg-convert -f pdf "${OUT_SVG}" -o "${OUT_PDF}"`);
console.log(`Built ${OUT_SVG} (${(svg.length / 1024).toFixed(1)} KB)`);
console.log(`Built ${OUT_PDF}`);
