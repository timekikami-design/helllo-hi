// ============================================================
//  CURRENT SEMESTER (read-only helper)
//  ------------------------------------------------------------
//  One answer to "which semester is this student in right now?",
//  read from the database every time (no caching):
//    1. LmsStudentStanding.currentSemester — written by the existing
//       promotion flow (promotionService.applyDecision);
//    2. otherwise the semester of the courses the student is ENROLLED in
//       for the current academic term;
//    3. otherwise Semester 1 (new student).
//  The term shown next to it is the current AcademicTerm.
//  Used by the Exam Controller gazette (grouping) and the student
//  dashboard / settings. Nothing is written here.
// ============================================================
const prisma = require('../utils/prisma');

function ordinal(n) {
  const v = Number(n) || 0;
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}
const semesterLabel = (n) => `${ordinal(n)} Semester`;

/** studentId → { number, label, term, display, status } */
async function currentSemesterMap(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  const out = {};
  if (!ids.length) return out;
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true, isActive: true } });
  const [standings, regs] = await Promise.all([
    prisma.lmsStudentStanding.findMany({ where: { studentId: { in: ids } } }),
    term ? prisma.courseRegistration.findMany({
      where: { studentId: { in: ids }, status: 'ENROLLED', offering: { termId: term.id, isDeleted: false } },
      select: { studentId: true, offering: { select: { course: { select: { semester: { select: { number: true } } } } } } },
    }) : [],
  ]);
  const standingBy = new Map(standings.map((s) => [s.studentId, s]));
  const enrolledSem = {};
  for (const r of regs) {
    const n = r.offering?.course?.semester?.number;
    if (n) enrolledSem[r.studentId] = Math.max(enrolledSem[r.studentId] || 0, n);
  }
  for (const id of ids) {
    const st = standingBy.get(id);
    const number = (st && st.currentSemester) || enrolledSem[id] || 1;
    const label = semesterLabel(number);
    out[id] = {
      number,
      label,
      term: term?.title || null,
      display: term?.title ? `${label} (${term.title})` : label,
      status: st?.status || 'ACTIVE',
      source: st ? 'standing' : enrolledSem[id] ? 'enrollment' : 'default',
    };
  }
  return out;
}

async function currentSemesterOf(studentId) {
  return (await currentSemesterMap([studentId]))[studentId];
}

module.exports = { currentSemesterMap, currentSemesterOf, ordinal, semesterLabel };
