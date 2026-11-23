// POST /api/dialogue2/publish — the /dialogue2 "Publish my edits" button (owner 2026-11-22).
//
// Receives the browser's saved edits plus a passcode and commits them as one JSON file to
// art-source/reunion-playtest/inbox/ on the story branch. That push starts the GitHub Action
// .github/workflows/dialogue2-apply.yml, which writes the edits into the script, rebuilds
// /dialogue2 and redeploys it (only /dialogue2 changes).
//
// Cloudflare Pages secrets (set by the deploy workflow from GitHub repository secrets):
//   DIALOGUE_PASSCODE   what the owner types the first time they press the button
//   DIALOGUE_GH_TOKEN   fine-grained GitHub token, this repo only, Contents: read and write
// The token never reaches the browser.
const REPO = 'BigMountainB/Roadtrip-Roulette';
const BRANCH = 'claude/lucid-fermi-21ue13';
const INBOX = 'art-source/reunion-playtest/inbox';
const MAX_BYTES = 400_000;

const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// Compare without leaking how much of the passcode matched.
async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function countChanges(edits, adds) {
  let n = 0;
  for (const m of Object.values(edits)) if (isObj(m)) n += Object.keys(m).length;
  for (const l of Object.values(adds)) if (Array.isArray(l)) n += l.length;
  return n;
}

export async function onRequestPost({ request, env }) {
  if (!env.DIALOGUE_PASSCODE || !env.DIALOGUE_GH_TOKEN) return reply({ ok: false, error: 'Publishing isn’t set up yet.' }, 503);
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return reply({ ok: false, error: 'Too many edits in one go.' }, 413);
  let body;
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'Not a valid request.' }, 400); }
  if (!isObj(body) || !(await same(body.passcode ?? '', env.DIALOGUE_PASSCODE))) return reply({ ok: false, error: 'Wrong passcode.' }, 401);
  const edits = isObj(body.edits) ? body.edits : {}, adds = isObj(body.adds) ? body.adds : {};
  const changes = countChanges(edits, adds);
  if (!changes) return reply({ ok: false, error: 'No edits to publish.' }, 400);

  const sentAt = new Date().toISOString();
  const file = JSON.stringify({ version: String(body.version ?? ''), sentAt, edits, adds }, null, 1) + '\n';
  if (file.length > MAX_BYTES) return reply({ ok: false, error: 'Too many edits in one go.' }, 413);
  const name = sentAt.replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8) + '.json';
  const path = INBOX + '/' + name;
  const res = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'PUT',
    headers: {
      authorization: 'Bearer ' + env.DIALOGUE_GH_TOKEN,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'rtr-dialogue2-publish',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: 'Publish my edits (dialogue2): ' + changes + ' change' + (changes === 1 ? '' : 's'), content: base64(file), branch: BRANCH }),
  });
  if (!res.ok) return reply({ ok: false, error: 'GitHub refused the save (' + res.status + '). Nothing was published.' }, 502);
  return reply({ ok: true, changes, file: name });
}
