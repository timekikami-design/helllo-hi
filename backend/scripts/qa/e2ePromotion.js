// ============================================================
//  QA — Sections 10 + 11 (Focal Person semester promotion) e2e.
//  Creates DECLARED results, which DB triggers make immutable, so this
//  must run on a scratch copy of the DB:
//    cd backend && bash scripts/qa/withScratchDb.sh scripts/qa/e2ePromotion.js
// ============================================================
const crypto = require('crypto');
const { lmsLogin } = require('./lmsLogin');
const prisma = require('../../src/utils/prisma');

if (!process.env.QA_SCRATCH) {
  console.error('Refusing to run: use scripts/qa/withScratchDb.sh (declared results are immutable).');
  process.exit(2);
}
const BASE = process.env.QA_BASE || 'http://localhost:5055';
let pass = 0; let fail = 0;
const ok = (c, m, extra) => { if (c) pass += 1; else fail += 1; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && extra !== undefined ? ` ${JSON.stringify(extra).slice(0, 400)}` : ''}`); };
async function call(token, method, p, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (_) { /* empty */ }
  return { s: r.status, d };
}
const F = '/api/lms/academic/focal';

const STUDENTS = {
  'QAP-ELIG': [80, 75, 70, 85],
  'QAP-PROB': [62, 58, 55, 60],
  'QAP-RPT': [85, 80, 78, 40],
  'QAP-FAIL': [85, 80, 78, 40],
  'QAP-DROP': [45, 50, 52, 40],
};

(async () => {
  const { gradeFromPercent } = require('../../src/utils/lmsGrading');
  const tmpl = await prisma.lmsStudentProfile.findFirst({ where: { programShortForm: 'ADCS' } });
  const sem1 = await prisma.lmsSemester.findFirst({ where: { programId: 1, number: 1, isDeleted: false }, include: { courses: { where: { isDeleted: false }, orderBy: { id: 'asc' } } } });
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  const offs = await prisma.courseOffering.findMany({ where: { termId: term.id, isDeleted: false, courseId: { in: sem1.courses.map((c) => c.id) } } });
  const ids = {};
  for (const [roll, marks] of Object.entries(STUDENTS)) {
    const u = await prisma.lmsUser.create({ data: { username: roll, passwordHash: 'x', role: 'Student', mustChangePassword: false } });
    ids[roll] = u.id;
    const { id: _i, lmsUserId: _l, createdAt: _c, updatedAt: _u, ...rest } = tmpl;
    await prisma.lmsStudentProfile.create({ data: { ...rest, lmsUserId: u.id, fullName: `QA ${roll}`, rollNumber: roll, registrationNumber: `REG-${roll}`, cnic: `00000-${crypto.randomInt(1e6, 9e6)}-1`, email: `${roll.toLowerCase()}@qa.test` } });
    for (let i = 0; i < sem1.courses.length; i += 1) {
      const c = sem1.courses[i]; const off = offs.find((o) => o.courseId === c.id);
      await prisma.courseRegistration.create({ data: { offeringId: off.id, studentId: u.id, status: 'ENROLLED' } });
      const g = gradeFromPercent(marks[i]);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CourseResult" (offeringId, studentId, totalPercent, letterGrade, gradePoints, status, workflowStage, publishedAt, unofficialAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 'UNOFFICIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        off.id, u.id, marks[i], g.letter, g.points,
      );
    }
  }

  const fo = (await lmsLogin(BASE, 'focal_demo', 'Focal@123')).token;
  const f1 = (await lmsLogin(BASE, 'focal1')).token;
  const pv = (await lmsLogin(BASE, 'provost1')).token;
  const find = (d, roll) => Object.values(d.lists).flat().find((r) => r.roll === roll);

  console.log('\nS10 lists (professional exception OFF)');
  await call(fo, 'PUT', `${F}/promotion-settings`, { professionalException: false, professionalCourseCodes: [] });
  let r = await call(fo, 'GET', `${F}/promotions`);
  ok(r.s === 200 && r.d.lists && r.d.stats, 'GET /promotions returns lists + stats', r.d);
  const L = r.d;
  ok(find(L, 'QAP-ELIG')?.status === 'ELIGIBLE' && find(L, 'QAP-ELIG')?.list === 'eligible', 'QAP-ELIG → Eligible (eligible list)', find(L, 'QAP-ELIG'));
  ok(find(L, 'QAP-PROB')?.status === 'PROBATION' && find(L, 'QAP-PROB')?.label === 'On Probation', 'QAP-PROB → On Probation', find(L, 'QAP-PROB'));
  ok(find(L, 'QAP-RPT')?.status === 'REPEAT' && find(L, 'QAP-RPT')?.list === 'failed', 'QAP-RPT → Repeat semester (9/11 CH passed)', find(L, 'QAP-RPT'));
  ok(find(L, 'QAP-DROP')?.status === 'DROPPED' && find(L, 'QAP-DROP')?.list === 'dropped', 'QAP-DROP → Dropped (GPA < 1.50)', find(L, 'QAP-DROP'));
  ok(find(L, 'QAP-RPT')?.failedCourses?.[0]?.code === 'EN-101', 'failed course listed (EN-101)', find(L, 'QAP-RPT')?.failedCourses);

  r = await call(fo, 'GET', `${F}/promotions?q=QAP-ELIG`);
  ok(Object.values(r.d.lists).flat().length === 1, 'search by roll no. filters to one row', r.d.stats);
  r = await call(fo, 'GET', `${F}/promotions?program=NOPE`);
  ok(Object.values(r.d.lists).flat().length === 0, 'program filter applies');
  r = await call(fo, 'GET', `${F}/promotions?semester=1&department=${encodeURIComponent('Department of Computing')}`);
  ok(!!find(r.d, 'QAP-ELIG'), 'semester + department filter keeps in-scope rows');

  r = await call(f1, 'GET', `${F}/promotions`);
  ok(r.s === 200 && !Object.values(r.d.lists).flat().some((x) => x.roll.startsWith('QAP-')), 'focal1 (no department) sees none of these students');
  r = await call(f1, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-ELIG']] });
  ok(r.s === 403, 'out-of-department focal cannot promote (403)', r);
  r = await call(pv, 'GET', `${F}/promotions`);
  ok(r.s === 200, 'Provost can view promotions (read-only)');
  r = await call(pv, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-ELIG']] });
  ok(r.s === 403, 'Provost cannot apply promotions (403)');
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [] });
  ok(r.s === 400, 'empty selection rejected (400)');

  console.log('\nRepeat decision (recorded once)');
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-RPT']] });
  ok(r.s === 200 && r.d.applied === 1, 'QAP-RPT decision applied', r.d);
  let st = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-RPT'] } });
  ok(st?.currentSemester === 1 && st?.status === 'ACTIVE', 'QAP-RPT stays in semester 1 (repeat)', st);
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-RPT']] });
  ok(r.d.applied === 0 && r.d.results[0].skipped === 'already_decided', 'repeat decision not applied twice', r.d);
  r = await call(fo, 'GET', `${F}/promotions?q=QAP-RPT`);
  ok(find(r.d, 'QAP-RPT')?.decided === true, 'row flagged as decided');

  console.log('\nS11 professional-subject exception (configurable)');
  r = await call(fo, 'PUT', `${F}/promotion-settings`, { professionalException: true, professionalCourseCodes: ['en-101'] });
  ok(r.s === 200 && r.d.settings.professionalException === true && r.d.settings.professionalCourseCodes[0] === 'EN-101', 'settings saved (codes normalised)', r.d);
  r = await call(pv, 'PUT', `${F}/promotion-settings`, { professionalException: false });
  ok(r.s === 403, 'Provost cannot change settings (403)');
  r = await call(fo, 'GET', `${F}/promotions?q=QAP-FAIL`);
  const failRow = find(r.d, 'QAP-FAIL');
  ok(failRow?.status === 'FAILED_COURSES' && failRow?.label === 'Failed courses' && failRow?.list === 'failed', 'QAP-FAIL → Failed courses with exception ON', failRow);

  console.log('\nSingle promotion + auto-enrolment');
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-ELIG']] });
  ok(r.s === 200 && r.d.applied === 1 && r.d.results[0].toSemester === 2, 'QAP-ELIG promoted to semester 2', r.d);
  const sem2 = await prisma.lmsSemester.findFirst({ where: { programId: 1, number: 2 }, include: { courses: true } });
  const regs = await prisma.courseRegistration.findMany({ where: { studentId: ids['QAP-ELIG'], status: 'ENROLLED', offering: { courseId: { in: sem2.courses.map((c) => c.id) } } } });
  ok(regs.length === sem2.courses.length, `auto-enrolled into all ${sem2.courses.length} semester-2 courses`, regs.length);
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-ELIG']] });
  ok(r.d.applied === 0, 'promotion is idempotent', r.d);
  const regs2 = await prisma.courseRegistration.count({ where: { studentId: ids['QAP-ELIG'] } });
  ok(regs2 === 4 + sem2.courses.length, 'no duplicate registrations', regs2);

  console.log('\nBulk promotion');
  r = await call(fo, 'POST', `${F}/promotions/apply`, { studentIds: [ids['QAP-PROB'], ids['QAP-FAIL'], ids['QAP-DROP']] });
  ok(r.s === 200 && r.d.applied === 3, 'bulk apply (3 students)', r.d);
  st = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-PROB'] } });
  ok(st?.currentSemester === 2 && st?.probations === 1, 'probation student promoted with probation count 1', st);
  st = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-DROP'] } });
  ok(st?.status === 'DROPPED', 'dropped student recorded as DROPPED', st);
  const dropRegs = await prisma.courseRegistration.count({ where: { studentId: ids['QAP-DROP'], offering: { courseId: { in: sem2.courses.map((c) => c.id) } } } });
  ok(dropRegs === 0, 'dropped student not enrolled in semester 2');
  st = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-FAIL'] } });
  ok(st?.currentSemester === 2, 'failed-courses student promoted to semester 2', st);

  console.log('\nSpecial Exam');
  r = await call(fo, 'GET', `${F}/special-exams`);
  const cand = r.d.items.find((x) => x.studentId === ids['QAP-FAIL']);
  ok(r.s === 200 && cand?.course?.code === 'EN-101' && cand?.status === 'MARKED', 'failed course marked for Special Exam', cand);
  r = await call(fo, 'GET', `${F}/promotions?q=QAP-DROP`);
  ok(find(r.d, 'QAP-DROP')?.list === 'dropped' && find(r.d, 'QAP-DROP')?.decided, 'dropped student stays in dropped list');
  r = await call(fo, 'POST', `${F}/special-exams/${cand.id}/enroll`);
  ok(r.s === 200 && r.d.candidate.status === 'ENROLLED', 'enrol for Special Exam', r.d);
  const retake = await prisma.courseRegistration.findFirst({ where: { studentId: ids['QAP-FAIL'], offeringId: r.d.candidate.examOfferingId } });
  ok(!!retake && retake.status === 'ENROLLED', 'student registered on the course offering for the Special Exam');
  r = await call(fo, 'POST', `${F}/special-exams/${cand.id}/enroll`);
  ok(r.s === 409, 'second enrol rejected (409)');

  console.log('\nHistory + notifications');
  r = await call(fo, 'GET', `${F}/promotions/history`);
  const mine = r.d.items.filter((x) => Object.values(ids).includes(x.studentId));
  ok(r.s === 200 && mine.length === 5, 'history has one record per decision (5)', mine.length);
  ok(mine.find((x) => x.studentId === ids['QAP-FAIL'])?.failedCourses?.[0]?.code === 'EN-101', 'history keeps failed courses');
  const notes = await prisma.lmsNotification.findMany({ where: { userId: { in: Object.values(ids) }, title: 'Semester promotion' } });
  ok(notes.length === 5, 'each student notified', notes.length);
  ok(notes.some((n) => /promoted to semester 2/.test(n.message)), 'promotion notice text');
  ok(notes.some((n) => /repeat semester 1/.test(n.message)), 'repeat notice text');

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
