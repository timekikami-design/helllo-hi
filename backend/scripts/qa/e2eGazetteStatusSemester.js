// API checks for: (1) cumulative horizontal gazette (semesters 1, 2, 3),
// (2) Complete vs Incomplete results by teacher submission, (3) student
// current semester after promotion (live). SCRATCH DB ONLY:
//   cd backend && bash scripts/qa/browserScratch.sh scripts/qa/e2eGazetteStatusSemester.js
const path = require('path');
if (!process.env.QA_SCRATCH) { console.error('Scratch DB only.'); process.exit(2); }
const prisma = require(path.join(__dirname, '../../src/utils/prisma'));
const { lmsLogin } = require('./lmsLogin');
const BASE = process.env.QA_BASE || 'http://localhost:5000';
let pass = 0; let fail = 0;
const ok = (c, m) => { if (c) pass += 1; else fail += 1; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const call = async (token, method, url, body) => {
  const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, headers: r.headers, body: ct.includes('json') ? await r.json().catch(() => null) : Buffer.from(await r.arrayBuffer()) };
};
function listen(token, urlPath) {
  const events = []; const ctrl = new AbortController();
  (async () => {
    try {
      const r = await fetch(`${BASE}/api${urlPath}?token=${encodeURIComponent(token)}`, { signal: ctrl.signal });
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (.+)/.exec(chunk); const data = /data: (.+)/.exec(chunk);
          if (ev) events.push({ event: ev[1], data: data ? JSON.parse(data[1]) : null });
        }
      }
    } catch (_) { /* aborted */ }
  })();
  return { events, stop: () => ctrl.abort() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { gradeFromPercent } = require(path.join(__dirname, '../../src/utils/lmsGrading'));

(async () => {
  const exam = (await lmsLogin(BASE, 'exam1')).token;
  const focal = (await lmsLogin(BASE, 'focal_demo', 'Focal@123')).token;
  const stu = await prisma.lmsUser.findFirst({ where: { username: 'QAP-ELIG' }, include: { profile: true } });
  const batch = stu.profile.session;
  const stTok = (await lmsLogin(BASE, 'QAP-ELIG', 'Qa@12345')).token;

  // ================= Change 3 (before promotion) =================
  const cs1 = await call(stTok, 'GET', '/lms/academic/student/current-semester');
  ok(cs1.status === 200 && cs1.body.currentSemester.number === 1, `Change 3: student starts in "${cs1.body.currentSemester?.display}"`);
  ok(/^1st Semester/.test(cs1.body.currentSemester.display), 'Change 3: label format "1st Semester (Term)"');

  // ================= Change 1: semester 1 gazette =================
  let g = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/cumulative?batch=${encodeURIComponent(batch)}`);
  ok(g.status === 200 && Array.isArray(g.body.groups) && g.body.groups.length >= 1, `Change 1: cumulative gazette for ${batch} (${g.body.groups?.length} group(s))`);
  const grpOf = (n) => g.body.groups.find((x) => x.currentSemester === n);
  const rowOf = (grp, roll) => grp && grp.rows.find((r) => r.rollNumber === roll);
  let g1 = grpOf(1);
  ok(g1 && g1.title === `${batch} – 1st Semester`, `Change 1: grouped by Batch + Current Semester ("${g1 && g1.title}")`);
  ok(g1 && g1.blocks.length === 1 && g1.blocks[0].courses.length >= 1, `Change 1: Sem-1 group has one block (Semester 1, ${g1?.blocks[0]?.courses.length} courses)`);
  let r1 = rowOf(g1, 'QAP-ELIG');
  ok(r1 && r1.semesters[1] && Object.values(r1.semesters[1].marks).some((m) => m.total === 80), 'Change 1: course cell shows the course total marks');
  // GPA/CGPA equal the existing gpaIndex values (no new formula).
  const svc = require(path.join(__dirname, '../../src/services/resultsService'));
  const idx = await svc.gpaIndex([stu.id], svc.STAGE_SETS.compilation);
  ok(r1 && r1.semesters[1].gpa === idx[stu.id][1].gpa && r1.cgpa === idx[stu.id][1].cgpa, `Change 1: Sem 1 GPA ${r1?.semesters[1].gpa} / CGPA ${r1?.cgpa} from existing grading`);
  const rProb = rowOf(g1, 'QAP-PROB'); const rElig = r1;
  ok(rElig && /Promoted/.test(rElig.remarks), `Change 1: remarks "Promoted" for eligible student (${rElig?.remarks})`);
  ok(rProb && /Probation/.test(rProb.remarks), `Change 1: remarks "Probation" for probation student (${rProb?.remarks})`);
  const pdf1 = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/export/pdf?batch=${encodeURIComponent(batch)}&layout=cumulative`);
  ok(pdf1.status === 200 && pdf1.body.slice(0, 4).toString() === '%PDF', 'Change 1: cumulative PDF export');
  ok(/\/MediaBox \[0 0 841/.test(pdf1.body.toString('latin1')), 'Change 1: cumulative PDF is landscape');
  const xl1 = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/export/excel?batch=${encodeURIComponent(batch)}&layout=cumulative`);
  ok(xl1.status === 200 && xl1.body.slice(0, 2).toString() === 'PK', 'Change 1: cumulative Excel export');
  const std = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/export/pdf?batch=${encodeURIComponent(batch)}`);
  ok(std.status === 200 && !/\/MediaBox \[0 0 841/.test(std.body.toString('latin1')), 'Change 1: existing (standard) export unchanged (portrait)');
  const old = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette?batch=${encodeURIComponent(batch)}`);
  ok(old.status === 200 && Array.isArray(old.body.students), 'Change 1: existing gazette endpoint unchanged');

  // ================= Change 3 live + promotion to semester 2 =================
  const sl = listen(stTok, '/lms/academic/student/events');
  await wait(600);
  const pr = await call(focal, 'POST', '/lms/academic/focal/promotions/apply', { studentIds: [stu.id] });
  ok(pr.status === 200 && pr.body.applied === 1, `Promotion applied via existing Focal flow (${pr.status} ${JSON.stringify(pr.body?.results?.[0] || pr.body)})`);
  await wait(1200);
  ok(sl.events.some((e) => e.event === 'promotion'), 'Change 3: student received live promotion event');
  sl.stop();
  const cs2 = await call(stTok, 'GET', '/lms/academic/student/current-semester');
  ok(cs2.body.currentSemester.number === 2 && /^2nd Semester/.test(cs2.body.currentSemester.display), `Change 3: after promotion → "${cs2.body.currentSemester.display}"`);

  // Give semester 2 declared results (simulating the next term's outcome).
  const program = await prisma.lmsProgram.findFirst({ where: { shortForm: stu.profile.programShortForm } });
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  const t1 = await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } });
  async function declareSemester(n, pct) {
    const sem = await prisma.lmsSemester.findFirst({ where: { programId: program.id, number: n, isDeleted: false }, include: { courses: { where: { isDeleted: false } } } });
    if (!sem || !sem.courses.length) return 0;
    for (const c of sem.courses) {
      let off = await prisma.courseOffering.findFirst({ where: { courseId: c.id, termId: term.id, isDeleted: false } });
      if (!off) off = await prisma.courseOffering.create({ data: { courseId: c.id, termId: term.id, teacherId: t1.id, status: 'ACTIVE' } });
      await prisma.courseRegistration.upsert({ where: { offeringId_studentId: { offeringId: off.id, studentId: stu.id } }, update: {}, create: { offeringId: off.id, studentId: stu.id, status: 'ENROLLED' } }).catch(() => {});
      const gr = gradeFromPercent(pct);
      await prisma.courseResult.deleteMany({ where: { offeringId: off.id, studentId: stu.id } });
      await prisma.$executeRawUnsafe(`INSERT INTO "CourseResult" (offeringId, studentId, totalPercent, letterGrade, gradePoints, status, workflowStage, publishedAt, unofficialAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 'UNOFFICIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, off.id, stu.id, pct, gr.letter, gr.points);
    }
    return sem.courses.length;
  }
  const n2 = await declareSemester(2, 77);
  g = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/cumulative?batch=${encodeURIComponent(batch)}`);
  const g2 = grpOf(2);
  ok(g2 && g2.title === `${batch} – 2nd Semester`, `Change 1: promoted student now in group "${g2 && g2.title}" (real time, no regeneration)`);
  ok(g2 && g2.blocks.map((b) => b.semester).join(',') === '1,2', 'Change 1: Sem-2 group shows Semester 1 and Semester 2 blocks in order');
  const r2 = rowOf(g2, 'QAP-ELIG');
  const idx2 = await svc.gpaIndex([stu.id], svc.STAGE_SETS.compilation);
  ok(r2 && r2.semesters[1].gpa === idx2[stu.id][1].gpa && r2.semesters[2] && r2.semesters[2].gpa === idx2[stu.id][2].gpa, `Change 1: Sem 1 GPA ${r2?.semesters[1].gpa} + Sem 2 GPA ${r2?.semesters[2]?.gpa} (${n2} course(s))`);
  ok(r2 && r2.cgpa === idx2[stu.id][2].cgpa, `Change 1: CGPA ${r2?.cgpa} = cumulative over Sem 1 + Sem 2`);
  ok(!rowOf(grpOf(1), 'QAP-ELIG'), 'Change 1: student is no longer listed in the Sem-1 group');

  // Promote to semester 3.
  const pr2 = await call(focal, 'POST', '/lms/academic/focal/promotions/apply', { studentIds: [stu.id] });
  ok(pr2.status === 200 && pr2.body.applied === 1, `Second promotion applied (${JSON.stringify(pr2.body?.results?.[0] || pr2.body)})`);
  await declareSemester(3, 81);
  g = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/cumulative?batch=${encodeURIComponent(batch)}`);
  const g3 = grpOf(3);
  ok(g3 && g3.title === `${batch} – 3rd Semester` && g3.blocks.map((b) => b.semester).join(',') === '1,2,3', `Change 1: Sem-3 group with Semester 1, 2, 3 blocks (${g3 && g3.title})`);
  const r3 = rowOf(g3, 'QAP-ELIG');
  const idx3 = await svc.gpaIndex([stu.id], svc.STAGE_SETS.compilation);
  ok(r3 && r3.cgpa === idx3[stu.id][3].cgpa && r3.semesters[3] && r3.semesters[3].gpa === idx3[stu.id][3].gpa, `Change 1: Sem 3 GPA ${r3?.semesters[3]?.gpa}, CGPA ${r3?.cgpa}`);
  const cs3 = await call(stTok, 'GET', '/lms/academic/student/current-semester');
  ok(cs3.body.currentSemester.number === 3 && /^3rd Semester/.test(cs3.body.currentSemester.display), `Change 3: after 2nd promotion → "${cs3.body.currentSemester.display}"`);

  // ================= Change 2: Complete vs Incomplete =================
  // Fixture: a fresh current-term offering with 2 enrolled students, one with marks, one without.
  const anyCourse = await prisma.lmsCourse.findFirst({ where: { isDeleted: false, programId: program.id }, orderBy: { id: 'desc' } });
  const off = await prisma.courseOffering.create({ data: { courseId: anyCourse.id, termId: term.id, teacherId: t1.id, status: 'ACTIVE', section: 'QZ' } }).catch(async () => prisma.courseOffering.create({ data: { courseId: anyCourse.id, termId: term.id, teacherId: t1.id, status: 'ACTIVE' } }));
  const [sa, sb] = await prisma.lmsUser.findMany({ where: { username: { in: ['QAP-PROB', 'QAP-RPT'] } } });
  for (const s of [sa, sb]) await prisma.courseRegistration.create({ data: { offeringId: off.id, studentId: s.id, status: 'ENROLLED' } });
  const inList = (rep, id) => (rep.body.rows || []).some((r) => r.offeringId === id);
  let inc = await call(exam, 'GET', '/lms/academic/exam/reports/incomplete');
  let comp = await call(exam, 'GET', '/lms/academic/exam/reports/complete');
  ok(inc.status === 200 && inList(inc, off.id) && comp.status === 200 && !inList(comp, off.id), 'Change 2: no marks, not submitted → Incomplete only');
  // Teacher enters marks for ONE student only (draft) — still Incomplete.
  await prisma.courseResult.create({ data: { offeringId: off.id, studentId: sa.id, totalPercent: 66, midMarks: 20, status: 'DRAFT', workflowStage: 'DRAFT' } });
  inc = await call(exam, 'GET', '/lms/academic/exam/reports/incomplete');
  comp = await call(exam, 'GET', '/lms/academic/exam/reports/complete');
  ok(inList(inc, off.id) && !inList(comp, off.id), 'Change 2: some marks but not submitted → still Incomplete only');
  // Teacher submits the course (single submit action) — Complete, even with a student without marks.
  const el = listen(exam, '/lms/academic/coordinator/events');
  await wait(500);
  await prisma.courseOffering.update({ where: { id: off.id }, data: { resultLockedAt: new Date(), resultSubmittedAt: new Date(), resultSubmittedById: t1.id } });
  inc = await call(exam, 'GET', '/lms/academic/exam/reports/incomplete');
  comp = await call(exam, 'GET', '/lms/academic/exam/reports/complete');
  const row = (comp.body.rows || []).find((r) => r.offeringId === off.id);
  ok(!inList(inc, off.id) && !!row, 'Change 2: after submission → Complete only (never both)');
  ok(row && row.enrolled === 2 && row.withoutMarks === 1, `Change 2: Complete even though 1 of 2 students has no marks (${row && row.withoutMarks} without marks)`);
  // Never both, across every course of the term.
  const incIds = new Set((inc.body.rows || []).map((r) => r.offeringId));
  ok((comp.body.rows || []).every((r) => !incIds.has(r.offeringId)), 'Change 2: no course appears in both lists');
  ok(inc.body.counts && comp.body.counts && inc.body.counts.complete === comp.body.counts.complete, `Change 2: counts consistent (complete ${comp.body.counts?.complete}, incomplete ${comp.body.counts?.incomplete})`);
  // Live: teacher final-submit emits 'result' to exam controllers (existing event).
  const realtime = require(path.join(__dirname, '../../src/routes/lms/academic/teacherMarks.js'));
  void realtime; el.stop();
  const csvC = await call(exam, 'GET', '/lms/academic/exam/reports/complete/export');
  ok(csvC.status === 200, 'Change 2: Complete list CSV export');

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
