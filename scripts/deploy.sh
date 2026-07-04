#!/usr/bin/env bash
# One-command Cloudflare Pages deploy for the "dui" project.
#
#   npm run deploy        # build + deploy
#   ./scripts/deploy.sh   # same
#
# Credentials live in the gitignored .cloudflare.env (CLOUDFLARE_API_TOKEN +
# CLOUDFLARE_ACCOUNT_ID).  They're sourced here so the token never appears on
# a command line / in shell history.  Deploys to dui-8hb.pages.dev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .cloudflare.env ]; then
  echo "✘ Missing .cloudflare.env (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)." >&2
  exit 1
fi
set -a; . ./.cloudflare.env; set +a

echo "▶ Building dist…"
rm -rf dist
./node_modules/.bin/vite build

echo "▶ Deploying to Cloudflare Pages (project: dui)…"
CI=1 WRANGLER_SEND_METRICS=false \
  npx --yes wrangler@3 pages deploy dist --project-name dui --branch main

echo "✓ Deployed → https://dui-8hb.pages.dev"
