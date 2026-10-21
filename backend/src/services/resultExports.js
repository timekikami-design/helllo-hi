// ============================================================
//  RESULT EXPORTS — Excel + PDF primitives shared by every Exam
//  Controller stage, the Gazette and student transcripts.
//  Transcript layout lives in transcriptPdf.js.
// ============================================================
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const LOGO = path.join(__dirname, '..', '..', 'assets', 'aust-logo.jpg');
const UNI = 'Abbottabad University of Science & Technology';
const NAVY = '#1e3a8a';
const fmt = (v, d = 2) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
const safeName = (s) => String(s || 'export').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 90);

// ---------------- Excel ----------------
function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
}

/** sections: [{ title, columns:[{header,key,width}], rows:[{}] }] */
async function excel(res, filename, title, subtitle, sections) {
  const wb = new ExcelJS.Workbook();
  wb.creator = UNI;
  const ws = wb.addWorksheet('Results');
  const width = Math.max(4, ...sections.map((s) => s.columns.length));
  const banner = (text, size, bold = true) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, width);
    r.font = { bold, size, color: { argb: 'FF1E3A8A' } };
    r.alignment = { horizontal: 'center' };
  };
  banner(UNI, 14);
  banner(title, 12);
  if (subtitle) banner(subtitle, 10, false);
  banner(`Generated ${new Date().toLocaleString()}`, 9, false);
  if (!sections.length) { ws.addRow([]); banner('No records in this scope.', 10, false); }
  for (const sec of sections) {
    ws.addRow([]);
    if (sec.heading) {
      const h = ws.addRow([sec.heading]);
      ws.mergeCells(h.number, 1, h.number, width);
      h.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
    }
    if (sec.title) {
      const t = ws.addRow([sec.title]);
      ws.mergeCells(t.number, 1, t.number, width);
      t.font = { bold: true, size: 11 };
      t.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    }
    if (sec.headerGroups) {
      // Optional grouped header row (e.g. "Semester 1 – Fall 2026" spanning its columns).
      const cells = []; const spans = [];
      for (const gh of sec.headerGroups) { spans.push([cells.length + 1, cells.length + gh.span]); cells.push(gh.label || '', ...Array(Math.max(0, gh.span - 1)).fill('')); }
      const gr = ws.addRow(cells);
      styleHeader(gr);
      for (const [a, b] of spans) if (b > a) ws.mergeCells(gr.number, a, gr.number, b);
    }
    styleHeader(ws.addRow(sec.columns.map((c) => c.header)));
    for (const row of sec.rows) {
      const r = ws.addRow(sec.columns.map((c) => (row[c.key] == null ? '' : row[c.key])));
      r.eachCell((c) => { c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }; });
      if (row.__bold) r.font = { bold: true };
    }
    sec.columns.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = Math.max(col.width || 10, c.width || 14); });
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ---------------- PDF primitives ----------------
function pdfStart(res, filename, { landscape = false } = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.pdf"`);
  doc.pipe(res);
  return doc;
}

function header(doc, title, subtitle) {
  const top = doc.page.margins.top;
  const left = doc.page.margins.left;
  const w = doc.page.width - left - doc.page.margins.right;
  if (fs.existsSync(LOGO)) { try { doc.image(LOGO, left, top - 6, { width: 44 }); } catch (_) { /* ignore */ } }
  doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text(UNI, left, top, { align: 'center', width: w });
  doc.font('Helvetica').fontSize(9).fillColor('#444').text('Office of the Controller of Examinations', { align: 'center', width: w });
  doc.moveDown(0.3).font('Helvetica-Bold').fontSize(12).fillColor('#111').text(title, { align: 'center', width: w });
  if (subtitle) doc.font('Helvetica').fontSize(9).fillColor('#555').text(subtitle, { align: 'center', width: w });
  const y = Math.max(doc.y + 4, top + 48);
  doc.moveTo(left, y).lineTo(left + w, y).lineWidth(1).strokeColor(NAVY).stroke();
  doc.y = y + 8; doc.x = left; doc.fillColor('#000');
}

function footer(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const left = doc.page.margins.left;
    const w = doc.page.width - left - doc.page.margins.right;
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // allow writing in the margin without auto page-add
    doc.font('Helvetica').fontSize(7).fillColor('#888')
      .text(`${UNI} · Generated ${new Date().toLocaleString()} · Page ${i + 1} of ${range.count}`, left, doc.page.height - 24, { align: 'center', width: w, lineBreak: false });
    doc.page.margins.bottom = oldBottom;
  }
}

/** Bordered table with header repeat on page break. columns: [{header,key,width(pt),align}] */
function table(doc, columns, rows, opts = {}) {
  const x0 = doc.page.margins.left;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const pad = 3;
  const fontSize = opts.fontSize || 8;
  const HEAD = '#1e3a8a';
  const measure = (cells, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    return Math.max(...cells.map((t, i) => doc.heightOfString(String(t), { width: columns[i].width - pad * 2 }))) + pad * 2;
  };
  // Optional grouped header (opts.headerGroups = [{label, span}]) drawn above the column header.
  const groups = opts.headerGroups || null;
  const drawGroups = () => {
    if (!groups) return;
    const widths = []; let i = 0;
    for (const g of groups) { widths.push(columns.slice(i, i + g.span).reduce((a, c) => a + c.width, 0)); i += g.span; }
    doc.font('Helvetica-Bold').fontSize(fontSize);
    const h = Math.max(...groups.map((g, k) => doc.heightOfString(String(g.label || ''), { width: widths[k] - pad * 2 }))) + pad * 2;
    const y = doc.y; let x = x0;
    groups.forEach((g, k) => {
      doc.rect(x, y, widths[k], h).fill(g.label ? '#334155' : HEAD);
      doc.rect(x, y, widths[k], h).lineWidth(0.4).strokeColor('#94a3b8').stroke();
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#ffffff').text(String(g.label || ''), x + pad, y + pad, { width: widths[k] - pad * 2, align: 'center' });
      x += widths[k];
    });
    doc.y = y + h; doc.x = x0;
  };
  const drawRow = (cells, { bold = false, fill = null } = {}, isHeader = false) => {
    const h = measure(cells, bold);
    if (doc.y + h > doc.page.height - doc.page.margins.bottom - 12) {
      doc.addPage();
      if (!isHeader) { drawGroups(); drawRow(columns.map((c) => c.header), { bold: true, fill: HEAD }, true); }
    }
    const y = doc.y;
    if (fill) doc.rect(x0, y, totalW, h).fill(fill);
    let x = x0;
    cells.forEach((t, i) => {
      doc.rect(x, y, columns[i].width, h).lineWidth(0.4).strokeColor('#94a3b8').stroke();
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(fill === HEAD ? '#ffffff' : '#111111')
        .text(String(t), x + pad, y + pad, { width: columns[i].width - pad * 2, align: columns[i].align || 'left' });
      x += columns[i].width;
    });
    doc.y = y + h; doc.x = x0;
  };
  drawGroups();
  drawRow(columns.map((c) => c.header), { bold: true, fill: HEAD }, true);
  rows.forEach((r, i) => drawRow(columns.map((c) => (r[c.key] == null || r[c.key] === '' ? (r.__bold || r.__fill ? '' : '—') : r[c.key])), { bold: !!r.__bold, fill: r.__fill || (i % 2 ? '#f8fafc' : null) }));
  doc.moveDown(0.6);
}

/** Generic sectioned PDF (stage exports, gazette). Column widths are relative. */
function pdf(res, filename, title, subtitle, sections, opts = {}) {
  const doc = pdfStart(res, filename, opts);
  header(doc, title, subtitle);
  const avail = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (!sections.length) doc.font('Helvetica').fontSize(10).text('No records in this scope.', { align: 'center' });
  for (const sec of sections) {
    if (sec.pageBreak && doc.y > doc.page.margins.top + 90) doc.addPage();
    if (sec.heading) {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(sec.heading, { width: avail });
      doc.moveDown(0.2).fillColor('#000');
    }
    if (sec.title) {
      if (doc.y > doc.page.height - 130) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(sec.title, { width: avail });
      doc.moveDown(0.2).fillColor('#000');
    }
    const sum = sec.columns.reduce((s, c) => s + (c.width || 14), 0);
    table(doc, sec.columns.map((c) => ({ ...c, width: ((c.width || 14) / sum) * avail })), sec.rows, { fontSize: opts.fontSize, headerGroups: sec.headerGroups });
  }
  footer(doc);
  doc.end();
}

// ---------------- Stage sheets ----------------
const SUBJECT_COLUMNS = [
  { header: '#', key: 'sn', width: 4, align: 'center' },
  { header: 'Roll No', key: 'rollNumber', width: 12 },
  { header: 'Student', key: 'student', width: 20 },
  { header: 'Batch', key: 'batch', width: 10 },
  { header: 'Mid (Obt / Total)', key: 'mid', width: 11, align: 'center' },
  { header: 'Final (Obt / Total)', key: 'final', width: 11, align: 'center' },
  { header: 'Total %', key: 'pct', width: 8, align: 'center' },
  { header: 'Grade', key: 'letterGrade', width: 6, align: 'center' },
  { header: 'GP', key: 'gp', width: 6, align: 'center' },
  { header: 'Sem GPA', key: 'gpa', width: 7, align: 'center' },
  { header: 'CGPA', key: 'cgpa', width: 7, align: 'center' },
  { header: 'Stage', key: 'workflowStage', width: 10, align: 'center' },
];

function subjectRows(rows) {
  return rows.map((r, i) => ({
    ...r, sn: i + 1,
    mid: `${fmt(r.midMarks, 1)} / ${fmt(r.midMax, 0)}`,
    final: `${fmt(r.finalMarks, 1)} / ${fmt(r.finalMax, 0)}`,
    pct: fmt(r.totalPercent), gp: fmt(r.gradePoints), gpa: fmt(r.semesterGpa), cgpa: fmt(r.cgpa),
  }));
}

/** One table per subject: Department › Program › Semester › Subject. */
function scopeSections(rows) {
  const by = {};
  for (const r of rows) (by[`${r.department}|${r.program}|${String(r.semester).padStart(2, '0')}|${r.courseCode}`] ||= []).push(r);
  return Object.entries(by).sort(([a], [b]) => a.localeCompare(b)).map(([, list]) => ({
    title: `${list[0].department} › ${list[0].program} › Semester ${list[0].semester || '—'} › ${list[0].courseCode} ${list[0].courseTitle} (${list[0].creditHours} Cr.)`,
    columns: SUBJECT_COLUMNS,
    rows: subjectRows(list),
  }));
}

// ---------------- Gazette ----------------
const GAZETTE_COLUMNS = [
  { header: 'Code', key: 'code', width: 14 }, { header: 'Course Title', key: 'title', width: 30 },
  { header: 'Cr.', key: 'cr', width: 5, align: 'center' }, { header: 'Mid (Obt/Tot)', key: 'mid', width: 10, align: 'center' },
  { header: 'Final (Obt/Tot)', key: 'final', width: 10, align: 'center' }, { header: '%', key: 'pct', width: 7, align: 'center' },
  { header: 'Grade', key: 'grade', width: 6, align: 'center' }, { header: 'GP / GPA', key: 'gp', width: 8, align: 'center' },
];

function gazetteSections(g) {
  return g.students.map((s) => {
    const rows = [];
    for (const sem of s.semesters) {
      rows.push({ code: `SEMESTER ${sem.semester || '—'}${sem.term ? ` · ${sem.term}` : ''}`, __bold: true, __fill: '#e0e7ff' });
      for (const sub of sem.subjects) {
        rows.push({ code: sub.courseCode, title: sub.courseTitle, cr: sub.creditHours, mid: `${fmt(sub.midMarks, 1)}/${fmt(sub.midMax, 0)}`, final: `${fmt(sub.finalMarks, 1)}/${fmt(sub.finalMax, 0)}`, pct: fmt(sub.totalPercent), grade: sub.letterGrade || '—', gp: fmt(sub.gradePoints) });
      }
      rows.push({ title: `Semester ${sem.semester || '—'} GPA  (${sem.stage})`, cr: sem.credits, gp: fmt(sem.gpa), __bold: true });
    }
    rows.push({ title: 'CGPA', gp: fmt(s.cgpa), __bold: true, __fill: '#dcfce7' });
    return {
      title: `${s.rollNumber} — ${s.student}${s.fatherName ? ` s/o ${s.fatherName}` : ''} · ${s.program}${s.registrationNumber ? ` · Reg# ${s.registrationNumber}` : ''}`,
      columns: GAZETTE_COLUMNS,
      rows,
    };
  });
}

// ------------------------------------------------------------
// Change 6 — gazette layouts (presentation only; no calculation changes).
// Remarks: "Pass" when every course meets the existing pass mark
// (lmsGrading.PASS_PERCENT), otherwise "Fail: <codes>".
// ------------------------------------------------------------
const { PASS_PERCENT } = require('../utils/lmsGrading');
const remarksOf = (subjects) => {
  const failed = subjects.filter((x) => !(Number(x.totalPercent) >= PASS_PERCENT)).map((x) => x.courseCode);
  return failed.length ? `Fail: ${failed.join(', ')}` : 'Pass';
};
const cellOf = (x) => (x ? `${x.letterGrade || '—'} (${fmt(x.totalPercent, 1)}%)` : '—');

/** Group a batch gazette by semester: [{ semester, term, courses:[{code,title}], students:[{s, sem}] }] */
function gazetteBySemester(g) {
  const by = new Map();
  for (const s of g.students) {
    for (const sem of s.semesters) {
      const k = sem.semester || 0;
      if (!by.has(k)) by.set(k, { semester: sem.semester, term: sem.term, courses: new Map(), students: [] });
      const grp = by.get(k);
      for (const x of sem.subjects) if (!grp.courses.has(x.courseCode)) grp.courses.set(x.courseCode, x.courseTitle);
      grp.students.push({ s, sem });
    }
  }
  return [...by.values()].sort((a, b) => (a.semester || 0) - (b.semester || 0))
    .map((grp) => ({ ...grp, courses: [...grp.courses.entries()].map(([code, title]) => ({ code, title })) }));
}

/** Horizontal: one row per student, one column per course, then GPA, CGPA, Remarks (per semester). */
function gazetteHorizontalSections(g) {
  return gazetteBySemester(g).map((grp, i) => ({
    pageBreak: i > 0,
    title: `Batch: ${g.batch} · Semester ${grp.semester || '—'}${grp.term ? ` · ${grp.term}` : ''}`,
    columns: [
      { header: 'Roll No', key: 'roll', width: 11 },
      { header: 'Student Name', key: 'name', width: 18 },
      ...grp.courses.map((c) => ({ header: c.code, key: `c_${c.code}`, width: 9, align: 'center' })),
      { header: 'GPA', key: 'gpa', width: 6, align: 'center' },
      { header: 'CGPA', key: 'cgpa', width: 6, align: 'center' },
      { header: 'Remarks', key: 'remarks', width: 14 },
    ],
    rows: grp.students.map(({ s, sem }) => {
      const row = { roll: s.rollNumber, name: s.student, gpa: fmt(sem.gpa), cgpa: fmt(sem.cgpa ?? s.cgpa), remarks: remarksOf(sem.subjects) };
      for (const c of grp.courses) row[`c_${c.code}`] = cellOf(sem.subjects.find((x) => x.courseCode === c.code));
      return row;
    }),
  }));
}

/** Vertical: Batch › Semester sections; each student block reads top to bottom. */
function gazetteVerticalSections(g) {
  const out = [];
  gazetteBySemester(g).forEach((grp, i) => {
    grp.students.forEach(({ s, sem }, j) => {
      const rows = [
        ...sem.subjects.map((x) => ({ item: `${x.courseCode} — ${x.courseTitle}`, result: `${fmt(x.totalPercent, 1)}%`, grade: x.letterGrade || '—', gp: fmt(x.gradePoints) })),
        { item: `Semester ${sem.semester || '—'} GPA`, gp: fmt(sem.gpa), __bold: true },
        { item: 'CGPA', gp: fmt(sem.cgpa ?? s.cgpa), __bold: true, __fill: '#dcfce7' },
        { item: 'Remarks', result: remarksOf(sem.subjects), __bold: true },
      ];
      out.push({
        pageBreak: i > 0 && j === 0,
        heading: j === 0 ? `Batch: ${g.batch} — Semester ${grp.semester || '—'}${grp.term ? ` · ${grp.term}` : ''}` : undefined,
        title: `${s.student} (${s.rollNumber})${s.program ? ` · ${s.program}` : ''}`,
        columns: [
          { header: 'Course', key: 'item', width: 46 },
          { header: 'Marks / Result', key: 'result', width: 20, align: 'center' },
          { header: 'Grade', key: 'grade', width: 8, align: 'center' },
          { header: 'GP / GPA', key: 'gp', width: 10, align: 'center' },
        ],
        rows,
      });
    });
  });
  return out;
}

/** Cumulative horizontal gazette (Batch + Current Semester groups): Roll No, Name,
 *  Semester 1 courses + GPA, Semester 2 courses + GPA, …, CGPA, Remarks. */
function gazetteCumulativeSections(c) {
  return c.groups.map((grp, i) => {
    const columns = [{ header: 'Roll No', key: 'roll', width: 10 }, { header: 'Student Name', key: 'name', width: 16 }];
    const headerGroups = [{ label: '', span: 2 }];
    for (const b of grp.blocks) {
      for (const co of b.courses) columns.push({ header: co.code, key: `s${b.semester}_${co.code}`, width: 7, align: 'center' });
      columns.push({ header: `Sem ${b.semester} GPA`, key: `s${b.semester}_gpa`, width: 6, align: 'center' });
      headerGroups.push({ label: `Semester ${b.semester}${b.term ? ` – ${b.term}` : ''}`, span: b.courses.length + 1 });
    }
    columns.push({ header: 'CGPA', key: 'cgpa', width: 6, align: 'center' }, { header: 'Remarks', key: 'remarks', width: 14 });
    headerGroups.push({ label: '', span: 2 });
    const rows = grp.rows.map((r) => {
      const row = { roll: r.rollNumber, name: r.student, cgpa: fmt(r.cgpa), remarks: r.remarks };
      for (const b of grp.blocks) {
        const sm = r.semesters[b.semester];
        for (const co of b.courses) { const m = sm && sm.marks[co.code]; row[`s${b.semester}_${co.code}`] = m && m.total != null ? fmt(m.total, 1) : '—'; }
        row[`s${b.semester}_gpa`] = sm ? fmt(sm.gpa) : '—';
      }
      return row;
    });
    return { pageBreak: i > 0, title: `Batch: ${grp.batch} – ${grp.currentSemesterLabel}${grp.term ? ` (${grp.term})` : ''} · ${grp.rows.length} student(s)`, headerGroups, columns, rows };
  });
}

module.exports = {
  gazetteCumulativeSections,
  UNI, NAVY, LOGO, fmt, safeName,
  excel, pdf, pdfStart, header, footer, table,
  SUBJECT_COLUMNS, subjectRows, scopeSections, GAZETTE_COLUMNS, gazetteSections,
  gazetteBySemester, gazetteHorizontalSections, gazetteVerticalSections, remarksOf,
};
