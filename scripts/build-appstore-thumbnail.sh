#!/bin/bash
# Build the animated SVG used as Onshape App Store summary image.
#
# How it works:
#   1. Fetch the smallest possible woff2 for each font, subset to the
#      word "Hello" (~1 KB per font instead of 30-100 KB full file).
#   2. Inline each woff2 as a base64 data: URI inside @font-face.
#   3. Stack three <text> elements at the same coords, cycle opacity
#      with CSS @keyframes so the word morphs between fonts every 2 s.
#
# Total SVG: ~8 KB. Animation runs in any modern browser, including
# when Onshape uses the file as background-image (no JS needed).
#
# Re-run from repo root:  bash scripts/build-appstore-thumbnail.sh
#
# To change the word: edit WORD below + the three <text> elements.
# To change fonts: edit the SPECS list (Google Fonts family + variant).

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
      .anchor { animation: pulse 2.4s ease-in-out infinite; }
      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50%      { opacity: 1; }
      }
    </style>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F48635"/>
      <stop offset="100%" stop-color="#ed3338"/>
    </linearGradient>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eaedf2" stroke-width="0.8"/>
    </pattern>
  </defs>

  <rect width="350" height="197" fill="#fdfbf8"/>
  <rect width="350" height="197" fill="url(#grid)"/>

  <line x1="0" y1="118" x2="350" y2="118" stroke="#cbd5e1" stroke-width="0.7"/>
  <line x1="175" y1="20" x2="175" y2="180" stroke="#cbd5e1" stroke-width="0.7"/>

  <g text-anchor="middle" font-size="88" fill="url(#brand)" letter-spacing="-1">
    <text class="w-playfair" opacity="1" x="175" y="142"
          font-family="Playfair, Georgia, serif" font-style="italic" font-weight="700">${WORD}</text>
    <text class="w-lobster"  opacity="0" x="175" y="142"
          font-family="Lobster, 'Brush Script MT', cursive">${WORD}</text>
    <text class="w-roboto"   opacity="0" x="175" y="142"
          font-family="Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="700">${WORD}</text>
  </g>

  <g fill="#1189e3" stroke="#ffffff" stroke-width="1">
    <circle class="anchor" cx="103" cy="80" r="2.5"/>
    <circle class="anchor" cx="143" cy="142" r="2.5" style="animation-delay:0.3s"/>
    <circle class="anchor" cx="175" cy="60" r="2.5" style="animation-delay:0.6s"/>
    <circle class="anchor" cx="218" cy="142" r="2.5" style="animation-delay:0.9s"/>
    <circle class="anchor" cx="247" cy="80" r="2.5" style="animation-delay:1.2s"/>
  </g>

  <text x="175" y="182" text-anchor="middle"
        font-family="-apple-system, 'SF Mono', Menlo, monospace"
        font-size="8" letter-spacing="2" fill="#94a0b0">
    1,900+ FONTS · NATIVE SKETCH CURVES
  </text>
</svg>
SVG

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
echo "Preview: open design/appstore-summary-animated.preview.html"
