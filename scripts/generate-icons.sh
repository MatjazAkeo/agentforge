#!/usr/bin/env bash
# Regenerate the entire icon matrix from src-tauri/icons-source/logo.svg.
# Outputs into src-tauri/icons/ (the directory tauri.conf.json reads from).
#
# Required tools (all macOS-native or Homebrew):
#   - rsvg-convert (Homebrew: librsvg)
#   - iconutil (macOS native)
#   - magick (Homebrew: imagemagick)
#
# Run: bash scripts/generate-icons.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Two source SVGs:
#   - icon.svg: full-bleed squircle background — for Tauri app icons (.icns / .ico /
#     platform PNGs). Modern macOS doesn't auto-mask icons, so the background is baked in.
#   - logo.svg: bare logo on transparency — for marketing (hero, social card, 1024 master).
ICON_SVG="$ROOT/src-tauri/icons-source/icon.svg"
LOGO_SVG="$ROOT/src-tauri/icons-source/logo.svg"
OUT="$ROOT/src-tauri/icons"

for f in "$ICON_SVG" "$LOGO_SVG"; do
  if [[ ! -f "$f" ]]; then
    echo "error: $f not found"
    exit 1
  fi
done

for cmd in rsvg-convert iconutil magick; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required tool '$cmd' not on PATH"
    exit 1
  fi
done

mkdir -p "$OUT"

# render <size> <outpath> [logo|icon]   default = icon
render() {
  local size="$1" outpath="$2" src="${3:-icon}"
  local svg
  if [[ "$src" == "logo" ]]; then svg="$LOGO_SVG"; else svg="$ICON_SVG"; fi
  rsvg-convert --width "$size" --height "$size" -o "$outpath" "$svg"
}

echo "→ rendering Tauri base PNGs"
render 32   "$OUT/32x32.png"
render 128  "$OUT/128x128.png"
render 256  "$OUT/128x128@2x.png"
render 512  "$OUT/icon.png"

echo "→ rendering Microsoft Store / Windows tile PNGs"
for size in 30 44 71 89 107 142 150 284 310; do
  render "$size" "$OUT/Square${size}x${size}Logo.png"
done
render 50 "$OUT/StoreLogo.png"

echo "→ building macOS .icns via iconutil"
TMP_ICONSET="$(mktemp -d)/icon.iconset"
mkdir -p "$TMP_ICONSET"
render 16    "$TMP_ICONSET/icon_16x16.png"
render 32    "$TMP_ICONSET/icon_16x16@2x.png"
render 32    "$TMP_ICONSET/icon_32x32.png"
render 64    "$TMP_ICONSET/icon_32x32@2x.png"
render 128   "$TMP_ICONSET/icon_128x128.png"
render 256   "$TMP_ICONSET/icon_128x128@2x.png"
render 256   "$TMP_ICONSET/icon_256x256.png"
render 512   "$TMP_ICONSET/icon_256x256@2x.png"
render 512   "$TMP_ICONSET/icon_512x512.png"
render 1024  "$TMP_ICONSET/icon_512x512@2x.png"
iconutil --convert icns "$TMP_ICONSET" --output "$OUT/icon.icns"
rm -rf "$TMP_ICONSET"

echo "→ building Windows .ico via ImageMagick"
TMP_ICODIR="$(mktemp -d)"
for size in 16 24 32 48 64 128 256; do
  render "$size" "$TMP_ICODIR/${size}.png"
done
magick "$TMP_ICODIR"/{16,24,32,48,64,128,256}.png "$OUT/icon.ico"
rm -rf "$TMP_ICODIR"

# Marketing assets land under .github/assets/ (tracked alongside the existing
# README screenshot). docs/ is gitignored so anything we want in the public
# repo lives here.
ASSETS="$ROOT/.github/assets"
mkdir -p "$ASSETS"
echo "→ rendering 1024 master PNG to .github/assets/"
render 1024 "$ASSETS/logo-1024.png" logo

# README hero (1280x400) and GitHub social card (1280x640).
# Composed with ImageMagick: dark background + logo + wordmark + tagline.
FONT_BOLD="/System/Library/Fonts/HelveticaNeue.ttc"
FONT_REG="/System/Library/Fonts/HelveticaNeue.ttc"
TAGLINE="Visual node-based AI agent playground"

if [[ -f "$FONT_BOLD" ]]; then
  echo "→ composing README hero (1280x400)"
  TMP_LOGO_HERO="$(mktemp -t logo-hero).png"
  render 280 "$TMP_LOGO_HERO" logo
  # Logo card: 320x320 rounded rect at (60,40)-(380,360), logo padded 20px inside.
  magick -size 1280x400 xc:"#0d0f12" \
    -fill "#15181d" -stroke "#2a2f37" -strokewidth 1 \
    -draw "roundrectangle 60,40 380,360 24,24" \
    "$TMP_LOGO_HERO" -gravity NorthWest -geometry +80+60 -composite \
    -font "$FONT_BOLD" -pointsize 78 -fill "#e8eaed" -gravity West -annotate +440-22 "AgentForge" \
    -font "$FONT_REG"  -pointsize 22 -fill "#8a929c" -gravity West -annotate +444+38 "$TAGLINE" \
    "$ASSETS/hero.png"
  rm -f "$TMP_LOGO_HERO"

  echo "→ composing GitHub social card (1280x640)"
  TMP_LOGO_SOCIAL="$(mktemp -t logo-social).png"
  render 360 "$TMP_LOGO_SOCIAL" logo
  # Logo card: 400x400 rounded rect centered horizontally, top portion of canvas.
  magick -size 1280x640 xc:"#0d0f12" \
    -fill "#15181d" -stroke "#2a2f37" -strokewidth 1 \
    -draw "roundrectangle 440,40 840,440 28,28" \
    "$TMP_LOGO_SOCIAL" -gravity Center -geometry +0-80 -composite \
    -font "$FONT_BOLD" -pointsize 96 -fill "#e8eaed" -gravity Center -annotate +0+170 "AgentForge" \
    -font "$FONT_REG"  -pointsize 26 -fill "#8a929c" -gravity Center -annotate +0+232 "$TAGLINE" \
    "$ASSETS/social-card.png"
  rm -f "$TMP_LOGO_SOCIAL"
else
  echo "(skipping hero/social card — system font not found)"
fi

echo "✓ done. Icons regenerated in $OUT, marketing assets in $ASSETS"
