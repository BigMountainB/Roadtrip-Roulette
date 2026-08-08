#!/usr/bin/env node
// ── iCloud conflict-copy guard ───────────────────────────────────────────
//
// This repo lives under ~/Documents, which is synced by iCloud Drive
// ("Desktop & Documents Folders" is on).  When iCloud can't reconcile two
// versions of a file it does NOT warn — it silently writes the loser beside
// the winner as `name 2.ext`.
//
// That is where `src/road/Road 2.js` kept coming from.  It was a 4,458-line
// near-copy of Road.js, deleted in bf00890 (2026-07-31), and back on disk
// afterwards with an mtime of 2026-07-27 — a stale copy iCloud had been
// holding, restored days after the delete.  Nothing imported it, so the
// bundler never complained; it just sat there looking like live code and
// absorbing edits meant for the real file.  `CopSystem 2.js` was doing the
// same thing.
//
// Git can't catch this on its own: the copies are UNTRACKED, so they never
// appear in a diff and a clean `git status` says nothing about them.  This
// check runs before `build` and `test` so a conflict copy fails loudly the
// next time anyone touches the project instead of lurking for a week.
//
// If one trips: check whether the copy holds work the real file is missing
// (compare method names, not line counts — indentation churn makes a plain
// diff useless), then delete it.  Almost always it is stale.

import { readdirSync, statSync } from 'node:fs';
import { join, basename, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Only the directories that hold real source. `Archive/` is a deliberate
// parking lot for unused art and `node_modules/` is not ours to police.
const SCAN = ['src', 'scripts', 'tests', 'public', 'website'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'Archive', 'tmp', 'ios']);

// `foo 2.js` / `foo 3.png` — iCloud's conflict suffix — and Finder's
// `foo copy.js`. The space before the digit is what distinguishes a conflict
// copy from a legitimately numbered file (`icon-512.png`, `slice2.js`).
const CONFLICT = /(?: \d+| copy(?: \d+)?)$/;

function walk(dir, hits) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return hits; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) { walk(full, hits); continue; }
    const stem = basename(e.name, extname(e.name));
    if (CONFLICT.test(stem)) hits.push(full);
  }
  return hits;
}

const hits = SCAN.flatMap(d => walk(join(ROOT, d), []));

if (hits.length) {
  const rel = p => p.slice(ROOT.length + 1);
  console.error('\n\x1b[31m✗ iCloud conflict copies found\x1b[0m — these are not real source files:\n');
  for (const h of hits) {
    let size = '';
    try { size = ` (${Math.round(statSync(h).size / 1024)} KB)`; } catch {}
    console.error(`    ${rel(h)}${size}`);
  }
  console.error(`
  iCloud Drive writes these when it can't reconcile two versions of a file.
  They are untracked, so git will never flag them, and nothing imports them —
  but they look like live code and swallow edits meant for the real file.

  Confirm the copy holds nothing the original is missing, then:
${hits.map(h => `      rm ${JSON.stringify(rel(h))}`).join('\n')}
`);
  process.exit(1);
}

console.log('✓ no iCloud conflict copies');
