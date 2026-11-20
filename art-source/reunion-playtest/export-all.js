// "⇩ Export all" for /dialogue2 (owner 2026-11-20): one Markdown file of the WHOLE script —
// every chapter, panel, artwork description, line and choice — with the viewer's ✎ edits marked
// in place, plus a machine-readable block of all edits for Claude to apply. Injected by build.mjs
// after the edit layer; reads the same localStorage keys. The script itself arrives as
// window.RTR_SCRIPT ({version, chapters:[{id,title,sub,start,nodes}]}).
(() => {
  const KEY = 'rtr.dialogue2.edits.v1', ADDS_KEY = KEY + '.adds';
  const S = window.RTR_SCRIPT;
  if (!S) return;
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  // Saved edits are keyed by a line's text as shown on screen: *italics* show without asterisks.
  const shown = t => norm(String(t).replace(/\*([^*\n]+)\*/g, '$1'));
  const artText = n => n.artDesc || ('[ARTWORK — ' + n.title + ': describe this panel]');
  const load = () => {
    try { return { edits: JSON.parse(localStorage.getItem(KEY) || '{}'), adds: JSON.parse(localStorage.getItem(ADDS_KEY) || '{}') }; }
    catch { return { edits: {}, adds: {} }; }
  };

  function build() {
    const { edits, adds } = load();
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
    for (const ch of S.chapters) {
      out.push('## ' + ch.title + ' — ' + ch.sub, '');
      // Panels in reading order: start, then breadth-first through next/choices.
      const order = [], seen = new Set(), q = [ch.start];
      while (q.length) { const id = q.shift(); if (seen.has(id) || !ch.nodes[id]) continue; seen.add(id); order.push(id);
        const n = ch.nodes[id]; if (n.next) q.push(n.next); for (const c of n.choices || []) q.push(c.to); }
      for (const id of order) {
        const n = ch.nodes[id];
        out.push('### ' + n.title, '');
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
    out.push('<!-- rtr-dialogue2-all-edits', JSON.stringify({ version: S.version, exported: stamp.toISOString(), edits, adds }), '-->', '');
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
  tools.append(btn, copy, msg);
  window.RTR_EXPORT_ALL = build;   // for checks
})();
