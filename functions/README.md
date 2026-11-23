# Cloudflare Pages functions

Deployed with the site by `wrangler pages deploy website` (run from the repo root, so this
`functions/` folder is picked up). Only the routes below run code; every other page is static.

| Route | File | What it does |
| --- | --- | --- |
| `POST /api/dialogue2/publish` | `api/dialogue2/publish.js` | The /dialogue2 **⇪ Publish my edits** button. Checks the passcode, then commits the browser's edits as JSON to `art-source/reunion-playtest/inbox/` on `claude/lucid-fermi-21ue13`, which starts `.github/workflows/dialogue2-apply.yml` there (applies the edits, rebuilds, redeploys /dialogue2). |
| `POST /api/dialogue2/upload` | `api/dialogue2/upload.js` | **⬆ Upload new image** in the /dialogue2 image picker. Checks the same passcode, then saves the (browser-shrunk) JPEG as `Story Playtest 2/images/<chapter>-<panel>-<n>.jpg` on `claude/lucid-fermi-21ue13`; never overwrites. That push starts the same workflow, which turns it into web art and redeploys /dialogue2. |

Secrets (Cloudflare Pages, production): `DIALOGUE_PASSCODE`, `DIALOGUE_GH_TOKEN`. They are copied
from the GitHub repository secrets of the same names by `.github/workflows/cloudflare-pages.yml`
on every deploy of this branch. The token never reaches the browser.
