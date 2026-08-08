#!/usr/bin/env bash
# One-command Cloudflare Pages deploy for ROAD TRIP ROULETTE.
#
#   npm run deploy        # rebuild /demo + /fully, deploy website/ to Pages
#   ./scripts/deploy.sh   # same
#
# ⚠️ History (2026-08-04): this script was inherited from the DUI fork and
# deployed `dist` to the DUI Pages project — running it would have overwritten
# the DUI game with RTR's build.  It now performs the documented RTR path from
# "Road Trip Roulette Overview.md" Chapter 2:
#
#   1. website/build-demo.sh   — full rebuild of the /demo game bundle
#   2. website/build-fully.sh  — full rebuild of the /fully game bundle
#   3. wrangler pages deploy website → project "roadtrip-roulette"
#
# The marketing site stays at the root; the game lands at /demo and /fully with
# their <base>/manifest patches applied by the build scripts.  Do NOT deploy
# `dist` to this project and do NOT rely on the GitHub Action — as of
# 2026-07-31 CI is broken AND wired to clobber the site (see Chapter 2).
#
# Credentials: RTR-local .cloudflare.env if present, else ../DUI/.cloudflare.env
# (account-scoped token, verified working for this project).  Sourced, never on
# a command line.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .cloudflare.env ]; then
  ENV_FILE=".cloudflare.env"
elif [ -f ../DUI/.cloudflare.env ]; then
  ENV_FILE="../DUI/.cloudflare.env"
else
  echo "✘ No .cloudflare.env here or in ../DUI (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)." >&2
  exit 1
fi
set -a; . "$ENV_FILE"; set +a

echo "▶ Rebuilding website/demo…"
( cd website && sh build-demo.sh )

echo "▶ Rebuilding website/fully…"
( cd website && sh build-fully.sh )

echo "▶ Deploying website/ to Cloudflare Pages (project: roadtrip-roulette)…"
CI=1 WRANGLER_SEND_METRICS=false \
  npx --yes wrangler@3 pages deploy website --project-name roadtrip-roulette \
  --branch main --commit-dirty=true

echo "✓ Deployed → https://roadtrip-roulette.pages.dev  (root site · /demo · /fully)"
