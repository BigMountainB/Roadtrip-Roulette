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
  const exp  = document.createElement('button'); exp.className = 'pa-toggle cr-export'; exp.textContent = 'EXPORT PDF';
  exp.disabled = true; exp.title = 'PDF export arrives with the final comic build';
  foot.appendChild(exp);
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
