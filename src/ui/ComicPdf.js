/**
 * Minimal PDF writer for the comic (Ch. 18.3 / Phase 7).
 *
 * One JPEG per page, scaled to fit the sheet with a small margin, plus a
 * document title.  No dependency, no network, works in a WKWebView: the
 * reader renders each page to a canvas, encodes it as JPEG, and hands the
 * bytes here.  Output is a plain PDF 1.4 with a correct cross-reference
 * table (offsets computed from the actual byte lengths), which is what
 * iOS Files / Preview / Acrobat expect.
 *
 * Pure JS — tests/pdf.test.mjs checks the structure.
 */

export const PAGE_SIZES = {
  a4:     { w: 595.28, h: 841.89, label: 'A4' },
  letter: { w: 612,    h: 792,    label: 'US Letter' },
};

const enc = new TextEncoder();

function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Escape a string for a PDF literal string ( … ). */
function pdfString(s) {
  return '(' + String(s ?? '').replace(/[\\()]/g, (m) => '\\' + m).replace(/[^\x20-\x7E]/g, '?') + ')';
}

/**
 * @param pages  [{ jpeg: Uint8Array, w: px, h: px }]  in order
 * @param opts   { pageSize: 'a4'|'letter', title, author, margin (pt) }
 * @returns Uint8Array
 */
export function buildPdf(pages, opts = {}) {
  const size = PAGE_SIZES[opts.pageSize] ?? PAGE_SIZES.a4;
  const margin = Number.isFinite(opts.margin) ? opts.margin : 18;
  const objs = [];                 // Uint8Array bodies, 1-indexed by position + 1
  const add = (body) => { objs.push(body instanceof Uint8Array ? body : enc.encode(body)); return objs.length; };

  // 1: catalog, 2: pages (filled after we know the kids), 3: info
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');   // placeholder for /Pages
  add(`<< /Title ${pdfString(opts.title ?? 'Road Trip Roulette Comic')} /Author ${pdfString(opts.author ?? 'Road Trip Roulette')} /Producer (Road Trip Roulette ComicPdf) >>`);

  const kids = [];
  pages.forEach((pg, i) => {
    const imgW = Math.max(1, pg.w | 0), imgH = Math.max(1, pg.h | 0);
    // Image object.
    const head = enc.encode(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
    const imgObj = add(concat([head, pg.jpeg, enc.encode('\nendstream')]));
    // Fit inside the margins, centred.
    const availW = size.w - margin * 2, availH = size.h - margin * 2;
    const s = Math.min(availW / imgW, availH / imgH);
    const dw = imgW * s, dh = imgH * s;
    const dx = (size.w - dw) / 2, dy = (size.h - dh) / 2;
    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im${i} Do Q`;
    const contentObj = add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`);
    const pageObj = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size.w} ${size.h}] /Resources << /XObject << /Im${i} ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    kids.push(pageObj);
  });
  objs[1] = enc.encode(`<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);

  // Serialise with a real xref table.
  const parts = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  let offset = parts[0].length;
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(offset);
    const chunk = concat([enc.encode(`${i + 1} 0 obj\n`), body, enc.encode('\nendobj\n')]);
    parts.push(chunk); offset += chunk.length;
  });
  const xrefAt = offset;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += String(o).padStart(10, '0') + ' 00000 n \n';
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(enc.encode(xref));
  return concat(parts);
}

/** Byte length of the PDF a set of pages would make (cheap estimate). */
export function estimatePdfBytes(pages) {
  return pages.reduce((n, p) => n + p.jpeg.length + 400, 600);
}
