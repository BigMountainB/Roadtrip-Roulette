// Edit layer injected into the combined playtest shell. Rewrites, removals, added lines and added
// choices are stored by chapter, overlaid on whatever a chapter page renders, and exported per
// chapter as Markdown with an embedded JSON block that can be re-imported or read by Claude/ChatGPT.
// Added choices are playable pathways: each step has replies, optional follow-up choices, and can
// rejoin the chapter by pressing one of its real choices or its Continue button. Paths play inline
// in the chapter page. The path map lists every point in a chapter (written and added) and jumps
// there through the page's RTR_MAP / RTR_WHERE / RTR_JUMP hooks.
(() => {
  const KEY = 'rtr.story-playtest.edits.v1', ADDS_KEY = KEY + '.adds';
  const EDITABLE = '.seattle-beat p,.beat p,.bubble,.seattle-option-text,.seattle-transcript p,#transcript p,button[data-choice]';
  const SKIP = '.who,.seattle-speaker,small,summary,.from,.draftTag,.rtr-pen,strong,.text-small';
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  let edits = {}, adds = {}, memoryOnly = false, editing = false, activeDoc = null;
  try { edits = JSON.parse(localStorage.getItem(KEY) || '{}'); adds = JSON.parse(localStorage.getItem(ADDS_KEY) || '{}'); } catch { memoryOnly = true; }
  const frames = [];
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(edits)); localStorage.setItem(ADDS_KEY, JSON.stringify(adds)); memoryOnly = false; } catch { memoryOnly = true; }
    refreshAll();
  };
  const count = () => Object.values(edits).reduce((n, c) => n + Object.keys(c).length, 0) + Object.values(adds).reduce((n, c) => n + c.length, 0);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const textNodes = el => {
    const out = [], walk = n => { for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue.trim()) out.push(c); }
      else if (c.nodeType === 1 && !c.matches(SKIP)) walk(c);
    } };
    walk(el); return out;
  };
  const makePen = (d, addId) => {
    const pen = d.createElement('span');
    pen.className = 'rtr-pen'; pen.textContent = '✎'; pen.setAttribute('role', 'button'); pen.setAttribute('aria-label', 'Edit this line');
    if (addId) pen.dataset.add = addId;
    return pen;
  };
  const addedLine = (d, item) => {
    const box = d.createElement('div'); box.className = 'rtr-added';
    const who = d.createElement('span'); who.className = 'rtr-who'; who.textContent = item.speaker + ' · added';
    const p = d.createElement('p'); p.textContent = item.text; p.appendChild(makePen(d, item.id));
    box.append(who, p); return box;
  };
  const addedChoice = (d, item, like) => {
    const b = d.createElement('button'); b.type = 'button';
    b.className = like.className + ' rtr-added-choice'; b.dataset.addChoice = item.id;
    b.append(d.createTextNode(item.text), makePen(d, item.id));
    return b;
  };

  function apply(fr) {
    const d = fr.frame.contentDocument; if (!d?.body) return;
    fr.observer.disconnect();
    d.querySelectorAll('.rtr-pen,.rtr-added,.rtr-added-choice').forEach(p => p.remove());
    const id = fr.chapter.id, map = edits[id] || {}, list = adds[id] || [];
    for (const el of d.querySelectorAll(EDITABLE)) {
      if (el.matches('button[data-choice]') && el.querySelector('.seattle-option-text')) continue;
      const nodes = textNodes(el);
      const current = norm(nodes.map(n => n.nodeValue).join(' '));
      if (!current) continue;
      // A re-render puts the original text back; remember the original unless this is our own edit.
      if (!el.dataset.rtrOrig || current !== el.dataset.rtrShown) el.dataset.rtrOrig = current;
      const orig = el.dataset.rtrOrig, edit = map[orig];
      const shown = edit && !edit.deleted ? edit.text : orig;
      if (shown !== current) {
        if (el.matches('.seattle-option-text')) el.textContent = shown;
        else nodes.forEach((n, i) => { n.nodeValue = i ? '' : (/^\s/.test(n.nodeValue) ? ' ' : '') + shown; });
      }
      el.dataset.rtrShown = shown;
      const inTranscript = !!el.closest('.seattle-transcript,#transcript');
      const holder = inTranscript ? el : el.closest('button') || el.closest('.beat,.seattle-beat') || el;
      holder.classList.toggle('rtr-removed', !!edit?.deleted);
      el.classList.toggle('rtr-changed', !!edit && !edit.deleted);
      if (inTranscript) continue;
      el.appendChild(makePen(d));
      const isButton = holder.matches('button');
      if (!isButton && !el.matches('.seattle-option-text')) {
        const branch = makePen(d); branch.classList.add('rtr-branch'); branch.dataset.branch = '1';
        branch.textContent = '+ Branch'; branch.setAttribute('aria-label', 'Add choices after this line');
        el.appendChild(branch);
      }
      // Added material follows its anchor, in saved order.
      const here = list.filter(a => a.anchor === orig);
      let after = holder;
      for (const item of here) {
        // A choice's text also echoes as a spoken line once picked. New choices beside a choice
        // belong beside the button; anything added after the spoken echo belongs after the echo.
        if (item.onChoice && item.kind === 'choice' && !isButton) continue;
        if (item.onChoice && item.kind === 'line' && isButton) continue;
        if (!item.onChoice && isButton) continue;
        if (item.kind === 'choice' && isButton) { const b = addedChoice(d, item, holder); after.after(b); after = b; continue; }
        if (item.kind === 'choice') {
          const sample = d.querySelector('button[data-choice]') || { className: '' };
          const b = addedChoice(d, item, sample);
          if (holder.matches('.bubble')) (d.querySelector('.seattle-current') || holder.parentElement).appendChild(b);
          else { after.after(b); after = b; }
          continue;
        }
        const line = addedLine(d, item);
        if (holder.matches('.bubble')) {
          const card = d.querySelector('.seattle-current');
          if (card) { card.hidden = false; card.appendChild(line); }
        } else { after.after(line); after = line; }
      }
    }
    d.body.classList.toggle('rtr-edit', editing);
    d.querySelector('.rtr-path')?.remove();
    if (fr.path && !fr.path.every(id => findStep(list, id))) fr.path = null;
    d.body.classList.toggle('rtr-pathing', !!fr.path);
    if (fr.path) renderPath(fr, d);
    fr.observer.takeRecords();
    fr.observer.observe(d.body, { subtree: true, childList: true });
  }
  const refreshAll = () => { frames.forEach(apply); updateBar(); renderMap(); };

  // The path being played sits where the added choice was pressed; the page's own choices hide.
  function renderPath(fr, d) {
    const steps = fr.path.map(id => findStep(adds[fr.chapter.id], id).node), step = steps[steps.length - 1];
    const mk = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const btn = (text, path, arg, cls) => { const b = mk('button', cls, text); b.type = 'button'; b.dataset.path = path; if (arg != null) b.dataset.arg = arg; return b; };
    const line = (who, text) => { const p = mk('p', 'rtr-pline'); if (who) p.append(mk('b', null, who)); p.append(d.createTextNode(text)); return p; };
    const box = mk('div', 'rtr-path');
    box.append(mk('p', 'rtr-path-head', 'Your added path'));
    for (const s of steps) box.append(line('Player', s.text), ...(s.replies || []).map(r => r.speaker === 'Narration' ? line(null, r.text) : line(r.speaker, r.text)));
    if (step.next) box.append(mk('p', 'rtr-pnote', 'Note: ' + step.next));
    for (const c of step.children || []) box.append(btn(c.text, 'child', c.id));
    if (step.goto === '__end') box.append(mk('p', 'rtr-pnote', 'This path ends the scene.'));
    else if (step.goto === '__continue') box.append(btn('Rejoin the story: Continue', 'rejoin', '__continue', 'rtr-rejoin'));
    else if (step.goto) box.append(btn('Rejoin the story as: ' + step.goto, 'rejoin', step.goto, 'rtr-rejoin'));
    else if (!step.children?.length) box.append(mk('p', 'rtr-pnote', 'This path stops here for now.'));
    const row = mk('div', 'rtr-prow');
    if (editing) row.append(btn('+ Add a follow-up choice', 'follow'), btn('Edit this step', 'edit'), btn('Remove this step', 'remove'));
    if (steps.length > 1) row.append(btn('Back a step', 'back'));
    row.append(btn('Leave this path', 'leave'));
    box.append(row);
    const from = d.querySelector('[data-add-choice="' + fr.path[0] + '"]');
    if (from) from.after(box); else (d.querySelector('#app,main,.seattle-current') || d.body).append(box);
  }
  const scrollPath = fr => {
    const p = fr.frame.contentDocument?.querySelector('.rtr-path'); if (!p) return;
    const top = fr.frame.getBoundingClientRect().top + scrollY + p.getBoundingClientRect().top - (document.querySelector('header')?.offsetHeight || 0) - 12;
    scrollTo({ top, behavior: 'smooth' });
  };
  function pathAction(fr, act, arg) {
    const chapter = fr.chapter, found = findStep(adds[chapter.id], fr.path[fr.path.length - 1]), step = found.node;
    if (act === 'child') { fr.path.push(arg); apply(fr); return scrollPath(fr); }
    if (act === 'back') { fr.path.pop(); return apply(fr); }
    if (act === 'leave') { fr.path = null; return apply(fr); }
    if (act === 'rejoin') {
      fr.path = null; apply(fr);
      if (arg === '__continue') return continueButton()?.click();
      const hit = [...activeDoc.querySelectorAll('.seattle-option-text,button[data-choice]')].find(n => n.dataset.rtrOrig === arg);
      return (hit?.closest('button') || hit)?.click();
    }
    if (act === 'follow') return openFollowUp(chapter, step);
    if (act === 'remove') {
      if (found.parent) found.parent.children = found.parent.children.filter(c => c.id !== step.id); else dropAdd(chapter.id, step.id);
      fr.path.pop(); if (!fr.path.length) fr.path = null;
      return persist();
    }
    if (act === 'edit') {
      const m = modal(), b = choiceBlock(step);
      m.box.append(el('h2', { textContent: 'Edit this step' }), b.node, el('div', { className: 'rtr-row' },
        el('button', { className: 'primary', textContent: 'Save', onclick: () => { const r = b.read(); if (!r.text) return b.focus(); Object.assign(step, r); persist(); m.back.remove(); } }),
        el('button', { textContent: 'Cancel', onclick: () => m.back.remove() })));
    }
  }

  window.RTR_wire = (frame, chapter) => {
    const d = frame.contentDocument; if (!d?.body) return;
    const st = d.createElement('style');
    st.textContent = '.rtr-pen{display:none;margin-left:.45em;padding:0 .4em;border-radius:6px;background:#2d6cdf;color:#fff;font:600 .85em/1.5 -apple-system,Arial,sans-serif;font-style:normal;text-transform:none;letter-spacing:0;cursor:pointer;pointer-events:auto;white-space:nowrap}'
      + 'body.rtr-edit .rtr-pen{display:inline-block}body.rtr-edit .rtr-changed{outline:2px dashed #2d6cdf;outline-offset:2px}'
      + 'body:not(.rtr-edit) .rtr-removed{display:none!important}body.rtr-edit .rtr-removed{opacity:.55;text-decoration:line-through}'
      + '.rtr-added{margin-top:10px;padding-left:10px;border-left:3px dashed #2d6cdf}.rtr-added p{margin:2px 0 0}.rtr-who{display:block;font-weight:600;font-size:.85rem;opacity:.7}'
      + '.rtr-added-choice{border:2px dashed #2d6cdf!important;margin-top:8px}body.rtr-edit .rtr-pen.rtr-branch{background:#1f8a4c}'
      + '.rtr-path{margin:10px 0;padding:12px 14px;border:2px dashed #2d6cdf;border-radius:12px;text-align:left}.rtr-path-head{font-weight:600;font-size:.85rem;color:#2d6cdf;margin:0 0 4px}'
      + '.rtr-pline{margin:6px 0 0}.rtr-pline b{display:block;font-size:.85rem;opacity:.7}.rtr-pnote{font-size:.85rem;opacity:.7;margin:8px 0 0}'
      + '.rtr-path button{display:block;width:100%;text-align:left;font:inherit;color:inherit;background:transparent;border:2px dashed #2d6cdf;border-radius:10px;padding:8px 12px;margin:8px 0 0;cursor:pointer}'
      + '.rtr-path button.rtr-rejoin{background:#2d6cdf;border-style:solid;color:#fff}.rtr-prow{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.rtr-path .rtr-prow button{width:auto;margin:0;border:1px solid currentColor;font-size:.85rem;padding:5px 10px}'
      + 'body.rtr-pathing button[data-choice],body.rtr-pathing .rtr-added-choice,body.rtr-pathing [data-action="next"],body.rtr-pathing #next,body.rtr-pathing [data-next],body.rtr-pathing [data-entry]{display:none!important}';
    d.head.appendChild(st);
    const fr = { frame, chapter, observer: null, path: null }; let pending = false;
    fr.observer = new MutationObserver(() => { if (pending) return; pending = true; frame.contentWindow.requestAnimationFrame(() => { pending = false; apply(fr); }); });
    frames.push(fr);
    d.addEventListener('click', e => {
      const pathBtn = e.target.closest?.('.rtr-path [data-path]');
      if (pathBtn) { e.preventDefault(); e.stopPropagation(); activeDoc = d; return pathAction(fr, pathBtn.dataset.path, pathBtn.dataset.arg); }
      const pen = e.target.closest?.('.rtr-pen');
      const chosen = e.target.closest?.('[data-add-choice]');
      if (!pen && !chosen) {
        // Any of the page's own buttons leaves the path; the map catches up after the page re-renders.
        if (e.target.closest?.('button')) { if (fr.path) { fr.path = null; setTimeout(() => apply(fr)); } setTimeout(renderMap, 30); }
        return;
      }
      e.preventDefault(); e.stopPropagation(); activeDoc = d;
      if (pen?.dataset.add) return openAddedEditor(chapter, pen.dataset.add);
      if (pen?.dataset.branch) return openAddChoices(chapter, pen.parentElement.dataset.rtrOrig, null, false);
      if (chosen) { fr.path = [chosen.dataset.addChoice]; apply(fr); return scrollPath(fr); }
      const el = pen.parentElement, isChoice = el.matches('button,.seattle-option-text');
      const speaker = isChoice ? 'Player'
        : norm(el.closest('.beat,.seattle-beat,.bubble')?.querySelector('.who,.seattle-speaker,.from')?.textContent || 'Narration').replace(/Draft$/, '').replace(/:$/, '');
      const btn = el.closest('button');
      const lastChoice = !!btn && ![...btn.parentElement.querySelectorAll('button[data-choice]')].some(b => b !== btn && !b.classList.contains('rtr-removed'));
      openEditor(chapter, el.dataset.rtrOrig, speaker, isChoice, lastChoice);
    }, true);
    apply(fr); renderMap();
  };

  // ── Shell UI ──────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `.rtr-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.rtr-tools button,.rtr-modal button{font:inherit;font-size:.9rem;color:var(--fg);background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:6px 12px;cursor:pointer}
.rtr-tools button[aria-pressed="true"],.rtr-modal button.primary{background:#2d6cdf;border-color:#2d6cdf;color:#fff}.rtr-modal button:disabled{opacity:.45;cursor:not-allowed}
.rtr-back{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}
.rtr-modal{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:14px;padding:16px;width:100%;max-width:600px}
.rtr-modal h2{font-size:1.05rem;margin:0 0 8px}.rtr-modal label{display:block;font-size:.85rem;font-weight:600;margin:10px 0 4px}.rtr-modal textarea,.rtr-modal input[type=text]{display:block;width:100%;box-sizing:border-box;font:16px/1.4 -apple-system,Arial,sans-serif;color:var(--fg);background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:8px}
.rtr-modal .orig,.rtr-modal .hint{color:var(--muted);font-size:.9rem;margin:0}.rtr-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.rtr-item{border-top:1px solid var(--line);padding:8px 0;font-size:.9rem}.rtr-item p{margin:2px 0}.rtr-warn{color:#a5560f;font-size:.85rem;margin:6px 0 0}.rtr-block{border:1px dashed var(--line);border-radius:10px;padding:0 10px 10px;margin-top:10px}
.rtr-map{position:fixed;top:0;right:0;bottom:0;z-index:15;width:min(400px,100vw);background:var(--bg);color:var(--fg);border-left:1px solid var(--line);box-shadow:-6px 0 20px rgba(0,0,0,.15);overflow:auto;padding:0 16px 40px}.rtr-map[hidden]{display:none}
.rtr-map-top{position:sticky;top:0;background:var(--bg);display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 0 8px;border-bottom:1px solid var(--line);margin-bottom:6px}.rtr-map h2{font-size:1rem;margin:0}.rtr-map h3{font-size:.9rem;margin:14px 0 4px}
.rtr-map-top button{font:inherit;font-size:.9rem;color:var(--fg);background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:6px 12px;cursor:pointer}
.rtr-mrow{display:block;width:100%;text-align:left;font:inherit;font-size:.88rem;line-height:1.35;color:var(--fg);background:none;border:1px solid transparent;border-radius:8px;padding:4px 6px;margin:1px 0;cursor:pointer}.rtr-mrow:hover{background:var(--chip)}
.rtr-mrow.node{font-weight:600}.rtr-mrow.choice::before{content:'▸ ';color:var(--muted)}.rtr-mrow.added{border:1px dashed #2d6cdf;color:#2d6cdf}.rtr-mrow.gone{text-decoration:line-through;opacity:.55}
.rtr-mrow.here{background:#2d6cdf;color:#fff}.rtr-mnote{color:var(--muted);font-size:.82rem;margin:0;padding:2px 6px}`;
  document.head.appendChild(css);
  const tools = document.createElement('div'); tools.className = 'rtr-tools';
  tools.innerHTML = '<button id="rtrToggle" aria-pressed="false">✎ Edit text</button><button id="rtrList"></button><button id="rtrMap" aria-pressed="false">Path map</button>';
  document.querySelector('header .bar').appendChild(tools);
  const mapEl = document.createElement('aside'); mapEl.className = 'rtr-map'; mapEl.hidden = true; mapEl.setAttribute('aria-label', 'Path map');
  document.body.appendChild(mapEl);
  function updateBar() {
    document.getElementById('rtrToggle').setAttribute('aria-pressed', editing);
    document.getElementById('rtrToggle').textContent = editing ? '✎ Editing: tap a ✎ to change a line' : '✎ Edit text';
    document.getElementById('rtrList').textContent = 'My edits (' + count() + ')';
    document.getElementById('rtrMap').setAttribute('aria-pressed', !mapEl.hidden);
  }
  document.getElementById('rtrToggle').onclick = () => { editing = !editing; refreshAll(); };
  document.getElementById('rtrList').onclick = openList;
  document.getElementById('rtrMap').onclick = () => { mapEl.hidden = !mapEl.hidden; renderMap(); updateBar(); };
  document.getElementById('nav')?.addEventListener('click', () => setTimeout(renderMap, 50));

  function modal() {
    const back = document.createElement('div'); back.className = 'rtr-back';
    const box = document.createElement('div'); box.className = 'rtr-modal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    back.appendChild(box); document.body.appendChild(back);
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    return { back, box };
  }
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const dropEdit = (id, orig) => { if (edits[id]) { delete edits[id][orig]; if (!Object.keys(edits[id]).length) delete edits[id]; } };
  const dropAdd = (id, addId) => { if (adds[id]) { adds[id] = adds[id].filter(a => a.id !== addId); if (!adds[id].length) delete adds[id]; } };
  // Inserts after a sibling added item when given, so new material lands where it was asked for.
  const pushAdds = (chapter, items, afterId) => {
    const list = adds[chapter.id] ??= [];
    const at = afterId ? list.findIndex(a => a.id === afterId) : -1;
    if (at >= 0) list.splice(at + 1, 0, ...items); else list.push(...items);
  };
  // Each reply line is "Speaker: words"; a line with no speaker counts as narration.
  const parseReplies = s => s.split('\n').map(norm).filter(Boolean).map(l => {
    const m = l.match(/^([^:]{1,24}):\s*(.+)$/); return m ? { speaker: m[1], text: m[2] } : { speaker: 'Narration', text: l };
  });
  const repliesText = r => (r || []).map(x => x.speaker + ': ' + x.text).join('\n');

  function openEditor(chapter, orig, speaker, isChoice, lastChoice) {
    const { back, box } = modal();
    const cur = edits[chapter.id]?.[orig];
    const text = el('textarea', { rows: 4, value: cur && !cur.deleted ? cur.text : orig });
    const note = el('textarea', { rows: 2, value: cur?.note || '', placeholder: 'Optional note about this line' });
    const meta = () => ({ speaker, title: chapter.title, at: new Date().toISOString() });
    const save = el('button', { className: 'primary', textContent: 'Save', onclick: () => {
      const t = norm(text.value), n = note.value.trim();
      if (!t || (t === orig && !n)) dropEdit(chapter.id, orig);
      else (edits[chapter.id] ??= {})[orig] = { text: t, note: n, ...meta() };
      persist(); back.remove();
    } });
    const removed = !!cur?.deleted;
    const remove = el('button', { textContent: removed ? 'Bring this line back' : (isChoice ? 'Remove this choice' : 'Remove this line'), disabled: !removed && lastChoice, onclick: () => {
      if (removed) dropEdit(chapter.id, orig);
      else (edits[chapter.id] ??= {})[orig] = { text: orig, deleted: true, note: note.value.trim(), ...meta() };
      persist(); back.remove();
    } });
    box.append(el('h2', { textContent: chapter.title + ' · ' + speaker }),
      el('p', { className: 'hint', textContent: 'Original:' }), el('p', { className: 'orig', textContent: orig }),
      el('label', { textContent: 'New line' }), text, el('label', { textContent: 'Note' }), note,
      el('div', { className: 'rtr-row' }, save, remove,
        el('button', { textContent: 'Restore original', onclick: () => { dropEdit(chapter.id, orig); persist(); back.remove(); } }),
        el('button', { textContent: 'Cancel', onclick: () => back.remove() })),
      el('div', { className: 'rtr-row' },
        el('button', { textContent: '+ Add a line after this', onclick: () => { back.remove(); openAddLine(chapter, orig, isChoice ? 'Player' : speaker, null, isChoice); } }),
        el('button', { textContent: isChoice ? '+ Add another choice' : '+ Add choices after this', onclick: () => { back.remove(); openAddChoices(chapter, orig, null, isChoice); } })),
      ...(!removed && lastChoice ? [el('p', { className: 'rtr-warn', textContent: 'This is the only choice left here, so removing it would leave the scene stuck. Add or keep another choice first.' })] : []),
      el('p', { className: 'hint', style: 'margin-top:10px', textContent: 'Changes apply everywhere this line appears in this chapter.' }));
    text.focus();
  }

  function openAddLine(chapter, anchor, speaker, afterId, onChoice) {
    const { back, box } = modal();
    const who = el('input', { type: 'text', value: speaker === 'Narration' ? '' : speaker, placeholder: 'Leave blank for narration' });
    const text = el('textarea', { rows: 3, placeholder: 'What they say' });
    box.append(el('h2', { textContent: 'Add a line' }), el('p', { className: 'hint', textContent: 'After: ' + anchor }),
      el('label', { textContent: 'Who says it' }), who, el('label', { textContent: 'Line' }), text,
      el('div', { className: 'rtr-row' }, el('button', { className: 'primary', textContent: 'Add line', onclick: () => {
        const t = norm(text.value); if (!t) return text.focus();
        pushAdds(chapter, [{ id: newId(), kind: 'line', onChoice: !!onChoice, anchor, speaker: norm(who.value) || 'Narration', text: t, title: chapter.title, at: new Date().toISOString() }], afterId);
        persist(); back.remove();
      } }), el('button', { textContent: 'Cancel', onclick: () => back.remove() })));
    text.focus();
  }

  // Real choices and the Continue button on the current screen are the places a path can rejoin.
  const rejoinTargets = () => {
    const out = [];
    for (const n of activeDoc?.querySelectorAll('.seattle-option-text,button[data-choice]') || []) {
      if (n.matches('button') && n.querySelector('.seattle-option-text')) continue;
      if (n.dataset.rtrOrig) out.push(n.dataset.rtrOrig);
    }
    return out;
  };
  const continueButton = () => {
    const b = activeDoc?.querySelector('[data-action="next"],#next,[data-next]');
    return b && !b.hidden && b.offsetParent !== null ? b : null;
  };
  function choiceBlock(item = {}) {
    const text = el('textarea', { rows: 2, value: item.text || '', placeholder: 'What the player says' });
    const replies = el('textarea', { rows: 3, value: repliesText(item.replies), placeholder: 'Malik: One reply per line, name first' });
    const options = [['', 'Stop here for now (add follow-up choices later)'], ['__end', 'This path ends the scene']];
    if (continueButton() || item.goto === '__continue') options.push(['__continue', 'Rejoin the story: press Continue']);
    for (const t of rejoinTargets()) options.push([t, 'Rejoin the story as: ' + t]);
    if (item.goto && !options.some(o => o[0] === item.goto)) options.push([item.goto, 'Rejoin the story as: ' + item.goto]);
    const goto = el('select', {}, ...options.map(([value, textContent]) => el('option', { value, textContent })));
    goto.style.cssText = 'display:block;width:100%;font:inherit;padding:8px;border-radius:10px';
    goto.value = item.goto || '';
    const next = el('textarea', { rows: 2, value: item.next || '', placeholder: 'Optional note about where this should go' });
    return { node: el('div', { className: 'rtr-block' }, el('label', { textContent: 'Choice' }), text, el('label', { textContent: 'Replies' }), replies, el('label', { textContent: 'Then' }), goto, el('label', { textContent: 'Note' }), next),
      read: () => ({ text: norm(text.value), replies: parseReplies(replies.value), goto: goto.value, next: norm(next.value) }), focus: () => text.focus() };
  }

  function openAddChoices(chapter, anchor, afterId, onChoice) {
    const { back, box } = modal();
    const blocks = [choiceBlock()], holder = el('div', {}, blocks[0].node);
    box.append(el('h2', { textContent: 'Add choices' }), el('p', { className: 'hint', textContent: 'After: ' + anchor }), holder,
      el('div', { className: 'rtr-row' },
        el('button', { textContent: '+ Another choice', onclick: () => { const b = choiceBlock(); blocks.push(b); holder.appendChild(b.node); b.focus(); } }),
        el('button', { className: 'primary', textContent: 'Add choices', onclick: () => {
          const items = blocks.map(b => b.read()).filter(b => b.text).map(b => ({ id: newId(), kind: 'choice', onChoice: !!onChoice, anchor, speaker: 'Player', title: chapter.title, at: new Date().toISOString(), children: [], ...b }));
          if (!items.length) return blocks[0].focus();
          pushAdds(chapter, items, afterId); persist(); back.remove();
        } }),
        el('button', { textContent: 'Cancel', onclick: () => back.remove() })),
      el('p', { className: 'hint', style: 'margin-top:10px', textContent: 'Tap an added choice to play its path. You can add follow-up choices from there, as deep as you like.' }));
    blocks[0].focus();
  }

  function openAddedEditor(chapter, addId) {
    const item = adds[chapter.id]?.find(a => a.id === addId); if (!item) return;
    const { back, box } = modal();
    const remove = el('button', { textContent: item.kind === 'choice' ? 'Remove this choice' : 'Remove this line', onclick: () => { dropAdd(chapter.id, addId); persist(); back.remove(); } });
    const cancel = el('button', { textContent: 'Cancel', onclick: () => back.remove() });
    const more = el('div', { className: 'rtr-row' },
      el('button', { textContent: '+ Add a line after this', onclick: () => { back.remove(); openAddLine(chapter, item.anchor, item.speaker, addId, item.onChoice); } }),
      el('button', { textContent: '+ Add choices after this', onclick: () => { back.remove(); openAddChoices(chapter, item.anchor, addId, item.onChoice); } }));
    if (item.kind === 'choice') {
      const b = choiceBlock(item);
      box.append(el('h2', { textContent: 'Added choice' }), b.node, el('div', { className: 'rtr-row' },
        el('button', { className: 'primary', textContent: 'Save', onclick: () => { const r = b.read(); if (!r.text) return b.focus(); Object.assign(item, r); persist(); back.remove(); } }), remove, cancel), more);
    } else {
      const who = el('input', { type: 'text', value: item.speaker === 'Narration' ? '' : item.speaker, placeholder: 'Leave blank for narration' });
      const text = el('textarea', { rows: 3, value: item.text });
      box.append(el('h2', { textContent: 'Added line' }), el('label', { textContent: 'Who says it' }), who, el('label', { textContent: 'Line' }), text, el('div', { className: 'rtr-row' },
        el('button', { className: 'primary', textContent: 'Save', onclick: () => { const t = norm(text.value); if (!t) return text.focus(); item.text = t; item.speaker = norm(who.value) || 'Narration'; persist(); back.remove(); } }), remove, cancel), more);
    }
  }

  const findStep = (list, id, parent = null) => {
    for (const n of list || []) {
      if (n.id === id) return { node: n, parent, list };
      const hit = findStep(n.children, id, n); if (hit) return hit;
    }
    return null;
  };
  function openFollowUp(chapter, step) {
    const { back, box } = modal();
    const blocks = [choiceBlock()], holder = el('div', {}, blocks[0].node);
    box.append(el('h2', { textContent: 'Follow-up choices' }), el('p', { className: 'hint', textContent: 'After: ' + step.text }), holder, el('div', { className: 'rtr-row' },
      el('button', { textContent: '+ Another choice', onclick: () => { const b = choiceBlock(); blocks.push(b); holder.appendChild(b.node); b.focus(); } }),
      el('button', { className: 'primary', textContent: 'Save choices', onclick: () => {
        const items = blocks.map(b => b.read()).filter(b => b.text).map(b => ({ id: newId(), children: [], ...b }));
        if (!items.length) return blocks[0].focus();
        (step.children ??= []).push(...items); persist(); back.remove();
      } }),
      el('button', { textContent: 'Cancel', onclick: () => back.remove() })));
    blocks[0].focus();
  }

  // ── Path map ──────────────────────────────────────────────────────────
  // Jumps the chapter page to a node (optionally pressing one of its choices), then opens an added
  // path when a trail of added-step ids is given.
  function go(fr, scene, node, choice, trail) {
    try { fr.frame.contentWindow.RTR_JUMP(scene, node, choice || null); } catch (err) { console.warn('Path map jump failed', err); }
    activeDoc = fr.frame.contentDocument; fr.path = trail || null; apply(fr);
    if (innerWidth < 760) { mapEl.hidden = true; updateBar(); }
    if (trail) scrollPath(fr); else scrollTo({ top: 0 });
    renderMap();
  }
  function renderMap() {
    if (mapEl.hidden) return;
    mapEl.style.top = (document.querySelector('header')?.offsetHeight || 0) + 'px';   // keeps the chapter buttons reachable
    const fr = frames.find(f => !f.frame.hidden);
    mapEl.replaceChildren(el('div', { className: 'rtr-map-top' }, el('h2', { textContent: 'Path map' + (fr ? ' · ' + fr.chapter.title : '') }),
      el('button', { textContent: 'Close', onclick: () => { mapEl.hidden = true; updateBar(); } })),
      el('p', { className: 'rtr-mnote', textContent: 'Tap any point to jump there. Dashed blue rows are your additions; tap one to play its path.' }));
    let data = null, where = {};
    try { data = fr?.frame.contentWindow.RTR_MAP?.(); where = fr.frame.contentWindow.RTR_WHERE?.() || {}; } catch {}
    if (!data) return mapEl.append(el('p', { className: 'rtr-mnote', textContent: 'This chapter has no map yet.' }));
    const id = fr.chapter.id, list = adds[id] || [], map = edits[id] || {};
    const shown = t => { const e = map[t]; return e && !e.deleted ? e.text : t; };
    const snip = t => (t = String(t)).length > 90 ? t.slice(0, 88) + '…' : t;
    // Chapters that share a page (Hospital and Seattle) stop where the next one starts.
    const chs = typeof CHAPTERS !== 'undefined' ? CHAPTERS : [];
    const stopAt = new Set(chs.filter(c => c.page === fr.chapter.page && c.id !== id).map(c => c.start).filter(Boolean));
    data.scenes.forEach((s, si) => {
      if (data.scenes.length > 1) mapEl.append(el('h3', { textContent: s.label }));
      const pad = (n, depth) => { n.style.paddingLeft = (6 + depth * 14) + 'px'; mapEl.append(n); return n; };
      const row = (cls, text, depth, onclick) => pad(el('button', { className: 'rtr-mrow ' + cls, textContent: text, onclick }), depth);
      const note = (text, depth) => pad(el('p', { className: 'rtr-mnote', textContent: text }), depth);
      const addedTree = (a, trail, node, choice, depth) => {
        row('added choice', snip(a.text), depth, () => go(fr, si, node, choice, trail));
        const g = a.goto === '__end' ? 'ends the scene' : a.goto === '__continue' ? 'rejoins at Continue' : a.goto ? 'rejoins as: ' + snip(shown(a.goto)) : a.children?.length ? '' : 'stops here for now';
        if (g) note('↩ ' + g, depth + 1);
        for (const c of a.children || []) addedTree(c, [...trail, c.id], node, choice, depth + 1);
      };
      // Lines and branches added after any of these texts. Choices added beside a choice are listed with it.
      const addedAfter = (texts, node, choice, depth) => {
        for (const a of list) {
          if (!texts.includes(a.anchor) || (a.kind === 'choice' && a.onChoice)) continue;
          if (a.kind === 'line') row('added', '+ ' + a.speaker + ': ' + snip(a.text), depth, () => go(fr, si, node, choice));
          else addedTree(a, [a.id], node, choice, depth);
        }
      };
      const seen = new Set();
      const walk = (nid, depth) => {
        const n = s.nodes[nid]; if (!n) return;
        if (nid !== s.start && stopAt.has(nid)) return note('→ continues in the next chapter', depth);
        const texts = n.texts.map(norm), first = texts.find(t => !map[t]?.deleted) || texts[0];
        const label = (n.title ? n.title + ' · ' : '') + (first ? snip(shown(first)) : 'Start');
        if (seen.has(nid)) return row('', '↪ Goes to: ' + label, depth, () => go(fr, si, nid));
        seen.add(nid);
        const here = where.scene === si && where.node === nid;
        row('node' + (here ? ' here' : ''), (here ? '▶ ' : '') + label, depth, () => go(fr, si, nid));
        addedAfter(texts, nid, null, depth + 1);
        for (const c of n.choices || []) {
          const label = norm(c.label);
          row('choice' + (map[label]?.deleted ? ' gone' : ''), shown(label), depth + 1, () => go(fr, si, nid, c.id));
          for (const a of list) if (a.anchor === label && a.kind === 'choice' && a.onChoice) addedTree(a, [a.id], nid, null, depth + 1);
          addedAfter([label, ...(c.texts || []).map(norm)], nid, c.id, depth + 2);
          if (c.to) walk(c.to, depth + 2); else note('Scene ends', depth + 2);
        }
        for (const t of n.routes || []) walk(t, depth + 1);
        if (n.next) walk(n.next, depth);
        else if (!n.choices?.length && !n.routes?.length) note('Scene ends', depth + 1);
      };
      walk(s.start, 0);
    });
  }

  const titleOf = id => Object.values(edits[id] || {})[0]?.title || adds[id]?.[0]?.title || id;
  function toMarkdown(id) {
    const items = Object.entries(edits[id] || {}), added = adds[id] || [], title = titleOf(id);
    const lines = ['# Road Trip Roulette: ' + title + ' dialogue edits', '', 'Exported ' + new Date().toLocaleString() + '. ' + (items.length + added.length) + ' changes.', ''];
    for (const [orig, e] of items) {
      if (e.deleted) lines.push('**' + e.speaker + '**', '- REMOVE: ' + orig);
      else lines.push('**' + e.speaker + '**', '- Was: ' + orig, '- Now: ' + e.text);
      if (e.note) lines.push('- Note: ' + e.note);
      lines.push('');
    }
    for (const a of added) {
      if (a.kind === 'choice') {
        lines.push('**New player choice**', '- After: ' + a.anchor);
        const emit = (n, pad) => {
          lines.push(pad + '- Choice: ' + n.text);
          for (const r of n.replies || []) lines.push(pad + '  - Reply: ' + r.speaker + ': ' + r.text);
          if (n.goto) lines.push(pad + '  - Then: ' + (n.goto === '__end' ? 'scene ends' : n.goto === '__continue' ? 'rejoin the story at Continue' : 'rejoin the story as "' + n.goto + '"'));
          if (n.next) lines.push(pad + '  - Note: ' + n.next);
          for (const c of n.children || []) emit(c, pad + '  ');
        };
        emit(a, '');
      } else lines.push('**New line: ' + a.speaker + '**', '- After: ' + a.anchor, '- Line: ' + a.text);
      lines.push('');
    }
    const data = { edits: edits[id] ? { [id]: edits[id] } : {}, adds: adds[id] ? { [id]: adds[id] } : {} };
    lines.push('<!-- rtr-edits-json', JSON.stringify(data).replace(/--/g, '\\u002d\\u002d'), '-->', '');
    return lines.join('\n');
  }

  function openList() {
    const { back, box } = modal();
    box.append(el('h2', { textContent: 'My edits (' + count() + ')' }));
    box.append(el('p', { className: 'hint', textContent: 'Edits save automatically in this browser. Download a chapter’s file to keep it safe, or to hand it to Claude or ChatGPT.' }));
    if (memoryOnly) box.append(el('p', { className: 'rtr-warn', textContent: 'This browser is blocking saved data, so edits last only until you close this page. Download them before leaving.' }));
    const status = el('p', { className: 'hint', style: 'margin-top:8px' });
    const file = el('input', { type: 'file', accept: '.md,.txt,text/markdown,text/plain', style: 'display:none', onchange: async () => {
      try {
        const m = (await file.files[0].text()).match(/<!-- rtr-edits-json\n([\s\S]*?)\n-->/);
        if (!m) throw new Error('no edits block');
        const incoming = JSON.parse(m[1]);
        // Files from before added lines existed hold the chapter map at the top level.
        const inEdits = incoming.edits || incoming, inAdds = incoming.adds || {};
        for (const [c, map] of Object.entries(inEdits)) Object.assign(edits[c] ??= {}, map);
        for (const [c, list] of Object.entries(inAdds)) { const have = adds[c] ??= []; for (const a of list) if (!have.some(h => h.id === a.id)) have.push(a); }
        persist(); back.remove(); openList();
      } catch { status.textContent = 'That file has no saved edits in it. Choose a file downloaded from this page.'; }
    } });
    box.append(el('div', { className: 'rtr-row' },
      el('button', { textContent: 'Load edits file', onclick: () => file.click() }), file,
      el('button', { textContent: 'Close', onclick: () => back.remove() })), status);
    for (const id of new Set([...Object.keys(edits), ...Object.keys(adds)])) {
      const map = edits[id] || {}, list = adds[id] || [], title = titleOf(id);
      box.append(el('h2', { textContent: title + ' (' + (Object.keys(map).length + list.length) + ')', style: 'margin-top:14px' }), el('div', { className: 'rtr-row', style: 'margin:0 0 8px' },
        el('button', { className: 'primary', textContent: 'Download ' + title, onclick: () => {
          const a = el('a', { href: URL.createObjectURL(new Blob([toMarkdown(id)], { type: 'text/markdown' })), download: 'rtr-dialogue-edits-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.md' });
          document.body.appendChild(a); a.click(); a.remove(); status.textContent = 'Downloaded ' + title + '.';
        } }),
        el('button', { textContent: 'Copy as text', onclick: async () => {
          try { await navigator.clipboard.writeText(toMarkdown(id)); status.textContent = 'Copied ' + title + '. Paste it into your chat.'; }
          catch { status.textContent = 'This browser blocked copying. Use Download instead.'; }
        } })));
      const undo = fn => el('button', { textContent: 'Undo', style: 'margin-top:4px', onclick: () => { fn(); persist(); back.remove(); openList(); } });
      for (const [orig, e] of Object.entries(map)) box.append(el('div', { className: 'rtr-item' },
        el('p', {}, el('strong', { textContent: e.speaker })),
        ...(e.deleted ? [el('p', { textContent: 'Removed: ' + orig })] : [el('p', { className: 'hint', textContent: 'Was: ' + orig }), el('p', { textContent: 'Now: ' + e.text })]),
        ...(e.note ? [el('p', { className: 'hint', textContent: 'Note: ' + e.note })] : []),
        undo(() => dropEdit(id, orig))));
      for (const a of list) box.append(el('div', { className: 'rtr-item' },
        el('p', {}, el('strong', { textContent: a.kind === 'choice' ? 'New choice' : 'New line: ' + a.speaker })),
        el('p', { className: 'hint', textContent: 'After: ' + a.anchor }), el('p', { textContent: a.text }),
        ...(a.replies || []).map(r => el('p', { className: 'hint', textContent: r.speaker + ': ' + r.text })),
        ...(a.children?.length ? [el('p', { className: 'hint', textContent: 'Follow-up choices: ' + a.children.length })] : []),
        undo(() => dropAdd(id, a.id))));
    }
  }
  updateBar();
})();
