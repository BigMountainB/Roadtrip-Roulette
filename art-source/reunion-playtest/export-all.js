// "⇩ Export all" for /dialogue2 (owner 2026-11-20): one Markdown file of the WHOLE script —
// every chapter, panel, artwork description, line and choice — with the viewer's ✎ edits marked
// in place, plus a machine-readable block of all edits for Claude to apply. Injected by build.mjs
// after the edit layer; reads the same localStorage keys. The script itself arrives as
// window.RTR_SCRIPT ({version, chapters:[{id,title,sub,start,nodes}]}).
(() => {
  const KEY = 'rtr.dialogue2.edits.v1', ADDS_KEY = KEY + '.adds', LAYOUT_KEY = 'rtr.dialogue2.layout.v1';
  const S = window.RTR_SCRIPT;
  if (!S) return;
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  // Saved edits are keyed by a line's text as shown on screen: *italics* show without asterisks.
  const shown = t => norm(String(t).replace(/\*([^*\n]+)\*/g, '$1'));
  const artText = n => n.artDesc || ('[ARTWORK — ' + n.title + ': describe this panel]');
  const load = () => {
    try { return { edits: JSON.parse(localStorage.getItem(KEY) || '{}'), adds: JSON.parse(localStorage.getItem(ADDS_KEY) || '{}'), layout: JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') }; }
    catch { return { edits: {}, adds: {}, layout: {} }; }
  };

  function build() {
    const { edits, adds, layout } = load();
    const out = [], stamp = new Date();
    let total = 0;
    const counts = S.chapters.map(c => {
      const n = Object.keys(edits[c.id] || {}).length + (adds[c.id] || []).length; total += n; return n;
    });
    out.push('# Road Trip Roulette · Dialogue 2 — full script with my edits', '',
      'Exported ' + stamp.toLocaleString() + ' from ' + location.href.split('#')[0] + ' (script version ' + S.version + ').',
      total ? total + ' change' + (total === 1 ? '' : 's') + ' in total: ' + S.chapters.map((c, i) => counts[i] ? c.title + ' (' + counts[i] + ')' : null).filter(Boolean).join(', ') + '.'
            : 'No edits saved in this browser yet — this is the script as published.',
      '', 'Key: ~~old~~ → **new** = changed · ~~line~~ (removed) · ➕ = added by me · ✎ note = my note on a line.', '');
    const usedEdit = {}, usedAdd = {};
    // One line of the script, with its edit and anything added after it.
    const line = (cid, speaker, text, opts = {}) => {
      const key = shown(text), e = (edits[cid] || {})[key];
      (usedEdit[cid] ??= new Set()).add(key);
      const who = opts.choice ? '▸ ' : (speaker === 'Scene' ? '' : '**' + speaker + ':** ');
      let row;
      if (e?.deleted) row = who + '~~' + text + '~~ (removed)';
      else if (e && norm(e.text) !== key) row = who + '~~' + text + '~~ → **' + e.text + '**';
      else row = who + (speaker === 'Scene' && !opts.choice ? '_' + text + '_' : text);
      const lines = ['- ' + row];
      if (e?.note) lines.push('  - ✎ note: ' + e.note);
      for (const a of (adds[cid] || []).filter(a => a.anchor === key)) {
        (usedAdd[cid] ??= new Set()).add(a.id);
        lines.push(...added(a, '  '));
      }
      return lines;
    };
    const added = (a, pad) => {
      if (a.kind === 'choice') {
        const rows = [pad + '- ➕ ▸ **New choice:** ' + a.text];
        for (const r of a.replies || []) rows.push(pad + '  - ' + (r.speaker === 'Narration' ? '_' + r.text + '_' : '**' + r.speaker + ':** ' + r.text));
        for (const c of a.children || []) rows.push(...added({ ...c, kind: 'choice' }, pad + '  '));
        rows.push(pad + '  - then: ' + (a.goto === '__end' ? 'scene ends' : a.goto ? 'rejoins at “' + a.goto + '”' : 'continues'));
        return rows;
      }
      return [pad + '- ➕ ' + (a.speaker === 'Narration' ? '_' + a.text + '_' : '**' + a.speaker + ':** ' + a.text)];
    };
    const sp = layout._speakers || {};
    if (Object.keys(sp).length) out.push('## Bubble defaults (mine)', '', ...Object.entries(sp).map(([k, v]) => '- **' + k + ':** ' + [v.kind, v.color, v.border].filter(Boolean).join(' · ')), '');
    for (const ch of S.chapters) {
      out.push('## ' + ch.title + ' — ' + ch.sub, '');
      // Panels in reading order: start, then breadth-first through next/choices.
      const order = [], seen = new Set(), q = [ch.start];
      while (q.length) { const id = q.shift(); if (seen.has(id) || !ch.nodes[id]) continue; seen.add(id); order.push(id);
        const n = ch.nodes[id]; if (n.next) q.push(n.next); for (const c of n.choices || []) q.push(c.to); }
      for (const id of order) {
        const n = ch.nodes[id];
        out.push('### ' + n.title, '');
        const lay = layout[ch.id]?.[id];
        if (lay) out.push('- 🖼 **Layout (mine):** ' + [lay.images ? 'images: ' + lay.images.join(', ') : null, lay.bubbles ? Object.keys(lay.bubbles).length + ' bubble' + (Object.keys(lay.bubbles).length === 1 ? '' : 's') + ' placed' : null].filter(Boolean).join(' · '));
        out.push(...line(ch.id, 'Artwork', artText(n)).map(l => l.replace('- **Artwork:** ', '- 🎨 **Artwork:** ')));
        for (const b of n.beats) out.push(...line(ch.id, b.speaker, b.text));
        for (const c of n.choices || []) {
          const title = ch.nodes[c.to]?.title;
          out.push(...line(ch.id, 'Player', c.label, { choice: true }).map((l, i) => i ? l : l + (title ? '  → _' + title + '_' : '')));
        }
        if (n.next) out.push('- → _' + (ch.nodes[n.next]?.title || n.next) + '_');
        if (n.end) out.push('- ◼ ' + n.end + (n.nextChapter ? ' (next chapter)' : ''));
        out.push('');
      }
      // Edits whose line no longer exists in the script (the script changed after they were made).
      const stale = Object.entries(edits[ch.id] || {}).filter(([k, e]) => e && typeof e === 'object' && !usedEdit[ch.id]?.has(k));
      const loose = (adds[ch.id] || []).filter(a => !usedAdd[ch.id]?.has(a.id));
      if (stale.length || loose.length) {
        out.push('#### Edits that no longer match a line', '');
        for (const [k, e] of stale) out.push('- ' + (e.deleted ? 'REMOVE ' : '') + '**' + (e.speaker || '?') + ':** ~~' + k + '~~' + (e.deleted ? '' : ' → **' + e.text + '**') + (e.note ? ' (✎ ' + e.note + ')' : ''));
        for (const a of loose) out.push(...added(a, '').map(r => r + (r.startsWith('- ➕') ? '  (after: “' + a.anchor + '”)' : '')));
        out.push('');
      }
    }
    out.push('<!-- rtr-dialogue2-all-edits', JSON.stringify({ version: S.version, exported: stamp.toISOString(), edits, adds, layout }), '-->', '');
    return out.join('\n');
  }

  const fileName = () => 'rtr-dialogue2-full-script-' + new Date().toISOString().slice(0, 10) + '.md';
  async function exportAll(status) {
    const text = build(), name = fileName();
    const blob = new Blob([text], { type: 'text/markdown' });
    try {
      // Chrome/Edge on a computer: a Save dialog that remembers the folder (e.g. Story Playtest 2).
      if (window.showSaveFilePicker) {
        const h = await showSaveFilePicker({ id: 'rtr-dialogue2', suggestedName: name, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return status('Saved ' + h.name + '.');
      }
      // iPad/iPhone: the share sheet (Save to Files, or send it straight to the Claude app).
      const file = new File([blob], name, { type: 'text/markdown' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return status('Shared ' + name + '.'); }
    } catch (e) { if (e?.name === 'AbortError') return status('Cancelled.'); }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); status('Downloaded ' + name + '.');
  }

  const tools = document.querySelector('.rtr-tools');
  if (!tools) return;
  const btn = Object.assign(document.createElement('button'), { id: 'rtrExportAll', textContent: '⇩ Export all' });
  const copy = Object.assign(document.createElement('button'), { id: 'rtrCopyAll', textContent: 'Copy all' });
  const msg = Object.assign(document.createElement('span'), { className: 'muted', id: 'rtrExportStatus' });
  msg.style.alignSelf = 'center';
  const status = t => { msg.textContent = t; clearTimeout(status.t); status.t = setTimeout(() => (msg.textContent = ''), 6000); };
  btn.onclick = () => exportAll(status);
  copy.onclick = async () => { try { await navigator.clipboard.writeText(build()); status('Copied the full script. Paste it into your chat.'); } catch { status('Copy was blocked; use Export all.'); } };
  // ── Publish my edits (owner 2026-11-22) ────────────────────────────────────────────────────
  // Sends this browser's edits to /api/dialogue2/publish (a Cloudflare Pages function holding the
  // GitHub key). A GitHub Action writes them into the script and redeploys /dialogue2 in a few
  // minutes. Mechanical: lines go live exactly as typed. The passcode is asked once per browser.
  const PASS_KEY = 'rtr.dialogue2.passcode', FLASH_KEY = 'rtr.dialogue2.flash';
  // 🖼 Layout (owner 2026-11-23): drag bubbles, resize them, swap/add/remove images on every panel.
  const lay = Object.assign(document.createElement('button'), { id: 'rtrLayout', textContent: '🖼 Layout' });
  const layoutCount = () => Object.entries(load().layout).reduce((t, [k, c]) => t + Object.keys(c || {}).length, 0);
  const paintLayout = () => { lay.textContent = window.RTR_LAYOUT_ON ? '🖼 Layout: drag bubbles · tap again when done' : '🖼 Layout' + (layoutCount() ? ' (' + layoutCount() + ')' : ''); lay.setAttribute('aria-pressed', !!window.RTR_LAYOUT_ON); };
  window.RTR_LAYOUT_CHANGED = paintLayout;
  lay.onclick = () => { window.RTR_LAYOUT_ON = !window.RTR_LAYOUT_ON; document.querySelectorAll('iframe').forEach(f => { try { f.contentWindow.RTR_COMIC?.setMode(window.RTR_LAYOUT_ON); } catch {} }); paintLayout(); };
  paintLayout();
  const pub = Object.assign(document.createElement('button'), { id: 'rtrPublish', textContent: '⇪ Publish my edits' });
  pub.style.cssText = 'background:#2d6cdf;border-color:#2d6cdf;color:#fff';
  pub.onclick = async () => {
    const { edits, adds, layout } = load();
    const n = Object.values(edits).reduce((t, m) => t + Object.keys(m || {}).length, 0) + Object.values(adds).reduce((t, l) => t + (l || []).length, 0) + layoutCount();
    if (!n) return status('No edits to publish yet. Use ✎ Edit text or 🖼 Layout first.');
    if (!confirm('Publish ' + n + ' change' + (n === 1 ? '' : 's') + ' to the live /dialogue2?\n\nThey go into the script exactly as typed and show for everyone in about 4 minutes.')) return;
    let pass = ''; try { pass = localStorage.getItem(PASS_KEY) || ''; } catch {}
    if (!pass) { pass = prompt('Publishing passcode:') || ''; if (!pass) return status('Cancelled.'); }
    pub.disabled = true; status('Publishing…');
    try {
      const r = await fetch('/api/dialogue2/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pass, version: S.version, edits, adds, layout }) });
      const out = await r.json().catch(() => ({}));
      if (r.status === 401) { try { localStorage.removeItem(PASS_KEY); } catch {} return status('Wrong passcode. Nothing was published.'); }
      if (!r.ok || !out.ok) return status((out.error || 'Publishing failed (' + r.status + ').') + ' Your edits are still saved here.');
      // Sent: keep a backup, clear the live copy (it is now in the script), and reload so the editor
      // doesn't write the published edits back.
      try {
        localStorage.setItem(PASS_KEY, pass);
        localStorage.setItem('rtr.dialogue2.published.' + Date.now(), JSON.stringify({ edits, adds, layout }));
        localStorage.removeItem(KEY); localStorage.removeItem(ADDS_KEY); localStorage.removeItem(LAYOUT_KEY);
        sessionStorage.setItem(FLASH_KEY, 'Published ' + out.changes + ' change' + (out.changes === 1 ? '' : 's') + '. They go live in about 4 minutes — reload then to see them. (A backup is kept in this browser.)');
      } catch {}
      location.reload();
    } catch { status('Couldn’t reach the site. Check your connection; your edits are still saved here.'); }
    finally { pub.disabled = false; }
  };
  // ── Undo / Redo (owner 2026-11-23): every change to text edits, added lines and layout, this visit ──
  const KEYS = [KEY, ADDS_KEY, LAYOUT_KEY], undo = [], redo = [];
  const snap = () => KEYS.map(k => { try { return localStorage.getItem(k); } catch { return null; } });
  const same = (a, b) => a.every((v, i) => v === b[i]);
  let last = snap();
  const undoBtn = Object.assign(document.createElement('button'), { id: 'rtrUndo', textContent: '↶ Undo', title: 'Undo (⌘Z / Ctrl+Z)' });
  const redoBtn = Object.assign(document.createElement('button'), { id: 'rtrRedo', textContent: '↷ Redo', title: 'Redo (⇧⌘Z / Ctrl+Shift+Z)' });
  const paintUndo = () => { undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; };
  const watch = () => { const now = snap(); if (!same(now, last)) { undo.push(last); if (undo.length > 200) undo.shift(); redo.length = 0; last = now; paintUndo(); } };
  setInterval(watch, 300);
  window.RTR_UNDO_MARK = watch;      // called just before a layout change, so it is its own step
  const restore = state => {
    KEYS.forEach((k, i) => { try { state[i] == null ? localStorage.removeItem(k) : localStorage.setItem(k, state[i]); } catch {} });
    last = state;
    window.RTR_EDITS_RELOAD?.();
    document.querySelectorAll('iframe').forEach(f => { try { f.contentWindow.RTR_COMIC?.refresh(); } catch {} });
    paintLayout(); paintUndo();
  };
  window.RTR_UNDO = () => { watch(); if (!undo.length) return status('Nothing to undo.'); redo.push(snap()); restore(undo.pop()); status('Undone.'); };
  window.RTR_REDO = () => { watch(); if (!redo.length) return status('Nothing to redo.'); undo.push(snap()); restore(redo.pop()); status('Redone.'); };
  undoBtn.onclick = () => window.RTR_UNDO(); redoBtn.onclick = () => window.RTR_REDO();
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.target.closest?.('input,textarea,[contenteditable]')) return;
    e.preventDefault(); e.shiftKey ? window.RTR_REDO() : window.RTR_UNDO();
  });
  paintUndo();
  tools.append(undoBtn, redoBtn, lay, pub, btn, copy, msg);
  try { const f = sessionStorage.getItem(FLASH_KEY); if (f) { sessionStorage.removeItem(FLASH_KEY); msg.textContent = f; } } catch {}
  window.RTR_EXPORT_ALL = build;   // for checks
})();
