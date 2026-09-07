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
import { LETTERING } from './StoryTile.js';
import { buildPdf, PAGE_SIZES } from './ComicPdf.js';

// Export page pixel size (A-series aspect); JPEG quality.  ~150 dpi on A4.
const EXPORT_W = 1240, EXPORT_H = Math.round(EXPORT_W * PAGE_H / PAGE_W), EXPORT_Q = 0.86;
const SIZE_KEY = 'rtr.comic.pageSize';   // per-device preference (A4 default)

const PAPER = '#F6F1E4';
const INK   = '#141414';
const artCache = new Map();   // path → HTMLImageElement | null (failed)

function loadArt(path, onReady) {
  if (!path) return null;
  if (artCache.has(path)) return artCache.get(path);
  const img = new Image();
  artCache.set(path, null);
  img.onload = () => { artCache.set(path, img); onReady?.(); };
  img.onerror = () => { artCache.set(path, null); };
  img.src = path;
  return null;
}

/** Resolve every art file a set of pages needs before an export renders
 *  them (renderPage loads lazily and redraws — no good for a one-shot). */
function preloadArt(pages, timeoutMs = 4000) {
  const paths = new Set();
  for (const pg of pages) for (const { event } of pg.panels) { const a = event && panelMeta(event.panelKey).art; if (a && !artCache.get(a)) paths.add(a); }
  if (!paths.size) return Promise.resolve();
  return new Promise((resolve) => {
    let left = paths.size; const done = () => { if (--left <= 0) resolve(); };
    const t = setTimeout(resolve, timeoutMs);
    for (const p of paths) { const img = new Image(); img.onload = () => { artCache.set(p, img); done(); }; img.onerror = () => { artCache.set(p, null); done(); }; img.src = p; }
    void t;
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

/** Balloon that shrinks its type (never below `minPx`) and grows its box to
 *  fit; returns the box drawn. */
function drawBalloon(ctx, text, box, tail, opts = {}) {
  const { fill = '#FFFFFF', minPx = 8 } = opts;
  if (!text) return null;
  let px = Math.max(minPx, Math.round(box.h * 0.22));
  let lines;
  for (;;) {
    ctx.font = `${px}px ${LETTERING}`;
    lines = wrap(ctx, text, box.w - 16);
    if (lines.length * px * 1.25 + 14 <= box.h || px <= minPx) break;
    px -= 1;
  }
  // Never draw text outside the balloon.  Overflow at the minimum size
  // links a SECOND balloon beneath (same rule as the live tile); only when
  // even that overflows is the copy elided — the full line stays in the
  // record and resolves by key.
  const maxH = box.h * (opts.maxGrow ?? 1.25);
  let fit = Math.max(1, Math.floor((maxH - 14) / (px * 1.25)));
  if (lines.length > fit && !opts._linked) {
    const m = String(text).match(/^(.{20,}?[.!?…])\s+(.+)$/s);
    if (m) {
      const first = drawBalloon(ctx, m[1], box, null, { ...opts, _linked: true });
      const nb = { x: Math.min(box.x + box.w * 0.15, box.x + box.w - 20), y: first.y + first.h - 3, w: box.w * 0.92, h: box.h };
      return drawBalloon(ctx, m[2], nb, tail, { ...opts, _linked: true, maxGrow: 2.2 });
    }
  }
  if (lines.length > fit) { lines = lines.slice(0, fit); lines[fit - 1] = lines[fit - 1].replace(/\s*\S*$/, '') + '…'; }
  const h = lines.length * px * 1.25 + 14;
  const w = Math.min(box.w, Math.max(...lines.map(l => ctx.measureText(l).width)) + 18);
  ctx.save();
  ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, px * 0.12);
  roundRect(ctx, box.x, box.y, w, h, Math.min(12, h / 3)); ctx.fill(); ctx.stroke();
  if (tail) {
    // Tail from the edge facing the anchor, never across the text.
    const bx = box.x, by = box.y, tx = tail.x, ty = tail.y;
    let ax, ay, bx2, by2;
    if (tx > bx + w && ty < by + h + 4) { ax = bx + w - 0.5; ay = Math.max(by + 6, Math.min(by + h - 14, ty - 4)); bx2 = ax; by2 = ay + 9; }
    else if (tx < bx && ty < by + h + 4) { ax = bx + 0.5; ay = Math.max(by + 6, Math.min(by + h - 14, ty - 4)); bx2 = ax; by2 = ay + 9; }
    else { const cx = Math.max(bx + 12, Math.min(bx + w - 12, tx)); ax = cx - 5; ay = by + h - 0.5; bx2 = cx + 5; by2 = ay; }
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.lineTo(bx2, by2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Re-cover the tail base so the balloon outline reads as open into the tail.
    ctx.fillStyle = fill; roundRect(ctx, box.x, box.y, w, h, Math.min(12, h / 3)); ctx.fill();
    ctx.fillStyle = INK;
  }
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, box.x + w / 2, box.y + 7 + i * px * 1.25));
  ctx.restore();
  return { x: box.x, y: box.y, w, h };
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
    // Balloons (never baked into art).
    const b = meta.bubble, t = meta.tail, pb = meta.playerBubble, pt = meta.playerTail;
    if (sub) {
      drawBalloon(ctx, sub.text, { x: x + 0.05 * pw, y: y + 0.06 * ph, w: 0.9 * pw, h: 0.5 * ph }, null, { maxGrow: 1.6 });
    } else {
      const npcText = event.text?.reply || event.text?.line;
      drawBalloon(ctx, npcText, { x: x + b.x * pw, y: y + b.y * ph, w: b.w * pw, h: b.h * ph }, { x: x + t.x * pw, y: y + t.y * ph });
      if (event.text?.label) {
        drawBalloon(ctx, event.text.label, { x: x + pb.x * pw, y: y + pb.y * ph, w: pb.w * pw, h: pb.h * ph }, { x: x + pt.x * pw, y: y + pt.y * ph }, { fill: '#FFF9D6' });
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
  await preloadArt(pages);
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
    renderPage(ctx, pages[i], EXPORT_W, EXPORT_H, null);
    await push();
  }
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

  const drawVolume = (volId) => {
    curId = volId;
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.id === volId);
    body.innerHTML = '';
    const vol = comic.volume(volId);
    const pages = comic.pagesOf(vol);
    let lastCh = null;
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
      draw();
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
