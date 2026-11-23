// Comic panels for /dialogue2 chapter pages (owner 2026-11-23): each panel's art stacked like a strip,
// its dialogue as speech bubbles (narration as gold caption boxes) on top, and a Layout mode to drag
// bubbles, resize them, style them, and swap/add/remove/upload images. Runs inside each chapter iframe;
// uses D (the chapter page's data) and the parent's localStorage (same origin).
//
// Lettering follows the "RTR Comic Book V2" spec (owner decisions 2026-09-09): Patrick Hand for spoken
// lines, Comic Neue bold caps for captions. Style picker (owner 2026-11-23): tap a bubble in Layout →
// Text (Blue / Green / White) or Voice (Color → Border → Tail). Tails are off unless added: 24 angles
// (every half hour on a clock face) and a length.
//
// Which style a bubble gets, first match wins:
//   1. its own style                       layout bubbles[key].style  / node.bubbles[key].style
//   2. the panel default                   layout[ch][node].style     / node.style
//   3. the speaker default (all chapters)  layout._speakers[speaker]  / story speakerStyles
//   4. plain voice bubble, white, no tail
//
// Saved layout (this browser, until published):  rtr.dialogue2.layout.v1
//   { _speakers?: {[speaker]: style}, [chapterId]: { [nodeId]: { images?, style?, bubbles?: {[key]: {img,x,y,w,style?}} } } }
// Bubble keys: a line's text as shown (*italics* without asterisks), or "add:<id>" for a line added with ✎.
(() => {
  const LKEY = 'rtr.dialogue2.layout.v1', EKEY = 'rtr.dialogue2.edits.v1', AKEY = EKEY + '.adds', PASS_KEY = 'rtr.dialogue2.passcode';
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const shown = t => norm(String(t ?? '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/\[\+([^\]\n]+?)\+\]/g, '$1').replace(/\[-([^\]\n]+?)-\]/g, '$1'));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\[\+([^\]\n]+?)\+\]/g, '<span class="fx-big">$1</span>').replace(/\[-([^\]\n]+?)-\]/g, '<span class="fx-sm">$1</span>');
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
  const ch = D.chapter.id;
  const TEXT_COLORS = { blue: 'Blue', green: 'Green', white: 'White' };
  const VOICE_COLORS = { white: 'White', cream: 'Cream', yellow: 'Yellow' };
  const SIZES = { s: ['S', .8], m: ['M', 1], l: ['L', 1.2], xl: ['XL', 1.45] };
  const BORDERS = { normal: 'Normal', shout: 'Shout', whisper: 'Whisper', thought: 'Thought', radio: 'Phone / radio' };
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
  function lines(nid) {
    const n = D.chapter.nodes[nid], edits = read(EKEY)[ch] || {}, adds = (read(AKEY)[ch] || []).filter(a => a.kind === 'line' && !a.onChoice), out = [];
    for (const b of n.beats) {
      const key = shown(b.text), e = edits[key];
      if (!e?.deleted) out.push({ key, speaker: b.speaker, text: e && typeof e.text === 'string' ? e.text : b.text });
      for (const a of adds.filter(a => a.anchor === key)) out.push({ key: 'add:' + a.id, speaker: a.speaker === 'Narration' ? 'Scene' : a.speaker, text: a.text, added: true });
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
    const tlen = Math.max(8, Math.min(80, Math.round(+s.tlen || 18)));
    if (kind === 'text') return { kind, color: TEXT_COLORS[s.color] ? s.color : 'blue', tail, tlen, size };
    return { kind, color: VOICE_COLORS[s.color] ? s.color : 'white', border: BORDERS[s.border] ? s.border : 'normal', tail, tlen, size };
  }
  const classes = st => st.kind === 'caption' ? 'bub cap' : st.kind === 'text' ? 'bub txt t-' + st.color : 'bub v-' + st.color + ' b-' + st.border;

  let ro = null, sig = '';
  function render(nid, el) {
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
        const name = st.kind === 'caption' ? '' : '<b>' + esc(l.speaker) + '</b>';
        return '<div class="' + classes(st) + (selected === l.key ? ' sel' : '') + '" data-k="' + esc(l.key) + '" data-sp="' + esc(l.speaker) + '" data-tail="' + st.tail + '" data-tlen="' + st.tlen + '">' + name + '<span' + (st.size !== 'm' ? ' style="font-size:' + SIZES[st.size][1] + 'em"' : '') + '>' + fmt(l.text) + '</span>'
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
        tail(b);
      });
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
  function tail(b) {
    b.querySelectorAll('.tail').forEach(t => t.remove());
    const h = +b.dataset.tail, len = +b.dataset.tlen || 18; if (!h || b.classList.contains('cap')) return;
    const w = b.offsetWidth, ht = b.offsetHeight, th = h * 30 * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th);
    const oval = b.classList.contains('b-normal') || b.classList.contains('b-whisper') || b.classList.contains('b-thought');
    const t = oval ? 1 / Math.sqrt((dx / (w / 2)) ** 2 + (dy / (ht / 2)) ** 2) : Math.min(Math.abs(w / 2 / (dx || 1e-9)), Math.abs(ht / 2 / (dy || 1e-9)));
    const x = w / 2 + dx * t, y = ht / 2 + dy * t;
    if (b.classList.contains('b-thought')) {
      [0.35, 0.7, 1].forEach((f, i) => {
        const r = 7 - i * 2, d = 6 + len * f, dot = document.createElement('i'); dot.className = 'tail dot';
        Object.assign(dot.style, { width: r * 2 + 'px', height: r * 2 + 'px', left: x + dx * d - r + 'px', top: y + dy * d - r + 'px' });
        b.append(dot);
      });
      return;
    }
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'tail'); s.setAttribute('viewBox', '0 0 22 ' + (len + 2)); s.setAttribute('width', '22'); s.setAttribute('height', String(len + 2));
    s.innerHTML = b.classList.contains('b-radio')
      ? '<path d="M3 0 L11 ' + (len * .38).toFixed(1) + ' L7 ' + (len * .48).toFixed(1) + ' L15 ' + (len + 1) + ' L9 ' + (len * .48).toFixed(1) + ' L13 ' + (len * .38).toFixed(1) + ' L19 0"/>'
      : '<path d="M3 0 L11 ' + (len + 1) + ' L19 0"/>';
    Object.assign(s.style, { left: x - 11 - dx * 2 + 'px', top: y - dy * 2 + 'px', transformOrigin: '11px 0', transform: 'rotate(' + (h * 30 + 180) + 'deg)' });
    b.append(s);
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
  // "Use for all of X's lines" / "Use for every line in this panel": copy this bubble's look (not its
  // tail, which belongs to one bubble's position) and drop the per-bubble overrides that would hide it.
  const lookOf = st => ({ ...(st.kind === 'text' ? { kind: 'text', color: st.color } : { kind: 'voice', color: st.color, border: st.border }), ...(st.size !== 'm' ? { size: st.size } : {}) });
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
          delete v.style.kind; delete v.style.color; delete v.style.border; delete v.style.size; if (!Object.keys(v.style).length) delete v.style;
        }
      }
    });
    refresh();
  }
  function panel() {
    host.querySelector('.cstyle')?.remove();
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
      if (st.kind === 'voice') h += '<label>Border</label><div class="csr">' + Object.entries(BORDERS).map(([v, l]) => opt('border', v, l, st.border === v)).join('') + '</div>';
      h += sizeRow;
      h += '<label>Tail — the time the tail points to</label><div class="clock">' + Array.from({ length: 24 }, (_, i) => {
        const hr = (i + 1) / 2, a = hr * 30 * Math.PI / 180, whole = Number.isInteger(hr), r = whole ? 56 : 36;
        return '<button data-cs="tail" data-v="' + hr + '" class="' + (whole ? 'hr' : 'half') + '" title="' + (whole ? hr + ':00' : Math.floor(hr) + ':30') + '" style="left:calc(50% + ' + (Math.sin(a) * r).toFixed(1) + 'px);top:calc(50% - ' + (Math.cos(a) * r).toFixed(1) + 'px)"' + (st.tail === hr ? ' aria-pressed="true"' : '') + '>' + (whole ? hr : '') + '</button>';
      }).join('') + '<button data-cs="tail" data-v="0" class="none"' + (!st.tail ? ' aria-pressed="true"' : '') + ' title="No tail">✕</button></div>';
      if (st.tail) h += '<label>Tail length <output>' + st.tlen + 'px</output></label><input type="range" min="8" max="80" step="1" value="' + st.tlen + '" data-cs="tlen">';
      h += '<label>Make this the default</label><div class="csr">' + opt('default', 'speaker', 'All of ' + esc(sp) + '’s lines') + opt('default', 'panel', 'Every line in this panel') + opt('default', 'clear', 'Reset this bubble') + '</div>';
    }
    p.innerHTML = h;
    p.style.top = Math.min(b.offsetTop + b.offsetHeight + 10, Math.max(0, host.offsetHeight - 40)) + 'px';
    p.style.left = Math.max(0, Math.min(b.offsetLeft, host.offsetWidth - 310)) + 'px';
    host.append(p);
    const range = p.querySelector('input[data-cs="tlen"]');
    if (range) {
      range.addEventListener('input', () => { range.previousElementSibling.querySelector('output').textContent = range.value + 'px'; b.dataset.tlen = range.value; tail(b); });
      range.addEventListener('change', () => setStyle(selected, { tlen: +range.value }));
    }
    parent.postMessage({ fit: 1 }, '*');
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button[data-cs]'); if (!t || !mode) return;
    e.preventDefault();
    const g = t.dataset.cs, v = t.dataset.v;
    if (g === 'close') { selected = null; refresh(); }
    else if (g === 'kind') setStyle(selected, { kind: v, color: v === 'text' ? 'blue' : 'white' });
    else if (g === 'color') setStyle(selected, { color: v });
    else if (g === 'border') setStyle(selected, { border: v });
    else if (g === 'size') setStyle(selected, { size: v });
    else if (g === 'tail') setStyle(selected, { tail: +v });
    else if (g === 'default') {
      if (v === 'clear') { const old = placedFor(nodeId)[selected]; if (old) panelSave(p => { const keep = { ...old }; delete keep.style; (p.bubbles ||= {})[selected] = keep; }); refresh(); }
      else makeDefault(v);
    }
  });

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
    const key = b.dataset.k;
    if (!moved) {
      const now = Date.now(), twice = lastTap.key === key && now - lastTap.at < 400;
      lastTap = { key, at: now };
      if (twice) { editWords(key); return; }                    // double-tap: edit the words
      selected = key; refresh(); return;                         // tap: style panel
    }
    const pos = current(b), old = placedFor(nodeId)[key];
    panelSave(p => { (p.bubbles ||= {})[key] = { ...pos, ...(old?.style ? { style: old.style } : {}) }; });
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
  const nextName = () => { let i = 1; while (D.allImages[ch + '-' + nodeId + '-' + i] || (pending.includes(ch + '-' + nodeId + '-' + i))) i++; return ch + '-' + nodeId + '-' + i; };
  const pending = [];
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
        const name = await upload(f, nextName()); pending.push(name);
        back.remove(); onPick(name);
        alert('Uploaded as ' + name + '. It’s on this panel and goes live in about 4 minutes — reload then to see it.');
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
