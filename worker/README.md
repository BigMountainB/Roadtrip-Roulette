# Road Trip Roulette — backend Worker

Cloudflare Worker + D1 that gives the game:
- **Plate (username) uniqueness** — one player per name, enforced by a `UNIQUE`
  index on the normalized plate.
- **Cloud saves** — resume a run on another device.
- **World leaderboard** — score / miles / time boards.

The game already talks to this (`src/systems/CloudSave.js`); it just needs to be
deployed at the URL that file points to:
`https://roadtrip-api.<your-subdomain>.workers.dev`.

> ⚠️ Until this is deployed, plate uniqueness is NOT enforced — `claimPlate`
> treats an unreachable server as "allow", so two players can share a name.

## Deploy (one-time)

```sh
cd "worker"
npm i -g wrangler            # or use: npx wrangler ...
wrangler login

# 1) Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create rtr

# 2) Create the tables
wrangler d1 execute rtr --remote --file=schema.sql

# 3) Deploy the Worker
wrangler deploy
```

Confirm the deploy URL ends in `roadtrip-api.<your-subdomain>.workers.dev`. If your
subdomain isn't `brendanbaughn`, update `API_BASE` in
`../src/systems/CloudSave.js` to match, then redeploy the game.

## Quick test after deploy

```sh
# Should return {"ok":true,"available":true,"mine":false}
curl "https://roadtrip-api.<sub>.workers.dev/api/plate?plate=TESTONE&playerId=p1"

# Claim it, then re-check with a DIFFERENT playerId -> available:false
curl -X PUT -H 'content-type: application/json' \
  -d '{"playerId":"p1","plate":"TESTONE"}' \
  "https://roadtrip-api.<sub>.workers.dev/api/plate"
curl "https://roadtrip-api.<sub>.workers.dev/api/plate?plate=TESTONE&playerId=p2"
```

## Endpoints (contract, matches CloudSave.js)

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| PUT | `/api/save` | `{playerId, plate, snapshot, score, position}` | `{ok}` |
| GET | `/api/save` | `?playerId=` | `{ok, save}` |
| GET | `/api/plate` | `?plate=&playerId=` | `{ok, available, mine}` |
| PUT | `/api/plate` | `{playerId, plate}` | `{ok, plate}` or `{ok:false, error:'taken'}` |
| PUT | `/api/leaderboard` | `{playerId, plate, score, miles, timeSec, completed}` | `{ok}` |
| GET | `/api/leaderboard` | `?metric=score\|miles\|time&limit=` | `{ok, entries}` |

Plate collisions are checked on `plate_norm` = uppercase, alphanumeric-only, ≤8
chars — so `B-ob`, `BOB`, and `bob` all count as the same name.
