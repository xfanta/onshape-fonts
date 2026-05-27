#!/bin/bash
# Build the animated SVG used as Onshape App Store summary image.
#
# Composition (350 × 197):
#   - Top header strip: brand logo + wordmark, divider line below
#   - Middle: word "Hello" rendered as STROKED OUTLINES (no fill) over a
#     CAD-style sketch grid, cycling between 3 fonts every 2 s
#   - Bottom caption: "1,900+ GOOGLE FONTS or CUSTOM .otf/.ttf FONT"
#
# Each font is subsetted to just the characters in the word and
# inlined as base64 woff2 (~1 KB each). Text rendered as text element
# with stroke+nofill so it reads like the actual SketchViewer output.
#
# Total SVG: ~8 KB. Re-run from repo root.

set -e

WORD="Hello"
OUT="$(cd "$(dirname "$0")/.." && pwd)/design/appstore-summary-animated.svg"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

fetch_font() {
  local id=$1 family=$2
  local url="https://fonts.googleapis.com/css2?family=${family}&text=${WORD}&display=swap"
  local woff
  woff=$(curl -s -A "$UA" "$url" | grep -oE 'https://fonts\.gstatic\.com/[^)]+' | head -1)
  if [ -z "$woff" ]; then
    echo "Failed to fetch CSS for $family" >&2
    exit 1
  fi
  curl -s -A "$UA" -o "/tmp/${id}.woff2" "$woff"
}

fetch_font playfair 'Playfair+Display:ital,wght@1,700'
fetch_font lobster  'Lobster'
fetch_font roboto   'Roboto:wght@700'

PLAYFAIR=$(base64 < /tmp/playfair.woff2 | tr -d '\n')
LOBSTER=$(base64 < /tmp/lobster.woff2 | tr -d '\n')
ROBOTO=$(base64 < /tmp/roboto.woff2 | tr -d '\n')

# Brand logo path (from design/logo-mark-only.svg, scaled inline).
# Same glyph used in the header on the website.
LOGO_PATH='M200 64C213.3 64 224 74.7 224 88L224 144L360 144C373.3 144 384 154.7 384 168C384 181.3 373.3 192 360 192L343.8 192L327.3 230.4C308.7 273.9 282.1 313.2 249.4 346.4C263.3 355.6 278 363.8 293.4 370.8L354.3 398.7L426.1 238.2C430 229.6 438.5 224 448 224C457.5 224 466 229.6 469.9 238.2L605.9 542.2C611.3 554.3 605.9 568.5 593.8 573.9C581.7 579.3 567.5 573.9 562.1 561.8L532.7 496L363.4 496L334 561.8C328.6 573.9 314.4 579.3 302.3 573.9C290.2 568.5 284.8 554.3 290.2 542.2L334.8 442.5L273.5 414.4C252 404.5 231.6 392.7 212.6 379.2C195.1 392.8 176.3 404.9 156.4 415.3L99.1 445.3C87.4 451.5 72.9 446.9 66.7 435.2C60.5 423.5 65.1 409 76.8 402.8L134 372.8C148 365.5 161.4 357.1 174.1 348C146.6 322.4 123 292.8 104.1 260C97.5 248.5 101.4 233.8 112.9 227.2C124.4 220.6 139.1 224.5 145.7 236C163.1 266.3 185.2 293.5 211.1 316.7C241.6 286.9 266.2 251.2 283.3 211.4L291.6 192L56 192C42.7 192 32 181.3 32 168C32 154.7 42.8 144 56 144L176 144L176 88C176 74.7 186.7 64 200 64zM511.2 448L448 306.8L384.8 448L511.2 448z'

cat > "$OUT" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 197" width="350" height="197">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair';
        font-style: italic;
        font-weight: 700;
        src: url(data:font/woff2;base64,${PLAYFAIR}) format('woff2');
      }
      @font-face {
        font-family: 'Lobster';
        font-weight: 400;
        src: url(data:font/woff2;base64,${LOBSTER}) format('woff2');
      }
      @font-face {
        font-family: 'Roboto';
        font-weight: 700;
        src: url(data:font/woff2;base64,${ROBOTO}) format('woff2');
      }
      .w-playfair { animation: cycA 6s infinite; }
      .w-lobster  { animation: cycB 6s infinite; }
      .w-roboto   { animation: cycC 6s infinite; }
      @keyframes cycA {
        0%, 30%      { opacity: 1; }
        37%, 96%     { opacity: 0; }
        100%         { opacity: 1; }
      }
      @keyframes cycB {
        0%, 30%      { opacity: 0; }
        37%, 63%     { opacity: 1; }
        70%, 100%    { opacity: 0; }
      }
      @keyframes cycC {
        0%, 63%      { opacity: 0; }
        70%, 96%     { opacity: 1; }
        100%         { opacity: 0; }
      }
    </style>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F48635"/>
      <stop offset="100%" stop-color="#ed3338"/>
    </linearGradient>
    <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#eaedf2" stroke-width="0.7"/>
    </pattern>
  </defs>

  <!-- ===== Background ===== -->
  <rect width="350" height="197" fill="#ffffff"/>

  <!-- ===== Header ===== -->
  <g>
    <rect x="0" y="0" width="350" height="30" fill="#ffffff"/>
    <!-- Logo tile -->
    <g transform="translate(10, 6)">
      <rect width="18" height="18" rx="4" ry="4" fill="url(#brand)"/>
      <g transform="translate(3, 3) scale(0.01875)" fill="#ffffff">
        <path d="${LOGO_PATH}"/>
      </g>
    </g>
    <!-- Wordmark -->
    <text x="34" y="19" xml:space="preserve"
          font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif"
          font-weight="600" font-size="11.5" fill="#0f1216"
          >Google Fonts <tspan font-weight="400" fill="#94a0b0">for Onshape</tspan></text>
    <!-- Divider line -->
    <line x1="0" y1="30" x2="350" y2="30" stroke="#eef1f5" stroke-width="0.7"/>
  </g>

  <!-- ===== Sketch grid stage ===== -->
  <g>
    <rect x="0" y="30" width="350" height="138" fill="#fdfbf8"/>
    <rect x="0" y="30" width="350" height="138" fill="url(#grid)"/>
    <!-- Origin cross -->
    <line x1="0"   y1="125" x2="350" y2="125" stroke="#cbd5e1" stroke-width="0.6"/>
    <line x1="175" y1="40"  x2="175" y2="160" stroke="#cbd5e1" stroke-width="0.6"/>
  </g>

  <!-- ===== Word stack — stroked outlines, no fill (looks like sketch curves) ===== -->
  <g text-anchor="middle" font-size="78" fill="none" stroke="#1189e3" stroke-width="1.6"
     stroke-linejoin="round" stroke-linecap="round" letter-spacing="-1">
    <text class="w-playfair" opacity="1" x="175" y="142"
          font-family="Playfair, Georgia, serif" font-style="italic" font-weight="700">${WORD}</text>
    <text class="w-lobster"  opacity="0" x="175" y="142"
          font-family="Lobster, 'Brush Script MT', cursive">${WORD}</text>
    <text class="w-roboto"   opacity="0" x="175" y="142"
          font-family="Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="700">${WORD}</text>
  </g>

  <!-- ===== Bottom caption ===== -->
  <g>
    <rect x="0" y="168" width="350" height="29" fill="#ffffff"/>
    <line x1="0" y1="168" x2="350" y2="168" stroke="#eef1f5" stroke-width="0.7"/>
    <text x="175" y="186" text-anchor="middle" xml:space="preserve"
          font-family="-apple-system, 'SF Mono', Menlo, monospace"
          font-size="9" font-weight="500" letter-spacing="1.4" fill="#4a5260"
          >1,900+ GOOGLE FONTS <tspan fill="#94a0b0">or</tspan> CUSTOM .otf/.ttf FONT</text>
  </g>
</svg>
SVG

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
echo "Preview: open design/appstore-summary-animated.preview.html"
