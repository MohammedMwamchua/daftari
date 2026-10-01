/* Export helpers for Daftari: CSV (opens in Excel), a small PDF writer, and a save function.
   saveFile() uses the viewer's download prompt when this page is shown inside claude.ai,
   and a normal browser download everywhere else (for example in your own Vite project). */

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows) => `\ufeff${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;

const esc = (s) =>
  String(s)
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

/* lines: [{ text, size = 11, font = 'F1' (Helvetica) | 'F2' (bold) | 'F3' (Courier), gap = 0 }]
   Text must be plain ASCII. Returns a PDF Blob (A4, as many pages as needed). */
export function makePdf(lines) {
  const W = 595;
  const H = 842;
  const M = 50;
  const pages = [];
  let cur = [];
  let y = H - M;
  lines.forEach((l) => {
    const size = l.size || 11;
    const lead = Math.round(size * 1.45) + (l.gap || 0);
    if (y - lead < M) {
      pages.push(cur);
      cur = [];
      y = H - M;
    }
    y -= lead;
    if (l.text) cur.push(`BT /${l.font || 'F1'} ${size} Tf ${M} ${y} Td (${esc(l.text)}) Tj ET`);
  });
  pages.push(cur);

  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const kids = [];
  pages.forEach((cmds) => {
    const stream = cmds.join('\n');
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    kids.push(`${pageId} 0 R`);
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

/* Returns 'saved', 'declined' or 'failed'. */
export async function saveFile(filename, data) {
  let dl = null;
  try {
    dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  } catch (e) {
    dl = null;
  }
  if (dl) {
    try {
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      return e && e.code === 'declined' ? 'declined' : 'failed';
    }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return 'saved';
  } catch (e) {
    return 'failed';
  }
}
