// Comic panels for /dialogue2 chapter pages (owner 2026-11-23): each panel's art stacked like a strip,
// its dialogue as speech bubbles (narration as caption boxes) on top, and a Layout mode to drag bubbles,
// resize them, and swap/add/remove images. Runs inside each chapter iframe; uses D (the chapter page's
// data) and the parent's localStorage (same origin).
//
// Saved layout (this browser, until published):  rtr.dialogue2.layout.v1
//   { [chapterId]: { [nodeId]: { images?: [imageName…], bubbles?: { [shownText]: {img, x, y, w} } } } }
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
  let mode = false, nodeId = null, host = null;
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

  function render(nid, el) {
    nodeId = nid; host = el;
    const n = D.chapter.nodes[nid], imgs = imagesFor(nid);
    const placed = { ...(n.bubbles || {}), ...((saved()[nid] || {}).bubbles || {}) };
    el.classList.toggle('layout', mode);
    if (!imgs.length) {
      el.innerHTML = mode ? '<div class="cempty">No art for this panel yet.<button data-cadd="1">+ Add an image</button></div>' : '';
      return;
    }
    const L = lines(nid);
    el.innerHTML = imgs.map((name, i) => '<div class="cimg" data-i="' + i + '"><img alt="" src="' + esc(D.allImages[name]) + '">'
      + (mode ? '<div class="ctools"><button data-cswap="' + i + '">Swap image</button>' + (imgs.length > 1 ? '<button data-cdel="' + i + '">Remove</button>' : '') + '<span>' + esc(name) + '</span></div>' : '') + '</div>').join('')
      + (mode ? '<div class="crow"><button data-cadd="1">+ Add image</button><button data-creset="1">Reset this panel</button></div>' : '')
      + L.map((l, i) => '<div class="bub' + (l.speaker === 'Scene' ? ' cap' : '') + '" data-k="' + esc(l.key) + '" data-def="' + i + '">'
        + (l.speaker === 'Scene' ? '' : '<b>' + esc(l.speaker) + '</b>') + '<span>' + fmt(l.text) + '</span>' + (mode ? '<i class="grip" title="Drag to resize"></i>' : '') + '</div>').join('');
    const place = () => {
      const boxes = [...el.querySelectorAll('.cimg')];
      el.querySelectorAll('.bub').forEach((b, i) => {
        const p = placed[b.dataset.k] || defaultPos(i, L.length, imgs.length), box = boxes[Math.min(p.img ?? 0, boxes.length - 1)];
        b.style.left = p.x + '%'; b.style.width = p.w + '%';
        b.style.top = (box.offsetTop + box.offsetHeight * p.y / 100) + 'px';
        b.classList.toggle('placed', !!placed[b.dataset.k]);
      });
      parent.postMessage({ fit: 1 }, '*');
    };
    el.querySelectorAll('img').forEach(im => im.complete ? 0 : im.addEventListener('load', place, { once: true }));
    place(); new ResizeObserver(place).observe(el);
  }

  // ── Layout mode: drag to move, grip to resize; image tools ───────────────────────────────────
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (!mode) return;
    const b = e.target.closest('.bub'); if (!b || !host?.contains(b)) return;
    e.preventDefault(); b.setPointerCapture(e.pointerId);
    const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
    drag = { b, resize: !!e.target.closest('.grip'), sx: e.clientX, sy: e.clientY, left: r.left - hr.left, top: r.top - hr.top, width: r.width, hw: hr.width };
    b.classList.add('dragging');
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (drag.resize) drag.b.style.width = Math.max(12, Math.min(96, (drag.width + dx) / drag.hw * 100)) + '%';
    else { drag.b.style.left = Math.max(-2, Math.min(98, (drag.left + dx) / drag.hw * 100)) + '%'; drag.b.style.top = (drag.top + dy) + 'px'; }
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const { b } = drag; drag = null; b.classList.remove('dragging');
    // Which image is the bubble's top edge over? Store its spot relative to that image.
    const boxes = [...host.querySelectorAll('.cimg')], top = b.offsetTop;
    let i = boxes.findIndex(x => top < x.offsetTop + x.offsetHeight); if (i < 0) i = boxes.length - 1;
    const box = boxes[i], hw = host.offsetWidth;
    const pos = { img: i, x: +(b.offsetLeft / hw * 100).toFixed(1), y: +((top - box.offsetTop) / box.offsetHeight * 100).toFixed(1), w: +(b.offsetWidth / hw * 100).toFixed(1) };
    save(nodeId, p => { (p.bubbles ||= {})[b.dataset.k] = pos; });
    b.classList.add('placed');
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
    else if (t.dataset.creset && confirm('Reset this panel’s images and bubble positions to the published version?')) { save(nodeId, p => { delete p.images; delete p.bubbles; }); again(); }
  });

  window.RTR_COMIC = { render, setMode(on) { mode = !!on; window.RTR_RERENDER?.(); } };
})();
