#!/bin/bash

set -e

ICON_DIR="src-tauri/icons"
SRC="$ICON_DIR/icon.png"

if [ ! -f "$SRC" ]; then
  echo "找不到 $SRC，请把 icon.png 放在 src-tauri/icons/ 下"
  exit 1
fi

echo "使用 $SRC 生成所有 Tauri 图标..."

cd "$ICON_DIR"

# ---------- PNG 必需尺寸 ----------
echo "生成 PNG 尺寸..."

magick icon.png -resize 32x32  -define png:color-type=6 32x32.png
magick icon.png -resize 128x128 -define png:color-type=6 128x128.png
magick icon.png -resize 256x256 -define png:color-type=6 128x128@2x.png

# ---------- 生成 ICO（包含多个尺寸） ----------
echo "生成 icon.ico..."

magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# ---------- 生成 ICNS ----------
echo "生成 icon.icns..."

mkdir -p icon.iconset

magick icon.png -resize 16x16   icon.iconset/icon_16x16.png
magick icon.png -resize 32x32   icon.iconset/icon_16x16@2x.png
magick icon.png -resize 32x32   icon.iconset/icon_32x32.png
magick icon.png -resize 64x64   icon.iconset/icon_32x32@2x.png
magick icon.png -resize 128x128 icon.iconset/icon_128x128.png
magick icon.png -resize 256x256 icon.iconset/icon_128x128@2x.png
magick icon.png -resize 256x256 icon.iconset/icon_256x256.png
magick icon.png -resize 512x512 icon.iconset/icon_256x256@2x.png
magick icon.png -resize 512x512 icon.iconset/icon_512x512.png
magick icon.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png

iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

echo "图标全部生成完毕！"
