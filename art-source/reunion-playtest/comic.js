// Comic panels for /dialogue2 chapter pages (owner 2026-11-23): each panel's art stacked like a strip,
// its dialogue as speech bubbles (narration as gold caption boxes) on top, and a Layout mode to drag
// bubbles, resize them, style them, and swap/add/remove images. Runs inside each chapter iframe; uses D
// (the chapter page's data) and the parent's localStorage (same origin).
//
// Bubble vocabulary follows the "RTR Comic Book V2" spec (owner decisions 2026-09-09): Patrick Hand for
// spoken dialogue, Comic Neue bold caps for captions, white oval speech, cream for the player, jagged
// shout, dashed whisper, thought cloud with trailing dots, squared phone/radio with a ⚡.
// Owner 2026-11-23 style picker: tap a bubble in Layout → Text (Blue / Green / White, like iMessage) or
// Voice (Color → Border → Tail, the tail pointing where an hour hand would at 1–12 o'clock).
//
// Saved layout (this browser, until published):  rtr.dialogue2.layout.v1
//   { [chapterId]: { [nodeId]: { images?: [imageName…],
//       bubbles?: { [shownText]: {img, x, y, w, style?: {kind:'text'|'voice', color, border, tail}} } } } }
// x / y / w are percent of the image the bubble sits on; img is the image's index in the panel.
// Published layout lives in story.json as node.images / node.bubbles (apply-edits.mjs).
(() => {
  const LKEY = 'rtr.dialogue2.layout.v1', EKEY = 'rtr.dialogue2.edits.v1';
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const shown = t => norm(String(t ?? '').replace(/\*([^*\n]+)\*/g, '$1'));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => esc(t).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
  const ch = D.chapter.id;
  const TEXT_COLORS = { blue: 'Blue', green: 'Green', white: 'White' };
  const VOICE_COLORS = { white: 'White', cream: 'Cream', yellow: 'Yellow' };
  const BORDERS = { normal: 'Normal', shout: 'Shout', whisper: 'Whisper', thought: 'Thought', radio: 'Phone / radio' };
  let mode = false, nodeId = null, host = null, selected = null;
  try { mode = !!parent.RTR_LAYOUT_ON; } catch {}

  const saved = () => read(LKEY)[ch] || {};
  function save(nid, fn) {
    const all = read(LKEY), mine = (all[ch] ||= {}), p = (mine[nid] ||= {});
    fn(p);
    if (!p.images && !(p.bubbles && Object.keys(p.bubbles).length)) delete mine[nid];
    if (!Object.keys(mine).length) delete all[ch];
    try { localStorage.setItem(LKEY, JSON.stringify(all)); } catch {}
    try { parent.RTR_LAYOUT_CHANGED?.(); } catch {}
  }
  const imagesFor = nid => {
    const n = D.chapter.nodes[nid], p = saved()[nid] || {};
    return (p.images ?? n.images ?? D.autoImages[nid] ?? []).filter(name => D.allImages[name]);
  };
  const placedFor = nid => ({ ...(D.chapter.nodes[nid].bubbles || {}), ...((saved()[nid] || {}).bubbles || {}) });
  // Lines as they read now: the script plus this browser's ✎ edits (removed lines get no bubble).
  function lines(nid) {
    const n = D.chapter.nodes[nid], edits = read(EKEY)[ch] || {}, out = [];
    for (const b of n.beats) {
      const key = shown(b.text), e = edits[key];
      if (e?.deleted) continue;
      out.push({ key, speaker: b.speaker, text: e && typeof e.text === 'string' ? e.text : b.text });
    }
    return out;
  }
  // Until a bubble is placed: spread the lines over the panel's images, top to bottom, alternating sides.
  function defaultPos(i, count, imgCount) {
    const per = Math.max(1, Math.ceil(count / Math.max(1, imgCount))), j = i % per;
    return { img: Math.min(imgCount - 1, Math.floor(i / per)), x: j % 2 ? 51 : 3, y: 4 + j * Math.min(26, 84 / per), w: 44 };
  }
  // Style with defaults: voice / white / normal / no tail. Text bubbles: sent (blue, green) tail at 4
  // o'clock, received (white) at 8, like a phone.
  function styleOf(s, speaker) {
    if (speaker === 'Scene') return { kind: 'caption' };
    const kind = s?.kind === 'text' ? 'text' : 'voice';
    if (kind === 'text') { const color = TEXT_COLORS[s.color] ? s.color : 'blue'; return { kind, color, tail: color === 'white' ? 8 : 4 }; }
    return { kind, color: VOICE_COLORS[s?.color] ? s.color : 'white', border: BORDERS[s?.border] ? s.border : 'normal', tail: s?.tail >= 1 && s?.tail <= 12 ? Math.round(s.tail) : 0 };
  }
  const classes = st => st.kind === 'caption' ? 'bub cap' : st.kind === 'text' ? 'bub txt t-' + st.color : 'bub v-' + st.color + ' b-' + st.border;

  function render(nid, el) {
    nodeId = nid; host = el;
    const n = D.chapter.nodes[nid], imgs = imagesFor(nid), placed = placedFor(nid);
    el.classList.toggle('layout', mode);
    if (!imgs.length) {
      el.innerHTML = mode ? '<div class="cempty">No art for this panel yet.<button data-cadd="1">+ Add an image</button></div>' : '';
      return;
    }
    const L = lines(nid);
    el.innerHTML = imgs.map((name, i) => '<div class="cimg" data-i="' + i + '"><img alt="" src="' + esc(D.allImages[name]) + '">'
      + (mode ? '<div class="ctools"><button data-cswap="' + i + '">Swap image</button>' + (imgs.length > 1 ? '<button data-cdel="' + i + '">Remove</button>' : '') + '<span>' + esc(name) + '</span></div>' : '') + '</div>').join('')
      + (mode ? '<div class="crow"><button data-cadd="1">+ Add image</button><button data-creset="1">Reset this panel</button><span class="muted">Drag a bubble to move it · tap it to style it</span></div>' : '')
      + L.map(l => {
        const st = styleOf(placed[l.key]?.style, l.speaker);
        const name = st.kind === 'caption' || (st.kind === 'text' && st.color !== 'white') ? '' : '<b>' + esc(l.speaker) + '</b>';
        return '<div class="' + classes(st) + (selected === l.key ? ' sel' : '') + '" data-k="' + esc(l.key) + '" data-tail="' + (st.tail || 0) + '">' + name + '<span>' + fmt(l.text) + '</span>'
          + (mode ? '<i class="grip" title="Drag to resize"></i>' : '') + '</div>';
      }).join('');
    const place = () => {
      const boxes = [...el.querySelectorAll('.cimg')];
      el.querySelectorAll('.bub').forEach((b, i) => {
        const p = placed[b.dataset.k] || defaultPos(i, L.length, imgs.length), box = boxes[Math.min(p.img ?? 0, boxes.length - 1)];
        b.style.left = p.x + '%'; b.style.width = p.w + '%';
        b.style.top = (box.offsetTop + box.offsetHeight * p.y / 100) + 'px';
        b.classList.toggle('placed', !!placed[b.dataset.k]);
        tail(b);
      });
      if (mode && selected) panel();
      parent.postMessage({ fit: 1 }, '*');
    };
    el.querySelectorAll('img').forEach(im => im.complete ? 0 : im.addEventListener('load', place, { once: true }));
    place(); new ResizeObserver(place).observe(el);
  }

  // Tail: a triangle (or, for thought, three shrinking dots) leaving the bubble's edge in the direction
  // an hour hand points at that hour. Ellipse edge for oval bubbles, rectangle edge for boxy ones.
  function tail(b) {
    b.querySelectorAll('.tail').forEach(t => t.remove());
    const h = +b.dataset.tail; if (!h || b.classList.contains('cap')) return;
    const w = b.offsetWidth, ht = b.offsetHeight, th = h * 30 * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th);
    const oval = b.classList.contains('b-normal') || b.classList.contains('b-whisper') || b.classList.contains('b-thought');
    const t = oval ? 1 / Math.sqrt((dx / (w / 2)) ** 2 + (dy / (ht / 2)) ** 2) : Math.min(Math.abs(w / 2 / (dx || 1e-9)), Math.abs(ht / 2 / (dy || 1e-9)));
    const x = w / 2 + dx * t, y = ht / 2 + dy * t, deg = h * 30;
    if (b.classList.contains('b-thought')) {
      [7, 13, 18].forEach((d, i) => {
        const r = 7 - i * 2, dot = document.createElement('i'); dot.className = 'tail dot';
        Object.assign(dot.style, { width: r * 2 + 'px', height: r * 2 + 'px', left: x + dx * (d + i * 4) - r + 'px', top: y + dy * (d + i * 4) - r + 'px' });
        b.append(dot);
      });
      return;
    }
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'tail'); s.setAttribute('viewBox', '0 0 22 20'); s.setAttribute('width', '22'); s.setAttribute('height', '20');
    s.innerHTML = b.classList.contains('b-radio') ? '<path d="M3 0 L11 7 L7 9 L15 20 L9 9 L13 7 L19 0"/>' : '<path d="M3 0 L11 19 L19 0"/>';
    // The svg's base centre sits on the edge (2px inside, to cover the border); rotate so its tip points out.
    Object.assign(s.style, { left: x - 11 - dx * 2 + 'px', top: y - dy * 2 + 'px', transformOrigin: '11px 0', transform: 'rotate(' + (deg + 180) + 'deg)' });
    b.append(s);
  }

  // ── Style panel (Layout mode, tap a bubble) ──────────────────────────────────────────────────
  function current(b) {
    const boxes = [...host.querySelectorAll('.cimg')], top = b.offsetTop;
    let i = boxes.findIndex(x => top < x.offsetTop + x.offsetHeight); if (i < 0) i = boxes.length - 1;
    const box = boxes[i], hw = host.offsetWidth;
    return { img: i, x: +(b.offsetLeft / hw * 100).toFixed(1), y: +((top - box.offsetTop) / box.offsetHeight * 100).toFixed(1), w: +(b.offsetWidth / hw * 100).toFixed(1) };
  }
  function setStyle(key, patch) {
    const b = host.querySelector('.bub[data-k="' + CSS.escape(key) + '"]'); if (!b) return;
    const placed = placedFor(nodeId), was = placed[key] || current(b);
    save(nodeId, p => { (p.bubbles ||= {})[key] = { ...was, ...(placed[key] ? {} : current(b)), style: { ...(was.style || {}), ...patch } }; });
    window.RTR_RERENDER?.();
  }
  function panel() {
    host.querySelector('.cstyle')?.remove();
    const b = host.querySelector('.bub[data-k="' + CSS.escape(selected) + '"]'); if (!b) return;
    const line = lines(nodeId).find(l => l.key === selected), st = styleOf(placedFor(nodeId)[selected]?.style, line?.speaker);
    const p = document.createElement('div'); p.className = 'cstyle';
    const opt = (group, val, label, on) => '<button data-cs="' + group + '" data-v="' + val + '"' + (on ? ' aria-pressed="true"' : '') + '>' + label + '</button>';
    let h = '<div class="csh"><b>Bubble style</b><button data-cs="close" aria-label="Close">✕</button></div>';
    if (st.kind === 'caption') h += '<p class="muted">Narration is a caption box. Move or resize it; it has no style options.</p>';
    else {
      h += '<div class="csr">' + opt('kind', 'text', '📱 Text', st.kind === 'text') + opt('kind', 'voice', '🗣 Voice', st.kind === 'voice') + '</div>';
      if (st.kind === 'text') h += '<label>Color</label><div class="csr">' + Object.entries(TEXT_COLORS).map(([v, l]) => opt('color', v, '<i class="sw t-' + v + '"></i>' + l, st.color === v)).join('') + '</div>';
      else {
        h += '<label>Color</label><div class="csr">' + Object.entries(VOICE_COLORS).map(([v, l]) => opt('color', v, '<i class="sw v-' + v + '"></i>' + l, st.color === v)).join('') + '</div>';
        h += '<label>Border</label><div class="csr">' + Object.entries(BORDERS).map(([v, l]) => opt('border', v, l, st.border === v)).join('') + '</div>';
        h += '<label>Tail — the hour the tail points to</label><div class="clock">' + Array.from({ length: 12 }, (_, i) => {
          const hr = i + 1, a = hr * 30 * Math.PI / 180;
          return '<button data-cs="tail" data-v="' + hr + '" style="left:calc(50% + ' + (Math.sin(a) * 42).toFixed(1) + 'px - 13px);top:calc(50% - ' + (Math.cos(a) * 42).toFixed(1) + 'px - 13px)"' + (st.tail === hr ? ' aria-pressed="true"' : '') + '>' + hr + '</button>';
        }).join('') + '<button data-cs="tail" data-v="0" class="none"' + (!st.tail ? ' aria-pressed="true"' : '') + ' title="No tail">✕</button></div>';
      }
    }
    p.innerHTML = h;
    p.style.top = Math.min(b.offsetTop + b.offsetHeight + 10, Math.max(0, host.offsetHeight - 40)) + 'px';
    p.style.left = Math.max(0, Math.min(b.offsetLeft, host.offsetWidth - 300)) + 'px';
    host.append(p);
    parent.postMessage({ fit: 1 }, '*');
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-cs]'); if (!t || !mode) return;
    e.preventDefault();
    const g = t.dataset.cs, v = t.dataset.v;
    if (g === 'close') { selected = null; window.RTR_RERENDER?.(); return; }
    if (g === 'kind') setStyle(selected, v === 'text' ? { kind: 'text' } : { kind: 'voice' });
    else if (g === 'color') setStyle(selected, { color: v });
    else if (g === 'border') setStyle(selected, { border: v });
    else if (g === 'tail') setStyle(selected, { tail: +v });
  });

  // ── Layout mode: drag to move, grip to resize, tap to style; image tools ───────────────────────
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (!mode || e.target.closest('.cstyle')) return;
    const b = e.target.closest('.bub'); if (!b || !host?.contains(b)) return;
    e.preventDefault(); b.setPointerCapture(e.pointerId);
    const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
    drag = { b, moved: false, resize: !!e.target.closest('.grip'), sx: e.clientX, sy: e.clientY, left: r.left - hr.left, top: r.top - hr.top, width: r.width, hw: hr.width };
    b.classList.add('dragging');
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; host.querySelector('.cstyle')?.remove();
    if (drag.resize) drag.b.style.width = Math.max(12, Math.min(96, (drag.width + dx) / drag.hw * 100)) + '%';
    else { drag.b.style.left = Math.max(-2, Math.min(98, (drag.left + dx) / drag.hw * 100)) + '%'; drag.b.style.top = (drag.top + dy) + 'px'; }
    tail(drag.b);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const { b, moved } = drag; drag = null; b.classList.remove('dragging');
    if (!moved) { selected = b.dataset.k; window.RTR_RERENDER?.(); return; }   // a tap: open the style panel
    const pos = current(b), old = placedFor(nodeId)[b.dataset.k];
    save(nodeId, p => { (p.bubbles ||= {})[b.dataset.k] = { ...pos, ...(old?.style ? { style: old.style } : {}) }; });
    b.classList.add('placed');
    if (selected) panel();
  });

  function picker(onPick) {
    const back = document.createElement('div'); back.className = 'cpick';
    back.innerHTML = '<div><p><b>Pick an image</b> <button data-cclose="1">Cancel</button></p><div class="cgrid">'
      + Object.keys(D.allImages).sort().map(name => '<button data-cpick="' + esc(name) + '"><img alt="" loading="lazy" src="' + esc(D.allImages[name]) + '"><span>' + esc(name) + '</span></button>').join('') + '</div></div>';
    back.addEventListener('click', e => {
      const p = e.target.closest('[data-cpick]'); if (p) { back.remove(); onPick(p.dataset.cpick); }
      else if (e.target === back || e.target.closest('[data-cclose]')) back.remove();
    });
    document.body.append(back); parent.postMessage({ fit: 1 }, '*'); back.scrollIntoView({ block: 'start' });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-cswap],[data-cdel],[data-cadd],[data-creset]'); if (!t || !mode) return;
    const imgs = imagesFor(nodeId), again = () => window.RTR_RERENDER?.();
    if (t.dataset.cswap != null) picker(name => { save(nodeId, p => { const a = [...imgs]; a[+t.dataset.cswap] = name; p.images = a; }); again(); });
    else if (t.dataset.cdel != null) { save(nodeId, p => { p.images = imgs.filter((_, i) => i !== +t.dataset.cdel); }); again(); }
    else if (t.dataset.cadd) picker(name => { save(nodeId, p => { p.images = [...imgs, name]; }); again(); });
    else if (t.dataset.creset && confirm('Reset this panel’s images, bubble positions and styles to the published version?')) { save(nodeId, p => { delete p.images; delete p.bubbles; }); selected = null; again(); }
  });

  window.RTR_COMIC = { render, setMode(on) { mode = !!on; if (!mode) selected = null; window.RTR_RERENDER?.(); } };
})();
