#!/bin/sh
# Build the DEMO game bundle (website/demo/) from current local source.
#
# The demo previously went stale — it was built + curated by hand once
# (2026-07-27) and never refreshed, so 3+ days of scenery/biome/mission work
# landed only in the main game while the embedded demo kept shipping old
# assets. Missing textures (esp. the new scenery/ biome backdrops added
# after the original curation) render as a neon-green placeholder grid —
# BootScene's synthesized fallback for any manifest key whose file 404s.
#
# This script rebuilds + re-curates from scratch every time, so the demo
# can never drift out of sync silently again.
#
#   cd website && sh build-demo.sh
set -e
cd "$(dirname "$0")/.."   # repo root

echo "Building demo bundle (VITE_DEMO=1)..."
rm -rf dist-demo
VITE_DEMO=1 npx vite build --outDir dist-demo

echo "Refreshing website/demo/..."
rm -rf website/demo/assets
mkdir -p website/demo/assets
cp dist-demo/index.html website/demo/index.html
cp dist-demo/assets/*.js website/demo/assets/

# Asset categories the demo route (West Seattle -> Snoqualmie, mile 25) can
# actually reach, copied WHOLESALE (not hand-picked subfolders) so a future
# asset addition can't silently go missing again the way scenery/ did.
# music/ and culture/ are genre-gated (DEMO_GENRES in constants.js) so only
# those two genres are copied -- by far the biggest size win, and safe
# because the demo build can only select those two genres at all.
for cat in scenery buildings businesses cars cops npc smashables trees ui vices weapons; do
  if [ -d "dist-demo/assets/$cat" ]; then
    cp -R "dist-demo/assets/$cat" "website/demo/assets/$cat"
  fi
done
for genre in country hiphop_phonk; do
  mkdir -p website/demo/assets/music website/demo/assets/culture
  [ -d "dist-demo/assets/music/$genre" ]   && cp -R "dist-demo/assets/music/$genre"   "website/demo/assets/music/$genre"
  [ -d "dist-demo/assets/culture/$genre" ] && cp -R "dist-demo/assets/culture/$genre" "website/demo/assets/culture/$genre"
done

rm -rf dist-demo
echo "website/demo/ refreshed. Size: $(du -sh website/demo | cut -f1)"
