#!/bin/sh
# Build the FULL GAME bundle (website/fully/) from current local source.
#
# Mirrors build-demo.sh. Same staleness risk applies here: website/fully/ was
# hand-built once (2026-07-27) and not refreshed since, so any commit after
# that date (scenery, shop greeters, storefront art, etc.) shipped to /demo
# but not to /fully until this script exists. Rebuild + redeploy after any
# asset/manifest change that should reach the live full game.
#
# Two patches are applied on top of the plain `vite build` output, per
# Overview.md Chapter 2 "Deploy conflict": vite builds with base:'./', so at
# /fully WITHOUT a trailing slash every asset resolves against the site root
# and 404s, and public/manifest.webmanifest is root-scoped (start_url '/',
# icon '/icons/...') which points at nothing under /fully.
#
#   cd website && sh build-fully.sh
set -e
cd "$(dirname "$0")/.."   # repo root

echo "Building full-game bundle..."
# Clear CONTENTS only — `rm -rf dist` deleted the dir itself, which nuked the
# iCloud-nosync SYMLINK (see commit 9114a5d) and let the 676M build output
# rematerialize as a real, iCloud-synced folder on the very next deploy —
# resurrecting the `name 2.ext` conflict-copy problem the symlink existed to
# kill.  find-delete keeps the dir/symlink node itself intact.
if [ -d dist ]; then find dist/ -mindepth 1 -delete; fi
npx vite build

echo "Refreshing website/fully/..."
# Same rule as dist: never delete the dir node, only its contents
# (build-demo.sh always did it this way, which is why demo's symlink survived).
mkdir -p website/fully
find website/fully/ -mindepth 1 -delete
cp -R dist/. website/fully/

# Patch 1: inject <base href="/fully/"> right after <head>.
perl -0pi -e 's/<head>/<head>\n<base href="\/fully\/">/' website/fully/index.html

# Patch 2: rewrite manifest.webmanifest to be /fully-scoped.
cat > website/fully/manifest.webmanifest << 'EOF'
{
  "name": "Road Trip Roulette",
  "short_name": "Road Trip",
  "description": "Survive the road trip from Seattle to Pullman.",
  "start_url": "/fully/",
  "scope": "/fully/",
  "display": "fullscreen",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/fully/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
EOF

# Post-copy space free: contents only, keep the dir/symlink node (see above).
find dist/ -mindepth 1 -delete
echo "website/fully/ refreshed. Size: $(du -sh website/fully | cut -f1)"
