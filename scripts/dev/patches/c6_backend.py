import os
os.chdir('/home/user/webapp/backend/src')
def patch(path, reps):
    s=open(path).read()
    for a,b in reps:
        assert s.count(a)==1, (path, a[:60]); s=s.replace(a,b)
    open(path,'w').write(s)
# per-semester cumulative CGPA (additive field, existing index value)
patch('services/resultsService.js', [(
"""      gpa: idx[s.studentId]?.[sem.semester || 0]?.gpa ?? computeGPA(sem.subjects),""",
"""      gpa: idx[s.studentId]?.[sem.semester || 0]?.gpa ?? computeGPA(sem.subjects),
      // Change 6 — cumulative CGPA at this semester (same index; display only).
      cgpa: idx[s.studentId]?.[sem.semester || 0]?.cgpa ?? null,""")])
# PDF: optional page break before a section (additive)
patch('services/resultExports.js', [
("""  for (const sec of sections) {
    if (sec.title) {
      if (doc.y > doc.page.height - 130) doc.addPage();""",
"""  for (const sec of sections) {
    if (sec.pageBreak && doc.y > doc.page.margins.top + 90) doc.addPage();
    if (sec.heading) {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(sec.heading, { width: avail });
      doc.moveDown(0.2).fillColor('#000');
    }
    if (sec.title) {
      if (doc.y > doc.page.height - 130) doc.addPage();"""),
("""module.exports = {
  UNI, NAVY, LOGO, fmt, safeName,
  excel, pdf, pdfStart, header, footer, table,
  SUBJECT_COLUMNS, subjectRows, scopeSections, GAZETTE_COLUMNS, gazetteSections,
};""",
"""// ------------------------------------------------------------
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

module.exports = {
  UNI, NAVY, LOGO, fmt, safeName,
  excel, pdf, pdfStart, header, footer, table,
  SUBJECT_COLUMNS, subjectRows, scopeSections, GAZETTE_COLUMNS, gazetteSections,
  gazetteBySemester, gazetteHorizontalSections, gazetteVerticalSections, remarksOf,
};"""),
])
# excel: heading support (additive)
patch('services/resultExports.js', [(
"""  for (const sec of sections) {
    ws.addRow([]);
    if (sec.title) {""",
"""  for (const sec of sections) {
    ws.addRow([]);
    if (sec.heading) {
      const h = ws.addRow([sec.heading]);
      ws.mergeCells(h.number, 1, h.number, width);
      h.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
    }
    if (sec.title) {""")])
# route: layout param
patch('routes/lms/academic/examWorkflow.js', [(
"""  const sections = X.gazetteSections(g);
  await audit(req, 'EXAM_GAZETTE_EXPORT', 'Gazette', g.batch, { after: { format: req.params.format } });
  if (req.params.format === 'excel') return X.excel(res, `gazette-${g.batch}`, title, subtitle, sections);
  if (req.params.format === 'pdf') return X.pdf(res, `gazette-${g.batch}`, title, subtitle, sections);""",
"""  // Change 6 — optional ?layout=horizontal|vertical. Without it the export is
  // exactly the existing one (same sections, same PDF orientation).
  const layout = ['horizontal', 'vertical'].includes(String(req.query.layout)) ? String(req.query.layout) : null;
  const sections = layout === 'horizontal' ? X.gazetteHorizontalSections(g)
    : layout === 'vertical' ? X.gazetteVerticalSections(g) : X.gazetteSections(g);
  const fname = `gazette-${g.batch}${layout ? `-${layout}` : ''}`;
  await audit(req, 'EXAM_GAZETTE_EXPORT', 'Gazette', g.batch, { after: { format: req.params.format, layout: layout || 'standard' } });
  if (req.params.format === 'excel') return X.excel(res, fname, title, subtitle, sections);
  if (req.params.format === 'pdf') {
    if (layout === 'horizontal') return X.pdf(res, fname, title, subtitle, sections, { landscape: true, fontSize: 7 });
    if (layout === 'vertical') return X.pdf(res, fname, title, subtitle, sections, { landscape: false });
    return X.pdf(res, fname, title, subtitle, sections);
  }""")])
print('c6 backend done')
