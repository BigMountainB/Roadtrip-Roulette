// Comic panels for /dialogue2 chapter pages (owner 2026-11-23): each panel's art stacked like a strip,
// its dialogue as speech bubbles (narration as gold caption boxes) on top, and a Layout mode to drag
// bubbles, resize them, style them, and swap/add/remove/upload images. Runs inside each chapter iframe;
// uses D (the chapter page's data) and the parent's localStorage (same origin).
//
// Lettering follows the "RTR Comic Book V2" spec (owner decisions 2026-09-09): Patrick Hand for spoken
// lines, Comic Neue bold caps for captions. Style picker (owner 2026-11-23): tap a bubble in Layout →
// Text (Blue / Green / White) or Voice (Color, border thickness / style / size, corner roundness). Tails
// are off unless added; then the tip is dragged to where it points, and a clock picks where it leaves
// the bubble (or Auto). Voice bubbles can be linked to the one before. Only text messages show names.
//
// Which style a bubble gets, first match wins:
//   1. its own style                       layout bubbles[key].style  / node.bubbles[key].style
//   2. the panel default                   layout[ch][node].style     / node.style
//   3. the speaker default (all chapters)  layout._speakers[speaker]  / story speakerStyles
//   4. plain voice bubble, white, no tail
//
// Saved layout (this browser, until published):  rtr.dialogue2.layout.v1
//   { _speakers?: {[speaker]: style}, [chapterId]: { [nodeId]: { images?, style?, bubbles?: {[key]: {img,x,y,w,style?}} } } }
// Bubble keys: a line's text as shown (*italics* without asterisks), "add:<id>" for a line added with ✎,
// or "choice:<from panel>:<choice id>" for the choice the player picked to reach the panel.
(() => {
  const LKEY = 'rtr.dialogue2.layout.v1', EKEY = 'rtr.dialogue2.edits.v1', AKEY = EKEY + '.adds', PASS_KEY = 'rtr.dialogue2.passcode';
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const shown = t => norm(String(t ?? '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/\[\+([^\]\n]+?)\+\]/g, '$1').replace(/\[-([^\]\n]+?)-\]/g, '$1'));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\[\+([^\]\n]+?)\+\]/g, '<span class="fx-big">$1</span>').replace(/\[-([^\]\n]+?)-\]/g, '<span class="fx-sm">$1</span>');
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
  // Fresh uploads (owner 2026-11-24): until the site rebuilds with them (~5 min), show them straight
  // from the repository so the panel and the image list have them at once. Dropped once built in.
  const UKEY = 'rtr.dialogue2.uploads.v1';
  const rawUrl = name => 'https://raw.githubusercontent.com/BigMountainB/Roadtrip-Roulette/refs/heads/claude/lucid-fermi-21ue13/Story%20Playtest%202/images/' + encodeURIComponent(name) + '.jpg';
  const readUploads = () => read(UKEY);
  {
    const ups = readUploads(), keep = {};
    for (const [name, url] of Object.entries(ups)) if (!D.allImages[name]) { D.allImages[name] = url; keep[name] = url; }
    if (Object.keys(keep).length !== Object.keys(ups).length) try { localStorage.setItem(UKEY, JSON.stringify(keep)); } catch {}
  }
  const ch = D.chapter.id;
  const TEXT_COLORS = { blue: 'Blue', green: 'Green', white: 'White' };
  const VOICE_COLORS = { white: 'White', cream: 'Cream', yellow: 'Yellow' };
  const SIZES = { s: ['S', .8], m: ['M', 1], l: ['L', 1.2], xl: ['XL', 1.45] };
  // Voice borders (owner 2026-11-24): thickness, style, how big the dashes/waves/points are, and corner
  // roundness (0 = square … 50 = oval). The old presets (style.border) still read, translated:
  const BSTYLES = { solid: 'Solid', dashed: 'Dashed', wavy: 'Wavy', pointy: 'Pointy' };
  const LEGACY = { whisper: { bstyle: 'dashed' }, shout: { bstyle: 'pointy', bamt: 55, bw: 3 }, thought: { bstyle: 'wavy', bamt: 50, tshape: 'dots' }, radio: { rad: 12, tshape: 'bolt' } };
  const clamp = (v, lo, hi, d) => { v = Math.round(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  let mode = false, nodeId = null, host = null, selected = null, lastTap = { key: null, at: 0 };
  try { mode = !!parent.RTR_LAYOUT_ON; } catch {}

  const allLayout = () => read(LKEY);
  const saved = () => allLayout()[ch] || {};
  function save(fn) {
    try { parent.RTR_UNDO_MARK?.(); } catch {}
    const all = allLayout();
    fn(all);
    for (const [c, nodes] of Object.entries(all)) {
      if (c === '_speakers') { if (!Object.keys(nodes || {}).length) delete all._speakers; continue; }
      for (const [nid, p] of Object.entries(nodes || {})) if (!p.images && !p.style && !(p.bubbles && Object.keys(p.bubbles).length)) delete nodes[nid];
      if (!Object.keys(nodes || {}).length) delete all[c];
    }
    try { localStorage.setItem(LKEY, JSON.stringify(all)); } catch {}
    try { parent.RTR_LAYOUT_CHANGED?.(); } catch {}
  }
  const panelSave = fn => save(all => { const p = ((all[ch] ||= {})[nodeId] ||= {}); fn(p); });
  const imagesFor = nid => {
    const n = D.chapter.nodes[nid], p = saved()[nid] || {};
    return (p.images ?? n.images ?? D.autoImages[nid] ?? []).filter(name => D.allImages[name]);
  };
  const placedFor = nid => ({ ...(D.chapter.nodes[nid].bubbles || {}), ...((saved()[nid] || {}).bubbles || {}) });
  // Lines as they read now: the script, this browser's ✎ edits (removed lines get no bubble), and lines
  // added with ✎ right after the line they follow.
  // The choice the player picked to get here shows as Brendan's first bubble on this panel (owner
  // 2026-11-23). Key "choice:<from panel>:<choice id>", so its place and look survive rewording.
  let via = null;
  function lines(nid) {
    const n = D.chapter.nodes[nid], edits = read(EKEY)[ch] || {}, adds = (read(AKEY)[ch] || []).filter(a => a.kind === 'line' && !a.onChoice), out = [];
    const c = via && D.chapter.nodes[via.from]?.choices?.find(c => c.id === via.id);
    if (c && c.to === nid) { const e = edits[shown(c.label)]; if (!e?.deleted) out.push({ key: 'choice:' + via.from + ':' + c.id, speaker: 'Brendan', text: (e && typeof e.text === 'string' ? e.text : c.label).replace(/\s*\([+-]\d+\)\s*$/, ''), choice: true }); }   // no score marks like (+3)
    for (const b of n.beats) {
      const key = shown(b.text), e = edits[key], add = a => out.push({ key: 'add:' + a.id, speaker: a.speaker === 'Narration' ? 'Scene' : a.speaker, text: a.text, added: true });
      adds.filter(a => a.anchor === key && a.before).forEach(add);
      if (!e?.deleted) out.push({ key, speaker: b.speaker, text: e && typeof e.text === 'string' ? e.text : b.text });
      adds.filter(a => a.anchor === key && !a.before).forEach(add);
    }
    return out;
  }
  // Until a bubble is placed: spread the lines over the panel's images, top to bottom, alternating sides.
  function defaultPos(i, count, imgCount) {
    const per = Math.max(1, Math.ceil(count / Math.max(1, imgCount))), j = i % per;
    return { img: Math.min(imgCount - 1, Math.floor(i / per)), x: j % 2 ? 51 : 3, y: 4 + j * Math.min(26, 84 / per), w: 44 };
  }
  const speakerStyles = () => ({ ...(D.speakerStyles || {}), ...(allLayout()._speakers || {}) });
  const panelStyle = nid => (saved()[nid] || {}).style ?? D.chapter.nodes[nid].style;
  function styleOf(own, speaker, nid) {
    const s = { ...(speakerStyles()[speaker] || {}), ...(panelStyle(nid) || {}), ...(own || {}) };
    const size = SIZES[s.size] ? s.size : 'm';
    if (speaker === 'Scene') return { kind: 'caption', tail: 0, size: SIZES[(own || {}).size] ? own.size : 'm' };
    const kind = s.kind === 'text' ? 'text' : 'voice';
    const tail = +s.tail > 0 && +s.tail <= 12.5 ? Math.round(+s.tail * 2) / 2 : 0;
    const tlen = Math.max(8, Math.min(500, Math.round(+s.tlen || 18)));
    const tbase = +s.tbase > 0 && +s.tbase <= 12 ? Math.round(+s.tbase * 2) / 2 : 0;
    const lg = kind === 'voice' ? LEGACY[s.border] || {} : {}, pick = (k, d) => s[k] ?? lg[k] ?? d;
    const tshape = ['bolt', 'straight', 'dots'].includes(s.tshape) ? s.tshape : lg.tshape || '';
    const tcurve = Math.max(-100, Math.min(100, Math.round(+s.tcurve || 0)));
    const twidth = +s.twidth >= 4 && +s.twidth <= 80 ? Math.round(+s.twidth) : 0;             // 0 = auto
    if (kind === 'text') return { kind, color: TEXT_COLORS[s.color] ? s.color : 'blue', tail, tlen, tbase, tshape, tcurve, twidth, size };
    const bstyle = BSTYLES[pick('bstyle', 'solid')] ? pick('bstyle', 'solid') : 'solid';
    return { kind, color: VOICE_COLORS[s.color] ? s.color : 'white', bw: clamp(pick('bw', 2), 0, 10, 2), bstyle, bamt: clamp(pick('bamt', 40), 1, 100, 40), rad: clamp(pick('rad', 50), 0, 50, 50), tail, tlen, tbase, tshape, tcurve, twidth, size };
  }
  const classes = st => st.kind === 'caption' ? 'bub cap' : st.kind === 'text' ? 'bub txt t-' + st.color : 'bub vx v-' + st.color;

  let ro = null, sig = '';
  function render(nid, el, v) {
    if (arguments.length > 2) via = v || null;
    closePanel();
    nodeId = nid; host = el;
    const imgs = imagesFor(nid), placed = placedFor(nid);
    el.classList.toggle('layout', mode);
    sig = signature();
    if (!imgs.length) {
      el.innerHTML = mode ? '<div class="cempty">No art for this panel yet.<button data-cadd="1">+ Add an image</button></div>' : '';
      return;
    }
    const L = lines(nid);
    el.innerHTML = imgs.map((name, i) => '<div class="cimg" data-i="' + i + '"><img alt="" src="' + esc(D.allImages[name]) + '">'
      + (mode ? '<div class="ctools"><button data-cswap="' + i + '">Swap image</button>' + (imgs.length > 1 ? '<button data-cdel="' + i + '">Remove</button>' : '') + '<span>' + esc(name) + '</span></div>' : '') + '</div>').join('')
      + (mode ? '<div class="crow"><button data-cadd="1">+ Add image</button><button data-creset="1">Reset this panel</button><span class="muted">Drag a bubble to move it · tap to style · double-tap to edit its words</span></div>' : '')
      + L.map(l => {
        const st = styleOf(placed[l.key]?.style, l.speaker, nid);
        const name = st.kind === 'text' ? '<b>' + esc(l.speaker) + '</b>' : '';   // names on text messages only (owner 2026-11-24)
        const shape = st.kind === 'voice' ? ' data-bw="' + st.bw + '" data-bstyle="' + st.bstyle + '" data-bamt="' + st.bamt + '" data-rad="' + st.rad + '"' : '';
        return '<div class="' + classes(st) + (selected === l.key ? ' sel' : '') + '" data-k="' + esc(l.key) + '" data-sp="' + esc(l.speaker) + '" data-tail="' + st.tail + '" data-tlen="' + st.tlen + '" data-tbase="' + (st.tbase || 0) + '" data-tshape="' + (st.tshape || '') + '" data-tcurve="' + (st.tcurve || 0) + '" data-twidth="' + (st.twidth || 0) + '"' + shape + '>' + name + '<span' + (st.size !== 'm' ? ' style="font-size:' + SIZES[st.size][1] + 'em"' : '') + '>' + fmt(l.text) + '</span>'
          + (mode ? '<i class="grip" title="Drag to resize"></i>' : '') + '</div>';
      }).join('');
    const place = () => {
      if (drag) return;
      const boxes = [...el.querySelectorAll('.cimg')]; if (!boxes.length) return;
      el.querySelectorAll('.bub').forEach((b, i) => {
        const p = placed[b.dataset.k] || defaultPos(i, L.length, imgs.length), box = boxes[Math.min(p.img ?? 0, boxes.length - 1)];
        b.style.left = p.x + '%'; b.style.width = p.w + '%';
        b.style.top = (box.offsetTop + box.offsetHeight * p.y / 100) + 'px';
        b.classList.toggle('placed', !!placed[b.dataset.k]);
        drawShape(b);
        b._tip = tipOf(b, placed[b.dataset.k]); b._link = !!placed[b.dataset.k]?.link;
        tail(b);
      });
      drawLinks();
      el.querySelectorAll('.tiph').forEach(t => t.remove());
      if (mode) el.querySelectorAll('.bub').forEach(b => { if (b._tip) el.append(handle(b)); });
      if (mode && selected) panel();
      parent.postMessage({ fit: 1 }, '*');
    };
    el.querySelectorAll('img').forEach(im => im.complete ? 0 : im.addEventListener('load', place, { once: true }));
    place();
    ro?.disconnect(); ro = new ResizeObserver(place); ro.observe(el);
  }
  const refresh = () => { if (host && nodeId) render(nodeId, host); };
  // Bubbles follow the words: re-draw when this browser's edits, added lines or layout change.
  const signature = () => { try { return (localStorage.getItem(EKEY) || '') + '|' + (localStorage.getItem(AKEY) || '') + '|' + (localStorage.getItem(LKEY) || ''); } catch { return ''; } };
  setInterval(() => { if (!drag && host?.isConnected && signature() !== sig) refresh(); }, 500);

  // Tail: a triangle (or, for thought, shrinking dots) leaving the bubble's edge toward an hour on a clock
  // face (half hours allowed), `tlen` px long. Ellipse edge for oval bubbles, rectangle edge for boxy ones.
  // ── Tails (owner 2026-11-23): a wedge that narrows evenly from the bubble's edge to a tip. The tip
  // is a point on the panel (bubbles[key].tip, x/y as % of the panel's width), aimed by dragging the
  // orange dot in Layout, so it stays on the speaker when the bubble moves. Where it leaves the
  // bubble: toward the tip (auto) or a clock position (style.tbase). Thought bubbles trail dots.
  // Older saves (style.tail = clock hour, style.tlen = px) still draw.
  // ── Bubble outlines: the base shape is a rectangle with elliptical corners (radius = rad% of the
  // bubble's width/height, so 50 = oval). Voice bubbles draw it as SVG — solid, dashed, wavy or pointy —
  // and tails/links meet that same shape. Text bubbles (18px corners) and captions stay CSS.
  function basePoly(b) {
    const w = b.offsetWidth, h = b.offsetHeight;
    let rx, ry, W = w, H = h, ox = 0, oy = 0;
    if (b.classList.contains('cap')) rx = ry = 0;
    else if (b.classList.contains('txt')) rx = ry = Math.min(18, w / 2, h / 2);
    else {
      // Voice: the outline is built around the text, not squeezed into the box — rounder corners need
      // more room to clear the text's corners, taken mostly as height (owner 2026-11-24). sx/sy are the
      // smallest growth that keeps the text's corner points inside the corner curves, plus a margin.
      const R = (+b.dataset.rad || 0) / 100, cs = getComputedStyle(b), px = parseFloat(cs.paddingLeft) || 0, py = parseFloat(cs.paddingTop) || 0, m = 5;
      const w0 = Math.max(1, w - 2 * px), h0 = Math.max(1, h - 2 * py), sx = 1 / (1 - 2 * R + 2 * R * .85), sy = 1 / (1 - 2 * R + 2 * R * .527);
      W = w0 * sx + 2 * m; H = h0 * sy + 2 * m; ox = (w - W) / 2; oy = (h - H) / 2; rx = R * W; ry = R * H;
    }
    const pts = [], N = 24, Q = Math.PI / 2;
    [[ox + W - rx, oy + ry, -Q], [ox + W - rx, oy + H - ry, 0], [ox + rx, oy + H - ry, Q], [ox + rx, oy + ry, 2 * Q]].forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= N; i++) { const a = a0 + i / N * Q, q = [cx + rx * Math.cos(a), cy + ry * Math.sin(a)], l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > .05) pts.push(q); }
    });
    return pts;
  }
  // Walk a closed outline by distance: at(s) → [x, y, outward normal x, y].
  function walker(pts) {
    const n = pts.length, seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1])), P = seg.reduce((a, b) => a + b, 0);
    return { P, at(s) {
      s = ((s % P) + P) % P; let i = 0; while (i < n - 1 && s > seg[i]) { s -= seg[i]; i++; }
      const p = pts[i], q = pts[(i + 1) % n], L = seg[i] || 1, tx = (q[0] - p[0]) / L, ty = (q[1] - p[1]) / L;
      return [p[0] + tx * s, p[1] + ty * s, ty, -tx];
    } };
  }
  function drawShape(b) {
    b.querySelector(':scope>svg.shape')?.remove();
    b._poly = basePoly(b); b._amp = 0;
    if (!b.classList.contains('vx')) return;
    const bw = +b.dataset.bw || 0, st = b.dataset.bstyle, amt = +b.dataset.bamt || 40;
    let d;
    if (st === 'wavy' || st === 'pointy') {
      const W = walker(b._poly), lam = 6 + amt * .5, k = Math.max(6, Math.round(W.P / lam)), A = lam * (st === 'pointy' ? .5 : .2), n = st === 'pointy' ? 2 * k : 16 * k, out = [];
      b._amp = A;
      for (let j = 0; j < n; j++) { const [x, y, nx, ny] = W.at(j / n * W.P), o = st === 'pointy' ? (j % 2 ? A : 0) : A * Math.sin(2 * Math.PI * j / 16); out.push(P(x + nx * o, y + ny * o)); }
      d = 'M' + out.join(' L') + 'Z';
    } else d = 'M' + b._poly.map(q => P(q[0], q[1])).join(' L') + 'Z';
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'shape'); s.setAttribute('width', '1'); s.setAttribute('height', '1');
    const dash = st === 'dashed' ? ' stroke-dasharray="' + (3 + amt * .25).toFixed(1) + ' ' + (2 + amt * .17).toFixed(1) + '"' : '';
    s.innerHTML = '<path d="' + d + '" stroke-width="' + bw + '"' + (bw ? '' : ' stroke="none"') + dash + (st === 'pointy' ? ' stroke-linejoin="miter" stroke-miterlimit="12"' : '') + '/>';
    b.prepend(s);
  }
  // Where a ray from the bubble's centre leaves its outline (bubble-local px).
  function edge(b, dx, dy) {
    const poly = b._poly || (b._poly = basePoly(b)), cx = b.offsetWidth / 2, cy = b.offsetHeight / 2, n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], ex = x2 - x1, ey = y2 - y1, qx = x1 - cx, qy = y1 - cy, det = ex * dy - dx * ey;
      if (Math.abs(det) < 1e-9) continue;
      const t = (ex * qy - qx * ey) / det, u = (dx * qy - dy * qx) / det;
      if (t > best && u >= -1e-6 && u <= 1 + 1e-6) best = t;
    }
    return [cx + dx * best, cy + dy * best];
  }
  // Links (owner 2026-11-24): "Connect to the bubble before" joins a bubble to the previous one in the
  // panel with a band in both bubbles' colours — for back-and-forth conversation.
  function drawLinks() {
    host.querySelectorAll(':scope>svg.clink').forEach(x => x.remove());
    const bs = [...host.querySelectorAll('.bub')];
    bs.forEach((b, i) => {
      if (!b._link) return;
      let a = null; for (let j = i - 1; j >= 0; j--) if (!bs[j].classList.contains('cap')) { a = bs[j]; break; }
      if (!a) return;
      const C = x => [x.offsetLeft + x.offsetWidth / 2, x.offsetTop + x.offsetHeight / 2], [ax, ay] = C(a), [bx, by] = C(b);
      const ux = bx - ax, uy = by - ay, L = Math.hypot(ux, uy) || 1, px = -uy / L, py = ux / L;
      const hw = Math.max(5, Math.min(13, Math.min(a.offsetHeight, b.offsetHeight) * .13));
      const ends = (x, cx, cy, sx, sy) => {   // edge points on bubble x toward the other bubble, ± half the band width
        const o = [x.offsetLeft, x.offsetTop], e = (ox, oy) => { const [ex, ey] = edge(x, sx + ox, sy + oy); return [o[0] + ex, o[1] + ey]; };
        const L1 = e(px * hw, py * hw), R1 = e(-px * hw, -py * hw), k = 9 + (x._amp || 0) + (+x.dataset.bw || 2) / 2;
        const inn = q => { const dd = Math.hypot(cx - q[0], cy - q[1]) || 1, f = Math.min(k, dd * .5) / dd; return [q[0] + (cx - q[0]) * f, q[1] + (cy - q[1]) * f]; };
        return { L: L1, R: R1, Li: inn(L1), Ri: inn(R1) };
      };
      const A = ends(a, ax, ay, ux, uy), B = ends(b, bx, by, -ux, -uy);
      if ((B.L[0] - A.L[0]) * ux + (B.L[1] - A.L[1]) * uy < 2) return;   // touching or overlapping: nothing to draw
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ML = mid(A.L, B.L), MR = mid(A.R, B.R);
      const poly = q => 'M' + q.map(v => P(v[0], v[1])).join(' L') + 'Z', fill = x => getComputedStyle(x).getPropertyValue('--bf').trim() || '#fff';
      const sw = Math.max(+a.dataset.bw || 0, +b.dataset.bw || 0);
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('class', 'clink'); s.setAttribute('width', '1'); s.setAttribute('height', '1');
      s.innerHTML = '<path fill="' + fill(a) + '" d="' + poly([A.Li, A.L, ML, MR, A.R, A.Ri]) + '"/><path fill="' + fill(b) + '" d="' + poly([ML, B.L, B.Li, B.Ri, B.R, MR]) + '"/>'
        + (sw ? '<path fill="none" stroke="#1B1B22" stroke-width="' + sw + '" stroke-linecap="round" d="M' + P(A.L[0], A.L[1]) + ' L' + P(B.L[0], B.L[1]) + ' M' + P(A.R[0], A.R[1]) + ' L' + P(B.R[0], B.R[1]) + '"/>' : '');
      host.append(s);
    });
  }
  function tipOf(b, pl) {
    if (b.classList.contains('cap')) return null;
    const W = host.offsetWidth || 1;
    if (pl?.tip && isFinite(pl.tip.x) && isFinite(pl.tip.y)) return [pl.tip.x / 100 * W, pl.tip.y / 100 * W];
    const h = +b.dataset.tail; if (!h) return null;
    const th = h * Math.PI / 6, dx = Math.sin(th), dy = -Math.cos(th), [ex, ey] = edge(b, dx, dy), len = +b.dataset.tlen || 18;
    return [b.offsetLeft + ex + dx * len, b.offsetTop + ey + dy * len];
  }
  const P = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);
  function tail(b) {
    b.querySelectorAll('.tail').forEach(t => t.remove());
    const tip = b._tip; if (!tip) return;
    const w = b.offsetWidth, h = b.offsetHeight, cx = w / 2, cy = h / 2, tx = tip[0] - b.offsetLeft, ty = tip[1] - b.offsetTop;
    const hb = +b.dataset.tbase || 0;
    const [dx, dy] = hb ? [Math.sin(hb * Math.PI / 6), -Math.cos(hb * Math.PI / 6)] : [tx - cx, ty - cy];
    const [bx, by] = edge(b, dx, dy), L = Math.hypot(tx - bx, ty - by);
    if (L < 6 || (!hb && Math.hypot(tx - cx, ty - cy) <= Math.hypot(bx - cx, by - cy) + 2)) return;   // tip inside the bubble
    const ux = (tx - bx) / L, uy = (ty - by) / L, px = -uy, py = ux;
    const tw = +b.dataset.twidth || 0, hw = tw ? tw / 2 : Math.max(6, Math.min(16, Math.min(w, h) * .16, L * .45));
    // Centre line: a curve from the edge to the tip (Curve bends it to one side), optionally zig-zagged.
    const bend = (+b.dataset.tcurve || 0) / 100 * L * .5, qx = (bx + tx) / 2 + px * bend, qy = (by + ty) / 2 + py * bend;
    const at = t => [(1 - t) ** 2 * bx + 2 * (1 - t) * t * qx + t * t * tx, (1 - t) ** 2 * by + 2 * (1 - t) * t * qy + t * t * ty];
    const bw = b.classList.contains('vx') ? +b.dataset.bw || 0 : 2;
    if (b.dataset.tshape === 'dots') {
      [.28, .6, .92].forEach((f, i) => {
        const r = Math.max(2.5, hw * (.85 - i * .25)), [x, y] = at(f), dot = document.createElement('i'); dot.className = 'tail dot';
        Object.assign(dot.style, { width: r * 2 + 'px', height: r * 2 + 'px', left: x - r + 'px', top: y - r + 'px', borderWidth: bw + 'px' });
        b.append(dot);
      });
      return;
    }
    // Phone / radio gets a lightning bolt unless set otherwise: two sharp zags, still narrowing evenly.
    const bolt = b.dataset.tshape === 'bolt';
    const ts = bolt ? [0, .36, .52, .74, 1] : Array.from({ length: 15 }, (_, i) => i / 14);
    const zig = Math.max(hw * 1.3, L * .09), off = bolt ? [0, zig, -zig, zig * .6, 0] : ts.map(() => 0);
    const pts = ts.map((t, i) => { const [x, y] = at(t), [x1, y1] = at(Math.min(1, t + .01)), [x0, y0] = at(Math.max(0, t - .01)), d = Math.hypot(x1 - x0, y1 - y0) || 1; const nx = -(y1 - y0) / d, ny = (x1 - x0) / d; return { x: x + nx * off[i], y: y + ny * off[i], nx, ny, t }; });
    if (bolt) pts.forEach((q, i) => { if (i && i < pts.length - 1) { const a = pts[i - 1], c = pts[i + 1], d = Math.hypot(c.x - a.x, c.y - a.y) || 1; q.nx = -(c.y - a.y) / d; q.ny = (c.x - a.x) / d; } });
    const side = sgn => pts.slice(1, -1).map(q => P(q.x + sgn * q.nx * hw * (1 - q.t), q.y + sgn * q.ny * hw * (1 - q.t)));
    const n0 = pts[0], [lx, ly] = edge(b, bx + n0.nx * hw - cx, by + n0.ny * hw - cy), [rx, ry] = edge(b, bx - n0.nx * hw - cx, by - n0.ny * hw - cy);
    const inn = (x, y) => { const d = Math.hypot(cx - x, cy - y) || 1, k = Math.min(9 + (b._amp || 0) + bw / 2, d * .5) / d; return [x + (cx - x) * k, y + (cy - y) * k]; };
    const [lix, liy] = inn(lx, ly), [rix, riy] = inn(rx, ry);
    const left = side(1), right = side(-1).reverse(), outline = 'M' + P(lx, ly) + [...left, P(tx, ty), ...right].map(q => ' L' + q).join('') + ' L' + P(rx, ry);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'tail'); s.setAttribute('width', '1'); s.setAttribute('height', '1');
    s.innerHTML = '<path class="f" d="M' + P(lix, liy) + ' L' + outline.slice(1) + ' L' + P(rix, riy) + 'Z"/><path class="s" d="' + outline + '"' + (b.classList.contains('vx') ? ' style="stroke-width:' + bw + 'px' + (bw ? '' : ';display:none') + (b.dataset.bstyle === 'dashed' ? ';stroke-dasharray:' + (3 + (+b.dataset.bamt || 40) * .25).toFixed(1) + ' ' + (2 + (+b.dataset.bamt || 40) * .17).toFixed(1) : '') + '"' : '') + '/>';
    b.append(s);
  }
  function handle(b) {
    const t = document.createElement('i'); t.className = 'tiph'; t.dataset.k = b.dataset.k; t.title = 'Drag to aim the tail';
    t.style.left = b._tip[0] + 'px'; t.style.top = b._tip[1] + 'px';
    return t;
  }

  // ── Style panel (Layout mode, tap a bubble) ──────────────────────────────────────────────────
  function current(b) {
    const boxes = [...host.querySelectorAll('.cimg')], top = b.offsetTop;
    let i = boxes.findIndex(x => top < x.offsetTop + x.offsetHeight); if (i < 0) i = boxes.length - 1;
    const box = boxes[i], hw = host.offsetWidth;
    return { img: i, x: +(b.offsetLeft / hw * 100).toFixed(1), y: +((top - box.offsetTop) / box.offsetHeight * 100).toFixed(1), w: +(b.offsetWidth / hw * 100).toFixed(1) };
  }
  const bubbleEl = key => host?.querySelector('.bub[data-k="' + CSS.escape(key) + '"]');
  function setStyle(key, patch) {
    const b = bubbleEl(key); if (!b) return;
    const old = placedFor(nodeId)[key];
    panelSave(p => { (p.bubbles ||= {})[key] = { ...(old || current(b)), style: { ...(old?.style || {}), ...patch } }; });
    refresh();
  }
  function bubbleSave(key, fn) {
    const b = bubbleEl(key); if (!b) return;
    const old = placedFor(nodeId)[key];
    panelSave(p => { const v = { ...(old || current(b)) }; if (old?.style) v.style = { ...old.style }; fn(v); if (v.style && !Object.keys(v.style).length) delete v.style; (p.bubbles ||= {})[key] = v; });
  }
  // "Use for all of X's lines" / "Use for every line in this panel": copy this bubble's look (not its
  // tail, which belongs to one bubble's position) and drop the per-bubble overrides that would hide it.
  const lookOf = st => ({ ...(st.kind === 'text' ? { kind: 'text', color: st.color } : { kind: 'voice', color: st.color, bw: st.bw, bstyle: st.bstyle, bamt: st.bamt, rad: st.rad }), ...(st.size !== 'm' ? { size: st.size } : {}) });
  function makeDefault(scope) {
    const b = bubbleEl(selected); if (!b) return;
    const st = styleOf(placedFor(nodeId)[selected]?.style, b.dataset.sp, nodeId), look = lookOf(st), speaker = b.dataset.sp;
    save(all => {
      if (scope === 'speaker') (all._speakers ||= {})[speaker] = look; else ((all[ch] ||= {})[nodeId] ||= {}).style = look;
      // Clear the per-bubble looks this default should replace: every bubble in this panel, or this
      // speaker's bubbles in this chapter (other chapters keep any look set there on purpose).
      const nodes = all[ch] || {};
      for (const [nid, p] of Object.entries(nodes)) {
        if (scope === 'panel' && nid !== nodeId) continue;
        if (!D.chapter.nodes[nid]) continue;
        const who = Object.fromEntries(lines(nid).map(l => [l.key, l.speaker]));
        for (const [k, v] of Object.entries(p.bubbles || {})) {
          if (!v.style || (scope === 'speaker' && who[k] !== speaker)) continue;
          for (const k of ['kind', 'color', 'border', 'size', 'bw', 'bstyle', 'bamt', 'rad']) delete v.style[k]; if (!Object.keys(v.style).length) delete v.style;
        }
      }
    });
    refresh();
  }
  const LBL = { twidth: v => v ? v + 'px' : 'Auto', tcurve: v => v ? (v < 0 ? '◀ ' : '') + Math.abs(v) + (v > 0 ? ' ▶' : '') : 'Straight', bw: v => v ? v + 'px' : 'None', bamt: v => String(v), rad: v => v <= 0 ? 'Square' : v >= 50 ? 'Oval' : v + '%' };
  const range = (cs, label, min, max, step, value, shown = value) => '<label>' + label + ' <output>' + LBL[cs](shown) + '</output></label><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-cs="' + cs + '">';
  const prevOf = b => { const bs = [...host.querySelectorAll('.bub')]; for (let j = bs.indexOf(b) - 1; j >= 0; j--) if (!bs[j].classList.contains('cap')) return bs[j]; return null; };
  // On a wide screen the editor docks in the page's right-hand margin (owner 2026-11-24), so the bubble
  // stays in view while it changes; otherwise it opens under the bubble.
  function closePanel() {
    host?.querySelector('.cstyle')?.remove();
    try { parent.document.querySelectorAll('.cstyle.docked').forEach(x => x.remove()); } catch {}
  }
  function dockRoom() {
    try { const main = document.querySelector('main'); return main && innerWidth - main.getBoundingClientRect().right >= 330 && parent !== window; } catch { return false; }
  }
  function panel() {
    closePanel();
    const b = bubbleEl(selected); if (!b) return;
    const sp = b.dataset.sp, st = styleOf(placedFor(nodeId)[selected]?.style, sp, nodeId);
    const p = document.createElement('div'); p.className = 'cstyle';
    const opt = (group, val, label, on) => '<button data-cs="' + group + '" data-v="' + val + '"' + (on ? ' aria-pressed="true"' : '') + '>' + label + '</button>';
    let h = '<div class="csh"><b>Bubble style</b><button data-cs="close" aria-label="Close">✕</button></div>';
    const sizeRow = '<label>Text size</label><div class="csr">' + Object.entries(SIZES).map(([v, [l]]) => opt('size', v, l, st.size === v)).join('') + '</div>';
    if (st.kind === 'caption') h += sizeRow + '<p class="muted">Narration is a caption box. Move or resize it; double-tap to edit its words.</p>';
    else {
      h += '<div class="csr">' + opt('kind', 'text', '📱 Text', st.kind === 'text') + opt('kind', 'voice', '🗣 Voice', st.kind === 'voice') + '</div>';
      const colors = st.kind === 'text' ? TEXT_COLORS : VOICE_COLORS;
      h += '<label>Color</label><div class="csr">' + Object.entries(colors).map(([v, l]) => opt('color', v, '<i class="sw ' + (st.kind === 'text' ? 't-' : 'v-') + v + '"></i>' + l, st.color === v)).join('') + '</div>';
      if (st.kind === 'voice') {
        h += range('bw', 'Border thickness', 0, 10, 1, st.bw)
          + '<label>Border style</label><div class="csr">' + Object.entries(BSTYLES).map(([v, l]) => opt('bstyle', v, l, st.bstyle === v)).join('') + '</div>'
          + (st.bstyle !== 'solid' ? range('bamt', { dashed: 'Dash size', wavy: 'Wave size', pointy: 'Point size' }[st.bstyle], 1, 100, 1, st.bamt) : '')
          + range('rad', 'Corners', 0, 50, 1, st.rad);
      }
      h += sizeRow;
      h += '<label>Tail</label><div class="csr">' + (b._tip ? opt('tailoff', '1', 'Remove tail') : opt('tailon', '1', '+ Add tail')) + '</div>';
      if (b._tip) h += '<p class="muted">Drag the orange dot to aim the tail (at the speaker’s mouth, say). It stays aimed there when you move the bubble.</p><label>Where it leaves the bubble</label><div class="clock">' + Array.from({ length: 24 }, (_, i) => {
        const hr = (i + 1) / 2, a = hr * 30 * Math.PI / 180, whole = Number.isInteger(hr), r = whole ? 56 : 36;
        return '<button data-cs="tbase" data-v="' + hr + '" class="' + (whole ? 'hr' : 'half') + '" title="' + (whole ? hr + ':00' : Math.floor(hr) + ':30') + '" style="left:calc(50% + ' + (Math.sin(a) * r).toFixed(1) + 'px);top:calc(50% - ' + (Math.cos(a) * r).toFixed(1) + 'px)"' + (st.tbase === hr ? ' aria-pressed="true"' : '') + '>' + (whole ? hr : '') + '</button>';
      }).join('') + '<button data-cs="tbase" data-v="0" class="none"' + (!st.tbase ? ' aria-pressed="true"' : '') + ' title="Leave from the side nearest the tip">Auto</button></div>';
      if (b._tip) {
        const ts = st.tshape || 'straight';
        h += '<label>Tail shape</label><div class="csr">' + opt('tshape', 'straight', 'Straight', ts === 'straight') + opt('tshape', 'bolt', '⚡ Bolt', ts === 'bolt') + opt('tshape', 'dots', '∘ Dots', ts === 'dots') + '</div>';
        h += range('twidth', 'Tail width', 2, 80, 1, st.twidth || 2, st.twidth) + range('tcurve', 'Tail curve', -100, 100, 5, st.tcurve);
      }
      if (st.kind === 'voice' && prevOf(b)) h += '<label>Conversation</label><div class="csr">' + opt('link', '1', '🔗 Connect to the bubble before', !!b._link) + '</div>';
      h += '<label>Make this the default</label><div class="csr">' + opt('default', 'speaker', 'All of ' + esc(sp) + '’s lines') + opt('default', 'panel', 'Every line in this panel') + opt('default', 'clear', 'Reset this bubble') + '</div>';
    }
    p.innerHTML = h;
    p.addEventListener('click', onPanelClick);
    if (dockRoom()) {
      const pd = parent.document, q = pd.createElement('div'); q.className = 'cstyle docked'; q.innerHTML = h; q.addEventListener('click', onPanelClick);
      const top = Math.max(12, (pd.querySelector('header')?.getBoundingClientRect().bottom || 0) + 12);
      q.style.top = top + 'px'; q.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)';
      pd.body.append(q); p.remove(); return wire(q, b);
    }
    p.style.top = Math.min(b.offsetTop + b.offsetHeight + 10, Math.max(0, host.offsetHeight - 40)) + 'px';
    p.style.left = Math.max(0, Math.min(b.offsetLeft, host.offsetWidth - 310)) + 'px';
    host.append(p);
    wire(p, b);
  }
  function wire(p, b) {
    // Width (far left = Auto) and curve sliders: redraw while dragging, save when let go.
    p.querySelectorAll('input[type=range]').forEach(r => {
      const val = () => r.dataset.cs === 'twidth' ? (+r.value < 4 ? 0 : +r.value) : +r.value;
      r.addEventListener('input', () => { const v = val(); r.previousElementSibling.querySelector('output').textContent = LBL[r.dataset.cs](v); b.dataset[r.dataset.cs] = v; drawShape(b); tail(b); drawLinks(); });
      r.addEventListener('change', () => setStyle(selected, { [r.dataset.cs]: val() }));
    });
    parent.postMessage({ fit: 1 }, '*');
  }
  function onPanelClick(e) {
    const t = e.target.closest('button[data-cs]'); if (!t || !mode) return;
    e.preventDefault();
    const g = t.dataset.cs, v = t.dataset.v;
    if (g === 'close') { selected = null; refresh(); }
    else if (g === 'kind') setStyle(selected, { kind: v, color: v === 'text' ? 'blue' : 'white' });
    else if (g === 'color') setStyle(selected, { color: v });
    else if (g === 'border') setStyle(selected, { border: v });
    else if (g === 'size') setStyle(selected, { size: v });
    else if (g === 'tbase') setStyle(selected, { tbase: +v });
    else if (g === 'tshape') setStyle(selected, { tshape: v });
    else if (g === 'bstyle') setStyle(selected, { bstyle: v });
    else if (g === 'link') { bubbleSave(selected, x => { if (x.link) delete x.link; else x.link = true; }); refresh(); }
    else if (g === 'tailon') { const b = bubbleEl(selected), W = host.offsetWidth || 1; if (!b) return;
      const x = b.offsetLeft + b.offsetWidth * .35, y = b.offsetTop + b.offsetHeight + Math.max(34, b.offsetHeight * .5);
      bubbleSave(selected, v => { v.tip = { x: +(x / W * 100).toFixed(1), y: +(y / W * 100).toFixed(1) }; }); refresh(); }
    else if (g === 'tailoff') { bubbleSave(selected, v => { delete v.tip; if (v.style) { for (const k of ['tail', 'tlen', 'tbase', 'tshape', 'tcurve', 'twidth']) delete v.style[k]; } }); refresh(); }
    else if (g === 'default') {
      if (v === 'clear') { const old = placedFor(nodeId)[selected]; if (old) panelSave(p => { const keep = { ...old }; delete keep.style; (p.bubbles ||= {})[selected] = keep; }); refresh(); }
      else makeDefault(v);
    }
  }

  // ── Edit a bubble's words: double-tap / double-click opens the same ✎ editor as the script ────
  function editWords(key) {
    let pen = null;
    if (key.startsWith('add:')) pen = document.querySelector('.rtr-pen[data-add="' + CSS.escape(key.slice(4)) + '"]');
    else for (const p of document.querySelectorAll('.card .beat p')) if (p.dataset.rtrOrig === key) { pen = p.querySelector('.rtr-pen:not(.rtr-branch)'); break; }
    pen?.click();
  }
  document.addEventListener('dblclick', e => { if (mode) return; const b = e.target.closest('.bub'); if (b && host?.contains(b)) editWords(b.dataset.k); });

  // ── Layout mode: drag to move, grip to resize, tap to style, double-tap to edit; image tools ───
  let drag = null;
  let aim = null;
  document.addEventListener('pointerdown', e => {
    const th = mode && e.target.closest('.tiph');
    if (th && host?.contains(th)) {
      e.preventDefault(); th.setPointerCapture(e.pointerId);
      const hr = host.getBoundingClientRect();
      aim = { t: th, b: bubbleEl(th.dataset.k), dx: e.clientX - hr.left - th.offsetLeft, dy: e.clientY - hr.top - th.offsetTop };
      closePanel(); return;
    }
    if (!mode || e.target.closest('.cstyle')) return;
    const b = e.target.closest('.bub'); if (!b || !host?.contains(b)) return;
    e.preventDefault(); b.setPointerCapture(e.pointerId);
    const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
    drag = { b, moved: false, resize: !!e.target.closest('.grip'), sx: e.clientX, sy: e.clientY, left: r.left - hr.left, top: r.top - hr.top, width: r.width, hw: hr.width };
    b.classList.add('dragging');
  });
  document.addEventListener('pointermove', e => {
    if (aim) {
      const hr = host.getBoundingClientRect(), x = e.clientX - hr.left - aim.dx, y = e.clientY - hr.top - aim.dy;
      aim.t.style.left = x + 'px'; aim.t.style.top = y + 'px'; if (aim.b) { aim.b._tip = [x, y]; tail(aim.b); } return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; closePanel();
    if (drag.resize) drag.b.style.width = Math.max(12, Math.min(96, (drag.width + dx) / drag.hw * 100)) + '%';
    else { drag.b.style.left = Math.max(-2, Math.min(98, (drag.left + dx) / drag.hw * 100)) + '%'; drag.b.style.top = (drag.top + dy) + 'px'; }
    if (drag.resize) drawShape(drag.b);
    tail(drag.b); drawLinks();
  });
  document.addEventListener('pointerup', () => {
    if (aim) {
      const { t, b } = aim, W = host.offsetWidth || 1; aim = null;
      if (b) { bubbleSave(t.dataset.k, v => { v.tip = { x: +(t.offsetLeft / W * 100).toFixed(1), y: +(t.offsetTop / W * 100).toFixed(1) }; if (v.style) { delete v.style.tail; delete v.style.tlen; } }); refresh(); }
      return;
    }
    if (!drag) return;
    const { b, moved } = drag; drag = null; b.classList.remove('dragging');
    const key = b.dataset.k;
    if (!moved) {
      const now = Date.now(), twice = lastTap.key === key && now - lastTap.at < 400;
      lastTap = { key, at: now };
      if (twice) { editWords(key); return; }                    // double-tap: edit the words
      selected = key; refresh(); return;                         // tap: style panel
    }
    const pos = current(b), old = placedFor(nodeId)[key];
    panelSave(p => { (p.bubbles ||= {})[key] = { ...(old || {}), ...pos }; });
    b.classList.add('placed');
  });

  // ── Images: swap / add / remove / upload ─────────────────────────────────────────────────────
  // Upload (owner 2026-11-23): shrink in the browser (max 1800px, JPEG), send with the publishing
  // passcode to /api/dialogue2/upload, which saves it to Story Playtest 2/images; the publish Action
  // turns it into web art in a few minutes. The panel is set to use it right away; it shows once live.
  async function upload(file, name) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / bmp.width);
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    let pass = ''; try { pass = localStorage.getItem(PASS_KEY) || ''; } catch {}
    if (!pass) pass = prompt('Publishing passcode:') || '';
    if (!pass) throw new Error('Cancelled.');
    const r = await fetch('/api/dialogue2/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pass, name, data: b64 }) });
    const out = await r.json().catch(() => ({}));
    if (r.status === 401) { try { localStorage.removeItem(PASS_KEY); } catch {} throw new Error('Wrong passcode.'); }
    if (!r.ok || !out.ok) throw new Error(out.error || 'Upload failed (' + r.status + ').');
    try { localStorage.setItem(PASS_KEY, pass); } catch {}
    return out.name;
  }
  // Uploads are named "<chapter>-<panel>-upload-<n>" so they never attach to a panel by themselves
  // (only "<chapter>-<panel>-<n>" art does); the picker puts them where they're wanted.
  const nextName = () => { const base = (ch + '-' + nodeId + '-upload-').toLowerCase(); let i = 1; while (D.allImages[base + i]) i++; return base + i; };
  function remember(name) {
    const all = readUploads(); all[name] = rawUrl(name);
    try { localStorage.setItem(UKEY, JSON.stringify(all)); } catch {}
    D.allImages[name] = all[name];
  }
  function picker(onPick) {
    const back = document.createElement('div'); back.className = 'cpick';
    back.innerHTML = '<div><p><b>Pick an image</b> <button data-cclose="1">Cancel</button> <label class="cup">⬆ Upload new image<input type="file" accept="image/*" hidden></label> <span class="muted cupmsg"></span></p><div class="cgrid">'
      + Object.keys(D.allImages).sort().map(name => '<button data-cpick="' + esc(name) + '"><img alt="" loading="lazy" src="' + esc(D.allImages[name]) + '"><span>' + esc(name) + '</span></button>').join('') + '</div></div>';
    back.addEventListener('click', e => {
      const p = e.target.closest('[data-cpick]'); if (p) { back.remove(); onPick(p.dataset.cpick); }
      else if (e.target === back || e.target.closest('[data-cclose]')) back.remove();
    });
    back.querySelector('input[type=file]').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      const msg = back.querySelector('.cupmsg'); msg.textContent = 'Uploading…';
      try {
        const name = await upload(f, nextName()); remember(name);
        back.remove(); onPick(name);
        alert('Uploaded as ' + name + '. It’s on this panel now and in the image list. Publish my edits to keep it on this panel for everyone.');
      } catch (err) { msg.textContent = err.message; }
    });
    document.body.append(back); parent.postMessage({ fit: 1 }, '*'); back.scrollIntoView({ block: 'start' });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-cswap],[data-cdel],[data-cadd],[data-creset]'); if (!t || !mode) return;
    const imgs = (saved()[nodeId] || {}).images ?? D.chapter.nodes[nodeId].images ?? D.autoImages[nodeId] ?? [];
    if (t.dataset.cswap != null) picker(name => { panelSave(p => { const a = [...imgs]; a[+t.dataset.cswap] = name; p.images = a; }); refresh(); });
    else if (t.dataset.cdel != null) { panelSave(p => { p.images = imgs.filter((_, i) => i !== +t.dataset.cdel); }); refresh(); }
    else if (t.dataset.cadd) picker(name => { panelSave(p => { p.images = [...imgs, name]; }); refresh(); });
    else if (t.dataset.creset && confirm('Reset this panel’s images, bubble positions and styles to the published version?')) { panelSave(p => { delete p.images; delete p.bubbles; delete p.style; }); selected = null; refresh(); }
  });

  // ⌘Z / Ctrl+Z inside a chapter page reach the header's Undo / Redo.
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.target.closest?.('input,textarea,[contenteditable]')) return;
    e.preventDefault(); try { e.shiftKey ? parent.RTR_REDO?.() : parent.RTR_UNDO?.(); } catch {}
  });
  window.RTR_COMIC = { render, refresh, setMode(on) { mode = !!on; if (!mode) selected = null; refresh(); } };
})();
