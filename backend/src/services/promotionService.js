// ============================================================
//  SEMESTER PROMOTION SERVICE (Sections 10 + 11)
// ------------------------------------------------------------
//  Builds the Focal Person promotion lists from DECLARED results
//  (workflow UNOFFICIAL / OFFICIAL — the same rule the student result
//  record uses) and applies the AUST rules in utils/lmsPromotionRules.
//  Promotion:
//    • advances LmsStudentStanding.currentSemester (LMS-only),
//    • auto-enrols the student into every course of the next semester
//      in the approved Scheme of Study (fallback: semester template)
//      that has an active offering in the current term,
//    • keeps failed courses visible as "Failed" and marks them in
//      LmsSpecialExamCandidate for the Special Exam,
//    • records history in LmsPromotionRecord + the audit log.
//  Nothing in the Admission System is read or written.
// ============================================================
const prisma = require('../utils/prisma');
const rules = require('../utils/lmsPromotionRules');
const { resolveSemesterCourseIds } = require('./autoEnrollService');

const SETTINGS_KEY = 'lms_promotion_settings';
const DECLARED = ['UNOFFICIAL', 'OFFICIAL'];

async function getSettings() {
  const row = await prisma.systemConfiguration.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  let v = {};
  try { v = row?.value ? JSON.parse(row.value) : {}; } catch (_) { v = {}; }
  return { ...rules.DEFAULT_SETTINGS, professionalCourseCodes: [], ...v };
}

async function saveSettings(input, actorId) {
  const cur = await getSettings();
  const next = {
    professionalException: input.professionalException != null ? !!input.professionalException : cur.professionalException,
    professionalCourseCodes: Array.isArray(input.professionalCourseCodes)
      ? [...new Set(input.professionalCourseCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))]
      : cur.professionalCourseCodes,
    minPassCreditsEarly: cur.minPassCreditsEarly,
    minPassCreditsLate: cur.minPassCreditsLate,
  };
  await prisma.systemConfiguration.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(next), description: 'LMS promotion settings (Focal Person)' },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next), description: 'LMS promotion settings (Focal Person)' },
  });
  void actorId;
  return next;
}

/**
 * Evaluate every in-scope student.
 * @param {{studentIds?:string[]|null}} scope  null/undefined = all students
 */
async function buildPromotionList({ studentIds = null } = {}) {
  const settings = await getSettings();
  const profCodes = new Set(settings.professionalCourseCodes || []);
  const studentWhere = { role: 'Student', ...(studentIds ? { id: { in: studentIds.length ? studentIds : ['__none__'] } } : {}) };
  const students = await prisma.lmsUser.findMany({
    where: studentWhere,
    select: { id: true, username: true, profile: { select: { fullName: true, rollNumber: true, programShortForm: true, program: true, department: true, session: true } } },
  });
  const ids = students.map((s) => s.id);
  const [results, standings, programs, specials] = await Promise.all([
    prisma.courseResult.findMany({
      where: { studentId: { in: ids }, workflowStage: { in: DECLARED } },
      include: { offering: { include: { course: { include: { semester: true, program: true } } } } },
    }),
    prisma.lmsStudentStanding.findMany({ where: { studentId: { in: ids } } }),
    prisma.lmsProgram.findMany({ where: { isDeleted: false } }),
    prisma.lmsSpecialExamCandidate.findMany({ where: { studentId: { in: ids } } }),
  ]);
  const standingBy = new Map(standings.map((s) => [s.studentId, s]));
  const progBy = new Map(programs.map((p) => [p.shortForm || p.code, p]));
  const byStudent = new Map();
  for (const r of results) {
    const semNo = r.offering?.course?.semester?.number;
    if (!semNo) continue;
    if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, new Map());
    const sems = byStudent.get(r.studentId);
    if (!sems.has(semNo)) sems.set(semNo, []);
    sems.get(semNo).push({
      courseId: r.offering.course.id, offeringId: r.offeringId, code: r.offering.course.code, title: r.offering.course.title,
      creditHours: r.offering.course.creditHours, percent: r.totalPercent, gradePoints: r.gradePoints, letterGrade: r.letterGrade,
      isProfessional: profCodes.has(String(r.offering.course.code).toUpperCase()),
    });
  }

  const rows = [];
  for (const s of students) {
    const p = s.profile || {};
    const program = progBy.get(p.programShortForm) || null;
    const maxSemesters = program?.totalSemesters || 8;
    const standing = standingBy.get(s.id) || null;
    const semMap = byStudent.get(s.id) || new Map();
    const semesters = [...semMap.entries()].sort((a, b) => a[0] - b[0]).map(([semester, courses]) => ({ semester, courses }));
    const current = standing?.currentSemester || 1;
    const base = {
      studentId: s.id, roll: p.rollNumber || s.username, name: p.fullName || s.username,
      program: p.programShortForm || null, department: p.department || program?.department || null,
      session: p.session || null, semester: current, maxSemesters,
      standingStatus: standing?.status || 'ACTIVE',
    };
    if (standing && standing.status !== 'ACTIVE') {
      rows.push({ ...base, status: standing.status === 'COMPLETED' ? 'ELIGIBLE' : standing.status, label: standing.status === 'COMPLETED' ? 'Completed' : rules.LABELS[standing.status] || standing.status, list: standing.status === 'COMPLETED' ? 'eligible' : 'dropped', decided: true, gpa: null, cgpa: null, failedCourses: [], reasons: [`Recorded as ${standing.status.toLowerCase()}`] });
      continue;
    }
    const thisSem = semesters.find((x) => x.semester === current);
    // Every scheme course of the current semester must have a declared result.
    let expected = 0;
    if (program) {
      const { courseIds } = await resolveSemesterCourseIds(program.id, current, await prisma.lmsSemester.findFirst({ where: { programId: program.id, number: current, isDeleted: false }, include: { courses: { where: { isDeleted: false } } } }));
      expected = courseIds.length;
    }
    if (!thisSem || (expected && thisSem.courses.length < expected)) {
      rows.push({ ...base, status: 'PENDING', label: 'Results pending', list: 'pending', declared: thisSem ? thisSem.courses.length : 0, expected, gpa: null, cgpa: null, failedCourses: [], reasons: ['Semester results are not fully declared yet'] });
      continue;
    }
    const ev = rules.evaluate({ semester: current, semesters, priorProbations: standing?.probations || 0, maxSemesters, settings });
    const sp = specials.filter((x) => x.studentId === s.id);
    rows.push({
      ...base, ...ev, list: rules.listOf(ev.status), promotable: rules.PROMOTABLE.includes(ev.status),
      failedCourses: ev.failedCourses.map((f) => ({ ...f, specialExam: sp.find((x) => x.courseId === f.courseId)?.status || null })),
      specialExams: sp.map((x) => ({ courseId: x.courseId, semester: x.semester, status: x.status })),
    });
  }
  return { rows, settings };
}

/** Next-semester course ids from the Scheme of Study, and their current-term offerings. */
async function nextSemesterOfferings(programShortForm, semesterNumber) {
  const program = await prisma.lmsProgram.findFirst({ where: { isDeleted: false, OR: [{ shortForm: programShortForm || '__' }, { code: programShortForm || '__' }] } });
  if (!program) return { offerings: [], courseIds: [], source: 'none' };
  const tmpl = await prisma.lmsSemester.findFirst({ where: { programId: program.id, number: semesterNumber, isDeleted: false }, include: { courses: { where: { isDeleted: false } } } });
  const { courseIds, source } = await resolveSemesterCourseIds(program.id, semesterNumber, tmpl);
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true, isActive: true } });
  const offerings = courseIds.length && term ? await prisma.courseOffering.findMany({
    where: { termId: term.id, isDeleted: false, status: 'ACTIVE', courseId: { in: courseIds } },
    include: { course: { select: { code: true, title: true } } },
  }) : [];
  return { offerings, courseIds, source, program };
}

/**
 * Apply the decision for one evaluated row. Idempotent per semester:
 * a student already moved past `row.semester` is skipped.
 */
async function applyDecision(row, actorId) {
  const standing = await prisma.lmsStudentStanding.findUnique({ where: { studentId: row.studentId } });
  if (standing && (standing.status !== 'ACTIVE' || standing.currentSemester !== row.semester)) {
    return { studentId: row.studentId, skipped: 'already_decided' };
  }
  let enrolled = 0; const missingOfferings = [];
  let toSemester = row.nextSemester ?? null;
  let status = 'ACTIVE';
  if (row.status === 'DROPPED') { status = 'DROPPED'; toSemester = null; }
  if (row.status === 'REMOVED') { status = 'REMOVED'; toSemester = null; }
  if (rules.PROMOTABLE.includes(row.status) && toSemester == null) status = 'COMPLETED';

  // Auto-enrol into every next-semester scheme course (promotion only).
  if (rules.PROMOTABLE.includes(row.status) && toSemester) {
    const { offerings, courseIds } = await nextSemesterOfferings(row.program, toSemester);
    const have = new Set(offerings.map((o) => o.courseId));
    for (const cid of courseIds) if (!have.has(cid)) missingOfferings.push(cid);
    for (const off of offerings) {
      const existing = await prisma.courseRegistration.findUnique({ where: { offeringId_studentId: { offeringId: off.id, studentId: row.studentId } } });
      if (existing) {
        if (existing.status !== 'ENROLLED') { await prisma.courseRegistration.update({ where: { id: existing.id }, data: { status: 'ENROLLED', withdrawnAt: null } }); enrolled += 1; }
        continue;
      }
      await prisma.courseRegistration.create({ data: { offeringId: off.id, studentId: row.studentId, registrationType: 'REGULAR', status: 'ENROLLED' } });
      enrolled += 1;
    }
  }
  // Failed courses → Special Exam candidates (kept visible as Failed).
  for (const f of row.failedCourses || []) {
    await prisma.lmsSpecialExamCandidate.upsert({
      where: { studentId_courseId_semester: { studentId: row.studentId, courseId: f.courseId, semester: row.semester } },
      update: {},
      create: { studentId: row.studentId, courseId: f.courseId, offeringId: f.offeringId || null, semester: row.semester, percent: Number(f.percent) || 0, markedById: actorId },
    });
  }
  const data = {
    currentSemester: toSemester || row.semester, status,
    probations: row.probations ?? (standing?.probations || 0),
    noReadmission: !!row.noReadmission, updatedById: actorId,
  };
  await prisma.lmsStudentStanding.upsert({ where: { studentId: row.studentId }, update: data, create: { studentId: row.studentId, ...data } });
  const rec = await prisma.lmsPromotionRecord.create({
    data: {
      studentId: row.studentId, fromSemester: row.semester, toSemester: status === 'ACTIVE' ? (toSemester || row.semester) : null,
      outcome: row.status, gpa: row.gpa || 0, cgpa: row.cgpa || 0, passedCh: Math.round(row.passedCh || 0),
      failedCourses: JSON.stringify((row.failedCourses || []).map((f) => ({ courseId: f.courseId, code: f.code, title: f.title, percent: f.percent }))),
      enrolled, decidedById: actorId,
    },
  });
  return { studentId: row.studentId, outcome: row.status, toSemester: data.currentSemester, status, enrolled, missingOfferings: missingOfferings.length, recordId: rec.id };
}

module.exports = { buildPromotionList, applyDecision, getSettings, saveSettings, nextSemesterOfferings, SETTINGS_KEY };
