// ============================================================
//  COURSE STATUS SERVICE (Changes 9 & 10)
//  ------------------------------------------------------------
//  ONE place that answers "has this student passed / failed this
//  course?" for every LMS screen. It does NOT change how pass/fail is
//  decided — it reuses the existing rule (lmsPromotionRules: percent ≥
//  PASS_PERCENT on a DECLARED result, i.e. workflowStage UNOFFICIAL /
//  OFFICIAL — the same results the student Study Scheme already used).
//
//  Rules applied consistently everywhere:
//   • PASSED  — any declared attempt of the course meets the pass rule.
//   • FAILED  — the course has declared attempt(s) and none passed. It
//               stays FAILED even when the course is carried into a later
//               semester / re-registered, until a later attempt passes.
//   • Enrollment: COMPLETED (passed) · CURRENTLY_ENROLLED (registered in
//     the current term, not yet passed) · UPCOMING (everything else).
//  Status is keyed by course code so a retake in another offering counts.
// ============================================================
const prisma = require('../utils/prisma');
const { PASS_PERCENT } = require('../utils/lmsGrading');

const DECLARED = ['UNOFFICIAL', 'OFFICIAL'];
const isPass = (r) => Number(r.totalPercent) >= PASS_PERCENT;

/**
 * Status map for many students at once.
 * @returns {Promise<Map<string, Map<string, {result:'PASS'|'FAIL', grade, percent, attempts, carried:boolean}>>>}
 *          studentId → courseCode → status
 */
async function resultStatusFor(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  const rows = await prisma.courseResult.findMany({
    where: { studentId: { in: ids }, workflowStage: { in: DECLARED } },
    select: { studentId: true, totalPercent: true, letterGrade: true, updatedAt: true, offering: { select: { course: { select: { code: true } } } } },
    orderBy: { updatedAt: 'asc' },
  });
  for (const r of rows) {
    const code = r.offering && r.offering.course && r.offering.course.code;
    if (!code) continue;
    if (!out.has(r.studentId)) out.set(r.studentId, new Map());
    const m = out.get(r.studentId);
    const prev = m.get(code);
    const pass = isPass(r);
    const entry = { result: pass ? 'PASS' : 'FAIL', grade: r.letterGrade, percent: r.totalPercent };
    if (!prev) { m.set(code, { ...entry, attempts: 1 }); continue; }
    prev.attempts += 1;
    // A pass is final; otherwise the latest declared attempt is shown.
    if (prev.result !== 'PASS') Object.assign(prev, entry);
  }
  return out;
}

/** Status map for one student: courseCode → status. */
async function resultStatusForStudent(studentId) {
  return (await resultStatusFor([studentId])).get(studentId) || new Map();
}

/**
 * Enrollment status for one student's courses (Change 10).
 * @returns {(code:string) => {enrollment:'COMPLETED'|'CURRENTLY_ENROLLED'|'UPCOMING', result:'PASS'|'FAIL'|null, grade, carried:boolean}}
 */
async function studentCourseStatusResolver(studentId) {
  const results = await resultStatusForStudent(studentId);
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true, isActive: true } });
  const regs = await prisma.courseRegistration.findMany({
    where: { studentId, status: { in: ['ENROLLED', 'COMPLETED'] } },
    select: { status: true, offering: { select: { termId: true, course: { select: { code: true } } } } },
  });
  const completedReg = new Set(regs.filter((r) => r.status === 'COMPLETED').map((r) => r.offering.course.code));
  const current = new Set(regs.filter((r) => r.status === 'ENROLLED' && (!term || r.offering.termId === term.id)).map((r) => r.offering.course.code));
  return (code) => {
    const res = results.get(code) || null;
    const passed = res && res.result === 'PASS';
    let enrollment;
    if (passed) enrollment = 'COMPLETED';
    else if (current.has(code)) enrollment = 'CURRENTLY_ENROLLED';
    else if (!res && completedReg.has(code)) enrollment = 'COMPLETED';
    else enrollment = 'UPCOMING';
    return {
      enrollment,
      result: res ? res.result : null,
      grade: res ? res.grade : null,
      percent: res ? res.percent : null,
      // Failed earlier and now carried / re-registered: still FAILED.
      carried: !!(res && res.result === 'FAIL' && current.has(code)),
    };
  };
}

/** Decorate rows having { studentId, courseCode|code } with resultStatus (non-destructive). */
async function decorateRows(rows, { studentKey = 'studentId', codeKey = 'courseCode' } = {}) {
  const map = await resultStatusFor(rows.map((r) => r[studentKey]));
  return rows.map((r) => {
    const st = (map.get(r[studentKey]) || new Map()).get(r[codeKey] || r.code);
    return { ...r, courseStatus: st ? st.result : null };
  });
}

/**
 * Change 9 — real-time propagation. After results are declared (Pass/Fail
 * changes), tell every relevant viewer: the students, the teachers of the
 * offerings, department coordinators / focal persons, and exam controller /
 * provost / QEC accounts (who can already see this data).
 */
async function broadcastStatusChange({ studentIds = [], offeringIds = [] } = {}) {
  try {
    const realtime = require('../utils/lmsRealtime');
    const payload = { action: 'course-status', offeringIds };
    const offs = offeringIds.length ? await prisma.courseOffering.findMany({ where: { id: { in: offeringIds } }, select: { teacherId: true } }) : [];
    const teachers = offs.map((o) => o.teacherId).filter(Boolean);
    const depts = [...new Set((await prisma.lmsStudentProfile.findMany({ where: { lmsUserId: { in: studentIds } }, select: { department: true } })).map((p) => p.department).filter(Boolean))];
    const staff = depts.length ? (await prisma.lmsStudentProfile.findMany({ where: { department: { in: depts }, lmsUser: { role: { in: ['CourseCoordinator', 'FocalPerson'] } } }, select: { lmsUserId: true } })).map((p) => p.lmsUserId) : [];
    let coordIds = [];
    try {
      const dIds = (await prisma.department.findMany({ where: { name: { in: depts } }, select: { id: true } })).map((d) => d.id);
      if (dIds.length) coordIds = (await prisma.lmsDepartmentCoordinator.findMany({ where: { departmentId: { in: dIds } }, select: { lmsUserId: true } })).map((c) => c.lmsUserId);
    } catch (_) { /* read-only lookup */ }
    const gov = (await prisma.lmsUser.findMany({ where: { role: { in: ['ExamController', 'Provost', 'QECCoordinator'] }, isActive: true }, select: { id: true } })).map((u) => u.id);
    realtime.emitTo([...new Set([...studentIds, ...teachers, ...staff, ...coordIds, ...gov])], 'result', payload);
  } catch (e) { console.warn('[courseStatus] broadcast failed:', e.message); }
}

module.exports = { resultStatusFor, resultStatusForStudent, studentCourseStatusResolver, decorateRows, broadcastStatusChange, isPass, DECLARED };
