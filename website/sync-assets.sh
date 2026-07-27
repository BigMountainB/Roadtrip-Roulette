#!/bin/sh
# Sync the website's derived assets from the game's source of truth
# (public/assets). website/assets/ is GITIGNORED — run this after cloning
# or whenever game assets change, and again before deploying the site.
#
#   cd website && sh sync-assets.sh
set -e
cd "$(dirname "$0")"
SRC="../public/assets"
DST="assets"

mkdir -p "$DST/music" "$DST/culture" "$DST/genre_art" "$DST/ui"

# Full soundtrack (all genre folders, full tracks per owner decision 2026-07-26)
for d in "$SRC"/music/*/; do
  g=$(basename "$d")
  mkdir -p "$DST/music/$g"
  cp "$d"*.mp3 "$DST/music/$g/" 2>/dev/null || true
done

# Genre starter-vehicle sprites (front + back per culture)
for d in "$SRC"/culture/*/; do
  g=$(basename "$d")
  if [ -d "$d/vehicles" ]; then
    mkdir -p "$DST/culture/$g"
    cp "$d"vehicles/*.png "$DST/culture/$g/"
  fi
done

# Genre card art + key UI art
cp "$SRC"/ui/music_genres/*.png "$DST/genre_art/"
cp "$SRC"/ui/title_screen.png "$SRC"/ui/loading_screen.png "$DST/ui/"

echo "website/assets synced from public/assets."
