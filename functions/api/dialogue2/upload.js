// POST /api/dialogue2/upload — "⬆ Upload new image" in the /dialogue2 image picker (owner 2026-11-23).
//
// Body: { passcode, name, data } — name like "opening-spud-3" (letters, digits, dashes), data = base64
// JPEG already shrunk in the browser (max 1800px). Saves it as "Story Playtest 2/images/<name>.jpg" on
// the story branch; that push starts .github/workflows/dialogue2-apply.yml, which turns it into web art
// and republishes /dialogue2. Same secrets as publish.js; nothing overwrites an existing image.
const REPO = 'BigMountainB/Roadtrip-Roulette';
const BRANCH = 'claude/lucid-fermi-21ue13';
const FOLDER = 'Story Playtest 2/images';
const MAX_B64 = 8_000_000;   // ~6 MB of image

const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.DIALOGUE_PASSCODE || !env.DIALOGUE_GH_TOKEN) return reply({ ok: false, error: 'Publishing isn’t set up yet.' }, 503);
  if (Number(request.headers.get('content-length') || 0) > MAX_B64 + 2000) return reply({ ok: false, error: 'That image is too large.' }, 413);
  let body;
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'Not a valid request.' }, 400); }
  if (!body || typeof body !== 'object' || !(await same(body.passcode ?? '', env.DIALOGUE_PASSCODE))) return reply({ ok: false, error: 'Wrong passcode.' }, 401);
  const name = String(body.name || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(name)) return reply({ ok: false, error: 'Bad image name.' }, 400);
  const data = String(body.data || '');
  if (!data || data.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return reply({ ok: false, error: 'Not an image.' }, 400);
  if (!data.startsWith('/9j/')) return reply({ ok: false, error: 'Expected a JPEG.' }, 400);   // JPEG magic bytes FF D8 FF

  const path = FOLDER + '/' + name + '.jpg';
  const url = 'https://api.github.com/repos/' + REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const headers = { authorization: 'Bearer ' + env.DIALOGUE_GH_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'rtr-dialogue2-upload', 'content-type': 'application/json' };
  const exists = await fetch(url + '?ref=' + encodeURIComponent(BRANCH), { headers });
  if (exists.status === 200) return reply({ ok: false, error: 'An image named ' + name + ' already exists.' }, 409);
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ message: 'Upload panel image ' + name + ' (dialogue2)', content: data, branch: BRANCH }) });
  if (!res.ok) return reply({ ok: false, error: 'GitHub refused the upload (' + res.status + ').' }, 502);
  return reply({ ok: true, name });
}
