// ── Comic PDF writer (Ch. 18.3 / Phase 7) — node CLI tests ────────────────
// Run: node tests/pdf.test.mjs   (also `npm test`)
//
// Builds a PDF from real JPEGs (sharp, a devDependency) and checks the
// structure a reader relies on: header, one Page per input, /Count, a
// cross-reference table whose offsets land exactly on "N 0 obj", the
// trailer's startxref, the embedded JPEG bytes intact, and both page sizes.

import sharp from 'sharp';
import { buildPdf, PAGE_SIZES } from '../src/ui/ComicPdf.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const jpeg = async (w, h, color) => new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg({ quality: 80 }).toBuffer());
const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');

const p1 = await jpeg(400, 566, '#F6F1E4');
const p2 = await jpeg(400, 566, '#1B2A44');
const pdf = buildPdf([{ jpeg: p1, w: 400, h: 566 }, { jpeg: p2, w: 400, h: 566 }], { pageSize: 'a4', title: 'Vol 1 — TESTER (TO BE CONTINUED)' });
const txt = latin1(pdf);

check('header', txt.startsWith('%PDF-1.4\n'));
check('two pages counted', /\/Type \/Pages \/Kids \[[^\]]+\] \/Count 2/.test(txt));
check('two Page objects', (txt.match(/\/Type \/Page\b/g) || []).length === 2);
check('two DCT images with the right dimensions', (txt.match(/\/Subtype \/Image \/Width 400 \/Height 566/g) || []).length === 2 && (txt.match(/\/DCTDecode/g) || []).length === 2);
check('A4 media box', txt.includes(`/MediaBox [0 0 ${PAGE_SIZES.a4.w} ${PAGE_SIZES.a4.h}]`));
check('title in Info (escaped, ASCII-safe)', /\/Title \(Vol 1 \? TESTER \(TO BE CONTINUED\)\)/.test(txt) || /\/Title \(Vol 1 \? TESTER \\\(TO BE CONTINUED\\\)\)/.test(txt));
check('JPEG bytes embedded verbatim', Buffer.from(pdf).indexOf(Buffer.from(p1)) > 0 && Buffer.from(pdf).indexOf(Buffer.from(p2)) > 0);

// xref offsets must point exactly at "N 0 obj".
const xrefPos = txt.lastIndexOf('\nxref\n') + 1;
const startxref = Number(txt.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
check('startxref points at the xref table', startxref === xrefPos);
const lines = txt.slice(xrefPos).split('\n');
const count = Number(lines[1].split(' ')[1]);
check('xref counts every object + the free head', count === 1 + 3 + 2 * 3);
let offsetsOk = true;
for (let i = 1; i < count; i++) {
  const off = Number(lines[2 + i].slice(0, 10));   // lines[2] is the free-list head
  const at = latin1(pdf.subarray(off, off + 12));
  if (!at.startsWith(`${i} 0 obj`)) { offsetsOk = false; console.error('   bad offset for obj', i, JSON.stringify(at)); }
}
check('every xref offset lands on its object', offsetsOk);
check('trailer names root + info', /\/Root 1 0 R \/Info 3 0 R/.test(txt));

// Letter + a single tall page fits inside the margins.
const tall = buildPdf([{ jpeg: p1, w: 1240, h: 1754 }], { pageSize: 'letter', margin: 18 });
const t2 = latin1(tall);
check('Letter media box', t2.includes(`/MediaBox [0 0 ${PAGE_SIZES.letter.w} ${PAGE_SIZES.letter.h}]`));
const cm = t2.match(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/);
check('image scaled to fit within the sheet', cm && Number(cm[1]) <= PAGE_SIZES.letter.w - 36 + 0.01 && Number(cm[2]) <= PAGE_SIZES.letter.h - 36 + 0.01 && Number(cm[3]) >= 17.9 && Number(cm[4]) >= 17.9);
check('unknown page size falls back to A4', latin1(buildPdf([{ jpeg: p1, w: 10, h: 10 }], { pageSize: 'nope' })).includes(`/MediaBox [0 0 ${PAGE_SIZES.a4.w}`));
check('empty document is still a valid PDF', latin1(buildPdf([])).includes('/Count 0'));

console.log(`pdf tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
