/**
 * COMIC phone app — vertical reader + local page renderer (Ch. 18.1 / 18.3).
 *
 * Mounted into the phone menu's shared app modal (#phone-app), which is
 * already inside the paused phone menu — no pause state of its own.  Pure
 * DOM + <canvas>: every page is REDRAWN from ComicSystem's compact events
 * and the static panel metadata (no stored image blobs).  `renderPage` is
 * the one drawing routine — Phase 7's PDF export packages the same canvases.
 *
 * What the reader shows
 *   • a volume picker (every past volume for this plate + the open one)
 *   • CHAPTER headers per trip, pages in order, newest at the bottom
 *   • TO BE CONTINUED on an open volume, THE END on a closed one
 *   • EXPORT PDF (armed in Phase 7)
 *
 * Panel art: PANEL_META[key].art when present (loaded once, page redrawn),
 * else a placeholder painted from the speaker name + scene label.
 */

import { PAGE_W, PAGE_H, panelMeta } from '../data/comicPanels.js';
import { LETTERING, splitByCap } from './StoryTile.js';
import { getStoryNode } from '../data/featuredStories.js';
import { layoutBalloon, migrateZones } from './balloonLayout.js';
import { unit, padding, strokeFor, bodyShape, tailShape, connectorShape, dashOutline, seedFor } from './balloonShapes.js';
import { buildPdf, PAGE_SIZES } from './ComicPdf.js';

// Export page pixel size (A-series aspect); JPEG quality.  ~150 dpi on A4.
const EXPORT_W = 1240, EXPORT_H = Math.round(EXPORT_W * PAGE_H / PAGE_W), EXPORT_Q = 0.86;
const SIZE_KEY = 'rtr.comic.pageSize';   // per-device preference (A4 default)

const PAPER = '#F6F1E4';
const INK   = '#141414';
// ── Decoded-art cache: BOUNDED (owner 2026-09-07) ─────────────────────────
// The comic saves only compact events — story/node/choice ids, panelKey,
// dialogue keys + fallback copy.  No image data is ever persisted, so the book
// is rebuilt from `panelKey` → file each time it is opened.  That part was
// always right; what leaked was the DECODED side.
//
// A panel decodes to width x height x 4 regardless of how small its PNG is —
// ~6.0 MB for a 1672x941 — and this cache used to be an unbounded module-level
// Map that every page in a volume filled on open, then never released.  A long
// volume could hold hundreds of MB of decoded images for the life of the page,
// which is the retention class behind the iPhone terminations.
//
// Now: a small LRU, plus explicit release when the reader closes.  Original
// files stay installed with the game; only decoded bitmaps are evicted.
const ART_CACHE_MAX = 6;      // ≈36 MB decoded at 1672x941 — current page ± neighbours
const artCache = new Map();   // path → HTMLImageElement | null (failed).  Insertion order = LRU.

function artTouch(path) {     // mark most-recently-used
  if (!artCache.has(path)) return;
  const v = artCache.get(path);
  artCache.delete(path); artCache.set(path, v);
}

function artTrim(max = ART_CACHE_MAX) {
  while (artCache.size > max) {
    const oldest = artCache.keys().next().value;
    if (oldest === undefined) break;
    const img = artCache.get(oldest);
    artCache.delete(oldest);
    // Drop the decoder's reference so the bitmap can be collected.
    try { if (img) img.src = ''; } catch (_) {}
  }
}

/** Release every decoded panel.  Call when the reader closes — the comic
 *  itself is untouched, since it re-renders from the saved events. */
export function releaseComicArt() {
  for (const img of artCache.values()) { try { if (img) img.src = ''; } catch (_) {} }
  artCache.clear();
}

function loadArt(path, onReady) {
  if (!path) return null;
  if (artCache.has(path)) { artTouch(path); return artCache.get(path); }
  const img = new Image();
  artCache.set(path, null);
  img.onload = () => { artCache.set(path, img); artTouch(path); artTrim(); onReady?.(); };
  img.onerror = () => { artCache.set(path, null); };
  img.src = path;
  return null;
}

/** Load exactly the art ONE page needs, then resolve.  Replaces the old
 *  whole-volume preload: an export used to decode every page up front, which
 *  is the single largest spike in the app. */
function loadPageArt(page, timeoutMs = 4000) {
  const paths = new Set();
  for (const { event } of page?.panels ?? []) {
    const a = event && panelMeta(event.panelKey).art;
    if (a && !artCache.get(a)) paths.add(a);
  }
  if (!paths.size) return Promise.resolve();
  return new Promise((resolve) => {
    let left = paths.size;
    const done = () => { if (--left <= 0) { clearTimeout(t); resolve(); } };
    const t = setTimeout(resolve, timeoutMs);
    for (const p of paths) {
      const img = new Image();
      img.onload  = () => { artCache.set(p, img); artTouch(p); done(); };
      img.onerror = () => { artCache.set(p, null); done(); };
      img.src = p;
    }
  });
}

function wrap(ctx, text, maxW) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** One balloon of `kind` on a panel, placed with the SAME rules as the live
 *  tile (balloonLayout: protect rects, earlier balloons, reading order) and
 *  drawn with the same vocabulary (balloonShapes).  Type is sized from PANEL
 *  scale, never shrunk to fit; copy over the word cap is split at sentence
 *  ends and each part placed after the previous.  Returns the rects drawn. */
const WORD_CAP = 25;
function placeBalloon(ctx, text, kind, box, anchor, P) {
  if (!text) return [];
  const { panelW, panelH, px, zones, avoid, after, art } = P;
  const U = unit(panelW, panelH);
  const pad = padding(kind, U);
  const parts = splitByCap(text, WORD_CAP);
  const rects = [];
  let prev = null;
  const face = kind === 'caption' ? '"Comic Neue", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif' : LETTERING;
  ctx.font = `${kind === 'caption' ? 'bold ' : kind === 'whisper' ? 'italic ' : ''}${px}px ${face}`;
  parts.forEach((part, i) => {
    const shown = kind === 'caption' ? String(part).toUpperCase() : part;
    const lines = wrap(ctx, shown, Math.max(40, box.w - pad.x * 2));
    const w = Math.min(box.w, Math.max(...lines.map(l => ctx.measureText(l).width)) + pad.x * 2);
    const h = lines.length * px * 1.25 + pad.y * 2;
    const want = prev ? { x: Math.min(art.x + art.w - w - 2, prev.x + 12), y: prev.y + prev.h + 3, w, h } : { x: box.x, y: box.y, w, h };
    const last = i === parts.length - 1;
    const L = layoutBalloon({ size: { w, h }, box: want, anchor: last && kind !== 'caption' && kind !== 'offpanel' ? anchor : null, zones, art, bounds: art, avoid: [...avoid, ...rects], scale: px / 16, after: i === 0 ? after : prev, lineH: px * 1.25, connectorFrom: prev });
    const body = bodyShape(kind, L.rect, U, seedFor(part));
    const tl = tailShape(kind, L.tail, U);
    const cn = connectorShape(L.connector);
    const fill = kind === 'player' ? '#FFF9D6' : kind === 'caption' ? '#FFF1B8' : '#FFFFFF';
    ctx.save();
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, strokeFor(kind, U, 1.2));
    const path = (pts) => { ctx.beginPath(); pts.forEach((q, k) => k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); };
    if (cn?.polygon) { path(cn.polygon); ctx.fill(); ctx.stroke(); }
    if (tl?.polygon) { path(tl.polygon); ctx.fill(); ctx.stroke(); }
    if (tl?.bubbles) for (const b of tl.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (kind === 'caption') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(L.rect.x + 2, L.rect.y + 2, w, h); ctx.fillStyle = fill; }
    path(body.outline); ctx.fill();
    if (body.dash) { for (const [a, b] of dashOutline(body.outline, body.dash.dash, body.dash.gap)) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    else ctx.stroke();
    if (body.inner) { ctx.lineWidth = Math.max(0.8, ctx.lineWidth * 0.6); path(body.inner); ctx.stroke(); }
    if (tl?.polygon || cn?.polygon) { path(body.outline); ctx.fill(); }          // re-cover the tail/bridge base
    ctx.fillStyle = kind === 'caption' ? '#222' : INK; ctx.textBaseline = 'top';
    ctx.textAlign = kind === 'caption' ? 'left' : 'center';
    lines.forEach((l, k) => ctx.fillText(l, kind === 'caption' ? L.rect.x + pad.x : L.rect.x + w / 2, L.rect.y + pad.y + k * px * 1.25));
    ctx.restore();
    rects.push(L.rect); prev = L.rect;
  });
  return rects;
}

/** Draw one resolved page (from ComicSystem.pagesOf) onto a 2D context of
 *  size w × h.  `onArt` is called when a lazily-loaded art file arrives so
 *  the caller can redraw. */
export function renderPage(ctx, page, w, h, onArt) {
  ctx.save();
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
  const sx = w / PAGE_W, sy = h / PAGE_H;
  if (page.templateId === 'meanwhile') {
    ctx.fillStyle = INK; ctx.font = `bold ${Math.max(11, w * 0.06)}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('MEANWHILE…', w * 0.03, h * 0.22);
    const first = page.panels[0]?.event;
    if (first?.text?.line) { ctx.font = `${Math.max(8, w * 0.03)}px "Helvetica Neue", Arial, sans-serif`; ctx.fillStyle = '#6E6A60'; ctx.fillText(first.text.line, w * 0.03, h * 0.22 + w * 0.07); }
  }
  page.panels.forEach(({ slot, event }, si) => {
    const x = slot.x * sx, y = slot.y * sy, pw = slot.w * sx, ph = slot.h * sy;
    if (!event) return;
    const meta = panelMeta(event.panelKey);
    // A MEANWHILE strip is one event across three slots: each slot reads
    // its own sub-panel caption.
    const sub = page.templateId === 'meanwhile' ? (event.strip?.[si] ?? null) : null;
    // Art or placeholder.
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, pw, ph); ctx.clip();
    const img = meta.art ? (artCache.get(meta.art) ?? loadArt(meta.art, onArt)) : null;
    if (img) {
      const s = Math.max(pw / img.width, ph / img.height);
      ctx.drawImage(img, x + (pw - img.width * s) / 2, y + (ph - img.height * s) / 2, img.width * s, img.height * s);
    } else {
      const g = ctx.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, '#1B2A44'); g.addColorStop(1, '#0A1020');
      ctx.fillStyle = g; ctx.fillRect(x, y, pw, ph);
      // Silhouette of the speaker (placeholder for real art).
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(x + pw * 0.78, y + ph * 0.42, Math.min(pw, ph) * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + pw * 0.78, y + ph * 0.95, Math.min(pw, ph) * 0.26, Math.min(pw, ph) * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8FB7E6'; ctx.font = `bold ${Math.max(8, ph * 0.07)}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${((sub ? sub.speaker : event.speaker) || '').toUpperCase()}`, x + 8, y + ph - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`MI ${Math.round(event.mile)}`, x + pw - 8, y + ph - 6);
    }
    // Balloons (never baked into art) — same placement + vocabulary as the tile.
    const px = Math.max(9, Math.min(15, Math.round(pw * 0.032)));
    const zr = (r) => ({ ...r, x: x + r.x * pw, y: y + r.y * ph, w: r.w * pw, h: r.h * ph });
    const P = { panelW: pw, panelH: ph, px, zones: migrateZones((meta.protect ?? []).map(zr), (meta.zones ?? []).map(zr)), avoid: [], after: null, art: { x, y, w: pw, h: ph } };
    const R = (r) => ({ x: x + r.x * pw, y: y + r.y * ph, w: r.w * pw, h: r.h * ph });
    const Pt = (p) => ({ x: x + p.x * pw, y: y + p.y * ph });
    if (sub) {
      placeBalloon(ctx, sub.text, 'speech', { x: x + 0.05 * pw, y: y + 0.06 * ph, w: 0.9 * pw, h: 0.5 * ph }, null, P);
    } else {
      if (event.text?.caption) P.avoid.push(...placeBalloon(ctx, event.text.caption, 'caption', meta.caption ? R(meta.caption) : { x: x + 0.03 * pw, y: y + 0.03 * ph, w: 0.42 * pw, h: 0.22 * ph }, null, P));
      // Reading order: the NPC line (if it is what the panel shows), the
      // player's chosen sentence, then the NPC reply AFTER it.
      const hasReply = !!event.text?.reply;
      if (!hasReply && event.text?.line) P.avoid.push(...placeBalloon(ctx, event.text.line, getStoryNode(event.storyId, event.nodeId)?.lineKind ?? 'speech', R(meta.bubble), Pt(meta.tail), P));
      let playerRect = null;
      if (event.text?.label) { const rs = placeBalloon(ctx, event.text.label, 'player', R(meta.playerBubble), Pt(meta.playerTail), P); P.avoid.push(...rs); playerRect = rs[0] ?? null; }
      if (hasReply) {
        const ch = getStoryNode(event.storyId, event.nodeId)?.choices?.find(c => c.id === event.choiceId);
        P.after = playerRect; placeBalloon(ctx, event.text.reply, ch?.replyKind ?? 'speech', meta.replyBubble ? R(meta.replyBubble) : R(meta.bubble), Pt(meta.tail), P);
      }
    }
    ctx.restore();
    // Panel border.
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.strokeRect(x, y, pw, ph);
  });
  // Page number.
  ctx.fillStyle = '#6E6A60'; ctx.font = `${Math.max(9, w * 0.028)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(String(page.n), w / 2, h - w * 0.012);
  ctx.restore();
}

/** Cover page for an exported volume. */
function renderCover(ctx, w, h, { title, plate, vol, chapters, done }) {
  ctx.fillStyle = '#0A1020'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1B2A44'); g.addColorStop(1, '#0A1020');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#F5D223'; ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${Math.round(w * 0.11)}px Impact, "Arial Black", sans-serif`;
  ctx.fillText('ROAD TRIP', w / 2, h * 0.30);
  ctx.fillText('ROULETTE', w / 2, h * 0.30 + w * 0.12);
  ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${Math.round(w * 0.05)}px Impact, "Arial Black", sans-serif`;
  ctx.fillText(title, w / 2, h * 0.52);
  ctx.fillStyle = '#8FB7E6'; ctx.font = `${Math.round(w * 0.032)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`VOLUME ${vol}${plate ? '  ·  PLATE ' + plate : ''}`, w / 2, h * 0.58);
  ctx.fillText(`${chapters} ${chapters === 1 ? 'TRIP' : 'TRIPS'}`, w / 2, h * 0.62);
  ctx.fillStyle = '#FFD23D'; ctx.font = `bold ${Math.round(w * 0.045)}px Impact, "Arial Black", sans-serif`;
  ctx.fillText(done ? 'THE END' : 'TO BE CONTINUED', w / 2, h * 0.86);
}

/** Render a volume (cover + every page + closing card) to JPEG pages and
 *  package them as a PDF Blob.  Runs entirely on-device. */
export async function exportVolumePdf(comic, vol, { pageSize = 'a4', plate = '', onProgress } = {}) {
  const pages = comic.pagesOf(vol);
  // Pages are loaded, rendered and released ONE AT A TIME (see the cache note
  // above).  This used to preload the whole volume before rendering anything,
  // which decoded every panel simultaneously — the largest memory spike in the
  // app, and on a long book easily hundreds of MB.
  const cv = document.createElement('canvas'); cv.width = EXPORT_W; cv.height = EXPORT_H;
  const ctx = cv.getContext('2d');
  const toJpeg = () => new Promise((res) => cv.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', EXPORT_Q));
  const out = [];
  const done = !comic.isToBeContinued(vol);
  const push = async () => out.push({ jpeg: await toJpeg(), w: EXPORT_W, h: EXPORT_H });
  renderCover(ctx, EXPORT_W, EXPORT_H, { title: 'STORY COMIC', plate, vol: vol.n, chapters: vol.chapters.length, done });
  await push();
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i + 1, pages.length);
    await loadPageArt(pages[i]);        // this page only
    renderPage(ctx, pages[i], EXPORT_W, EXPORT_H, null);
    await push();
    artTrim(1);                         // release it before the next page decodes
  }
  artTrim(0);                           // nothing held once the volume is packaged
  // Closing card.
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
  ctx.fillStyle = '#B8860B'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(EXPORT_W * 0.09)}px Impact, "Arial Black", sans-serif`;
  ctx.fillText(done ? 'THE END' : 'TO BE CONTINUED', EXPORT_W / 2, EXPORT_H / 2);
  await push();
  const title = `Road Trip Roulette Comic — Vol ${vol.n}${plate ? ' — ' + plate : ''}${done ? '' : ' (to be continued)'}`;
  const bytes = buildPdf(out, { pageSize, title });
  return { blob: new Blob([bytes], { type: 'application/pdf' }), name: `RTR-Comic-Vol${vol.n}${plate ? '-' + plate.replace(/[^A-Za-z0-9]+/g, '') : ''}.pdf`, pages: out.length };
}

/** Share sheet where the platform offers one (iOS Files / Messages /
 *  AirDrop via the Web Share API), else a download.  Returns how it went. */
export async function deliverPdf({ blob, name }) {
  try {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && typeof navigator.share === 'function') {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    // fall through to download
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'downloaded';
  } catch (_) { return 'failed'; }
}

/** Build the reader inside `el`.  `comic` = ComicSystem (may be null). */
export function mountComicReader(el, comic, opts = {}) {
  el.innerHTML = '';
  const vols = comic?.volumes?.() ?? [];
  const plate = opts.plate ? ` · ${opts.plate}` : '';
  if (!vols.length) {
    el.innerHTML = `<p class="pa-lead">No panels yet${plate}.</p>
      <p class="pa-note">Choices that matter get drawn here as you make them — story direction, cash, cargo, who's riding with you, what you promised. Every chapter is one trip; only resetting this plate erases the book.</p>
      <div class="cr-tbc">TO BE CONTINUED</div>`;
    return;
  }
  const active = comic.activeVolume();
  // `opts.focus` = { volId, pageId } (a tapped MEANWHILE notification) —
  // open that volume and scroll that page into view instead of the newest.
  const focus = opts.focus ?? null;
  let curId = focus?.volId ?? active?.id ?? vols[vols.length - 1].id;

  const tabs = document.createElement('div'); tabs.className = 'cr-tabs';
  const body = document.createElement('div'); body.className = 'cr-body';
  const foot = document.createElement('div'); foot.className = 'cr-foot';
  // Page size: A4 default, the player's pick remembered on this device
  // (owner 2026-09-06: "default to A4, but ask player what their preference is").
  let pageSize = 'a4';
  try { const v = localStorage.getItem(SIZE_KEY); if (PAGE_SIZES[v]) pageSize = v; } catch (_) {}
  const sizeWrap = document.createElement('div'); sizeWrap.className = 'cr-size';
  for (const [id, sz] of Object.entries(PAGE_SIZES)) {
    const b = document.createElement('button'); b.className = 'pa-toggle cr-size-btn' + (id === pageSize ? ' on' : ''); b.dataset.size = id; b.textContent = sz.label;
    b.addEventListener('click', () => { pageSize = id; try { localStorage.setItem(SIZE_KEY, id); } catch (_) {} for (const x of sizeWrap.children) x.classList.toggle('on', x.dataset.size === id); });
    sizeWrap.appendChild(b);
  }
  const status = document.createElement('span'); status.className = 'cr-status';
  const exp  = document.createElement('button'); exp.className = 'pa-toggle cr-export'; exp.textContent = 'EXPORT PDF';
  exp.addEventListener('click', async () => {
    if (exp.disabled) return;
    const vol = comic.volume(curId); if (!vol) return;
    exp.disabled = true; status.textContent = 'Rendering…';
    try {
      const pdf = await exportVolumePdf(comic, vol, { pageSize, plate: opts.plate ?? '', onProgress: (i, n) => { status.textContent = `Rendering ${i}/${n}…`; } });
      status.textContent = `${pdf.pages} pages · ${(pdf.blob.size / 1048576).toFixed(1)} MB`;
      const how = await deliverPdf(pdf);
      status.textContent = how === 'shared' ? 'Shared ✓' : how === 'downloaded' ? 'Downloaded ✓' : how === 'cancelled' ? 'Share cancelled' : 'Export failed';
      window.__lastComicPdf = { name: pdf.name, size: pdf.blob.size, pages: pdf.pages, how };   // QA hook
    } catch (e) { status.textContent = 'Export failed'; console.warn('[ComicReader] export', e); }
    exp.disabled = false;
  });
  foot.append(sizeWrap, status, exp);
  el.append(tabs, body, foot);

  // One observer per mounted reader; rebuilt whenever a volume is drawn.
  let pageObserver = null;
  const pageDraw = new WeakMap();       // canvas → its draw()

  const drawVolume = (volId) => {
    curId = volId;
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.id === volId);
    // Switching volumes drops the previous volume's decoded panels — only the
    // compact events are kept, and pages redraw from them on demand.
    try { pageObserver?.disconnect(); } catch (_) {}
    releaseComicArt();
    body.innerHTML = '';
    const vol = comic.volume(volId);
    const pages = comic.pagesOf(vol);
    let lastCh = null;
    // rootMargin one page tall ⇒ current page ± 1 are drawn ahead of the scroll.
    pageObserver = (typeof IntersectionObserver === 'function')
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const d = pageDraw.get(e.target);
            if (!d) continue;
            pageDraw.delete(e.target);          // draw once; renderPage self-redraws on art load
            pageObserver.unobserve(e.target);
            d();
          }
        // ROOT = the element that actually SCROLLS (.pa-body, the phone-app
        // body) — not `.cr-body`, which is a non-scrolling flex column as tall
        // as its content.  With the wrong root every page "intersected" at
        // once, so a whole volume drew on open and thrashed the six-image LRU
        // (blank / late pages, needless iPhone memory pressure) — working-notes
        // comic finding #2, confirmed 2026-09-09.  Falls back to the viewport.
        }, { root: el.closest('.pa-body') ?? null, rootMargin: '150% 0px' })
      : null;
    const width = Math.max(200, Math.floor(body.clientWidth || el.clientWidth || 300));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const page of pages) {
      if (page.chapterN !== lastCh) {
        lastCh = page.chapterN;
        const h = document.createElement('div'); h.className = 'cr-chapter';
        h.textContent = `CHAPTER ${page.chapterN} — TRIP ${page.chapterN}`;
        body.appendChild(h);
      }
      const cv = document.createElement('canvas');
      const hPx = Math.round(width * PAGE_H / PAGE_W);
      cv.width = width * dpr; cv.height = hPx * dpr;
      cv.style.width = width + 'px'; cv.style.height = hPx + 'px';
      cv.className = 'cr-page'; cv.dataset.pageId = page.id;
      const draw = () => { const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); renderPage(ctx, page, width, hPx, draw); };
      // WINDOWED (owner 2026-09-07): draw only pages at or near the viewport.
      // Every page used to draw on open, so opening a volume decoded its entire
      // art set at once.  The observer's rootMargin is one page tall, so the
      // current page plus its immediate neighbours are ready before they scroll
      // in; the LRU above evicts anything further away.  Page LAYOUT is
      // unaffected — the canvas is already sized, so nothing reflows.
      if (pageObserver) { pageDraw.set(cv, draw); pageObserver.observe(cv); }
      else draw();                      // no IntersectionObserver → previous behaviour
      body.appendChild(cv);
    }
    const end = document.createElement('div');
    end.className = 'cr-tbc';
    end.textContent = comic.isToBeContinued(vol) ? 'TO BE CONTINUED' : `THE END · VOLUME ${vol.n}`;
    body.appendChild(end);
    // Newest at the bottom — land there (18.1 "current vertical comic progress"),
    // unless a specific page was asked for.
    requestAnimationFrame(() => {
      const target = focus?.pageId && volId === focus.volId ? body.querySelector(`canvas[data-page-id="${focus.pageId}"]`) : null;
      if (target) target.scrollIntoView({ block: 'start' }); else body.scrollTop = body.scrollHeight;
    });
  };

  for (const v of vols) {
    const b = document.createElement('button');
    b.className = 'pa-toggle cr-tab'; b.dataset.id = v.id;
    b.textContent = `VOL ${v.n}${v.status === 'complete' ? '' : ' ●'}`;
    b.addEventListener('click', () => drawVolume(v.id));
    tabs.appendChild(b);
  }
  drawVolume(curId);
}
