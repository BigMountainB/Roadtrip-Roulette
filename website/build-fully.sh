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
rm -rf dist
npx vite build

echo "Refreshing website/fully/..."
rm -rf website/fully
mkdir -p website/fully
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

rm -rf dist
echo "website/fully/ refreshed. Size: $(du -sh website/fully | cut -f1)"
