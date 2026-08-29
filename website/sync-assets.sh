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

# Genre starter-vehicle sprites (front + back per culture) + the culture's
# 14 vice/item reskins (Genres page "Sprite Art" strip)
for d in "$SRC"/culture/*/; do
  g=$(basename "$d")
  if [ -d "$d/vehicles" ]; then
    mkdir -p "$DST/culture/$g"
    cp "$d"vehicles/*.png "$DST/culture/$g/"
  fi
  if [ -d "$d/vices" ]; then
    mkdir -p "$DST/culture/$g/vices"
    cp "$d"vices/*.png "$DST/culture/$g/vices/"
    rm -f "$DST/culture/$g/vices/slushie 2.png"   # stray dup in hiphop_phonk
  fi
done

# Press-page gallery: world (non-genre) art — the law, traffic, weapons,
# smashables, NPC portraits
mkdir -p "$DST/gallery/law" "$DST/gallery/traffic" "$DST/gallery/weapons" \
         "$DST/gallery/smashables" "$DST/gallery/people"
cp "$SRC"/cars/car_front_police.png "$SRC"/cars/car_front_swat.png \
   "$SRC"/cops/heli_1.png "$DST/gallery/law/"
for c in car_npc_hatchback_front car_npc_minivan_front car_npc_wagon_front \
         codex_semi_red_front codex_suv4x4_front codex_sports_car_front; do
  cp "$SRC/cars/codex/$c.png" "$DST/gallery/traffic/" 2>/dev/null || true
done
cp "$SRC"/weapons/*.png "$DST/gallery/weapons/"
cp "$SRC"/smashables/transparent-v2/*.png "$DST/gallery/smashables/"
cp "$SRC"/npc/*.png "$DST/gallery/people/"

# Genre card art + key UI art
cp "$SRC"/ui/music_genres/*.png "$DST/genre_art/"
cp "$SRC"/ui/title_screen.png "$SRC"/ui/loading_screen.png "$DST/ui/"

# Business logos (route-map stop expansions).  CarGo was cut from the game
# (owner directive 2026-07-28) and its art removed — keep this list in sync
# with the live business roster.
mkdir -p "$DST/businesses"
for b in huffs cowbellas aok lord suck gasnsip am_bm park-and-ride; do
  cp "$SRC/businesses/$b.png" "$DST/businesses/"
done

echo "website/assets synced from public/assets."
