// ============================================================
//  RESULTS SERVICE — Exam Controller workflow, student visibility,
//  gazette and transcripts (Part A: A9, A10, A11, A12).
//  ------------------------------------------------------------
//  Hierarchy used everywhere: Department → Program → Semester → Subject.
//  Batch = admission session stored on LmsStudentProfile.session (fixed at
//  admission, never changes). Current Session = the current AcademicTerm.
//
//  Semester keying: a student's "semester" for a result is the course's
//  scheme semester number (LmsCourse.semester.number) — the same key the
//  whole LMS uses for Semester-wise structure.
// ============================================================
const prisma = require('../utils/prisma');
const { computeGPA, levelFromProgram, probationStatus, round2 } = require('../utils/lmsGrading');

// Which workflow stages each Exam Controller stage shows.
const STAGE_SETS = {
  compilation: ['SUBMITTED', 'UNOFFICIAL', 'OFFICIAL'], // everything the teachers submitted
  collection: ['SUBMITTED'],                           // awaiting unofficial declaration
  finalizing: ['UNOFFICIAL'],                          // awaiting official declaration
  archive: ['OFFICIAL'],                               // read-only forever
};

async function currentTerm() {
  return prisma.academicTerm.findFirst({ where: { isCurrent: true, isActive: true } });
}

const resultInclude = {
  offering: { include: { course: { include: { program: true, semester: true } }, term: true, teacher: { include: { profile: true } } } },
  student: { include: { profile: true } },
};

function shapeResult(r) {
  const c = r.offering?.course;
  const prof = r.student?.profile || {};
  return {
    id: r.id,
    studentId: r.studentId,
    student: prof.fullName || r.student?.username || r.studentId,
    fatherName: prof.fatherName || null,
    rollNumber: r.student?.linkedRollNumber || prof.rollNumber || r.student?.username,
    registrationNumber: prof.registrationNumber || null,
    batch: prof.session || null,
    offeringId: r.offeringId,
    courseId: c?.id,
    courseCode: c?.code || '—',
    courseTitle: c?.title || '—',
    creditHours: c?.creditHours || 0,
    department: c?.program?.department || prof.department || '—',
    program: c?.program?.shortForm || c?.program?.code || prof.programShortForm || '—',
    programName: c?.program?.name || prof.program || '—',
    semester: c?.semester?.number || null,
    term: r.offering?.term?.title || null,
    teacher: r.offering?.teacher?.profile?.fullName || r.offering?.teacher?.username || null,
    assignmentMarks: r.assignmentMarks, quizMarks: r.quizMarks, labMarks: r.labMarks, projectMarks: r.projectMarks,
    midMarks: r.midMarks, midMax: r.midMax, finalMarks: r.finalMarks, finalMax: r.finalMax,
    totalPercent: r.totalPercent,
    letterGrade: r.letterGrade,
    gradePoints: r.gradePoints,
    workflowStage: r.workflowStage || 'DRAFT',
    submittedAt: r.submittedAt, unofficialAt: r.unofficialAt, officialAt: r.officialAt,
  };
}

/** Fetch results in the given stages (optionally scoped). */
async function fetchResults(stages, scope = {}) {
  const where = { workflowStage: { in: stages } };
  const rows = await prisma.courseResult.findMany({ where, include: resultInclude, orderBy: { id: 'asc' } });
  let out = rows.map(shapeResult);
  if (scope.department) out = out.filter((r) => r.department === scope.department);
  if (scope.program) out = out.filter((r) => r.program === scope.program);
  if (scope.semester) out = out.filter((r) => String(r.semester) === String(scope.semester));
  if (scope.offeringId) out = out.filter((r) => String(r.offeringId) === String(scope.offeringId));
  return out;
}

/** Department → Program → Semester → Subject tree with counts. */
function buildTree(rows) {
  const depts = {};
  for (const r of rows) {
    const d = (depts[r.department] ||= { name: r.department, programs: {}, results: 0 });
    const p = (d.programs[r.program] ||= { code: r.program, name: r.programName, semesters: {}, results: 0 });
    const s = (p.semesters[r.semester || 0] ||= { number: r.semester, subjects: {}, results: 0 });
    const sub = (s.subjects[r.offeringId] ||= { offeringId: r.offeringId, courseCode: r.courseCode, courseTitle: r.courseTitle, creditHours: r.creditHours, teacher: r.teacher, term: r.term, students: 0, stages: {} });
    sub.students += 1;
    sub.stages[r.workflowStage] = (sub.stages[r.workflowStage] || 0) + 1;
    d.results += 1; p.results += 1; s.results += 1;
  }
  return Object.values(depts).sort((a, b) => a.name.localeCompare(b.name)).map((d) => ({
    ...d,
    programs: Object.values(d.programs).sort((a, b) => a.code.localeCompare(b.code)).map((p) => ({
      ...p,
      semesters: Object.values(p.semesters).sort((a, b) => (a.number || 0) - (b.number || 0)).map((s) => ({
        ...s, subjects: Object.values(s.subjects).sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
      })),
    })),
  }));
}

/**
 * Semester GPA + running CGPA for a set of students, computed from results in
 * `stages` (A12 formulas). Returns { [studentId]: { [semester]: {gpa, cgpa, credits} } }.
 */
async function gpaIndex(studentIds, stages) {
  const rows = await prisma.courseResult.findMany({
    where: { studentId: { in: studentIds }, workflowStage: { in: stages } },
    include: { offering: { include: { course: { include: { semester: true, program: true } } } } },
  });
  const by = {};
  for (const r of rows) {
    const sem = r.offering?.course?.semester?.number || 0;
    ((by[r.studentId] ||= {})[sem] ||= []).push({ gradePoints: r.gradePoints, creditHours: r.offering?.course?.creditHours || 0, letterGrade: r.letterGrade });
  }
  const out = {};
  for (const [sid, sems] of Object.entries(by)) {
    out[sid] = {};
    const acc = [];
    for (const sem of Object.keys(sems).map(Number).sort((a, b) => a - b)) {
      acc.push(...sems[sem]);
      out[sid][sem] = {
        gpa: computeGPA(sems[sem]),
        cgpa: computeGPA(acc),
        credits: sems[sem].reduce((s, x) => s + x.creditHours, 0),
        cumulativeCredits: acc.reduce((s, x) => s + x.creditHours, 0),
      };
    }
  }
  return out;
}

/** Subject-level listing for a stage: every student with marks, GP, GPA. */
async function subjectSheet(stage, offeringId) {
  const rows = await fetchResults(STAGE_SETS[stage], { offeringId });
  const gpaStages = stage === 'compilation' ? STAGE_SETS.compilation : STAGE_SETS[stage].concat(stage === 'finalizing' ? ['OFFICIAL'] : stage === 'collection' ? ['UNOFFICIAL', 'OFFICIAL'] : []);
  const idx = await gpaIndex(rows.map((r) => r.studentId), gpaStages);
  return rows
    .map((r) => ({ ...r, semesterGpa: idx[r.studentId]?.[r.semester || 0]?.gpa ?? null, cgpa: idx[r.studentId]?.[r.semester || 0]?.cgpa ?? null }))
    .sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber)));
}

/**
 * Per-student semester summary for a scope (Collection / Finalizing view):
 * one row per student with each subject + GPA + CGPA.
 */
async function scopeStudents(stage, scope) {
  const rows = await fetchResults(STAGE_SETS[stage], scope);
  const idx = await gpaIndex([...new Set(rows.map((r) => r.studentId))], STAGE_SETS.compilation);
  const students = {};
  for (const r of rows) {
    const s = (students[r.studentId] ||= { studentId: r.studentId, student: r.student, rollNumber: r.rollNumber, registrationNumber: r.registrationNumber, batch: r.batch, semester: r.semester, subjects: [] });
    s.subjects.push({ courseCode: r.courseCode, courseTitle: r.courseTitle, creditHours: r.creditHours, totalPercent: r.totalPercent, letterGrade: r.letterGrade, gradePoints: r.gradePoints, workflowStage: r.workflowStage });
  }
  return Object.values(students).map((s) => ({
    ...s,
    gpa: computeGPA(s.subjects),
    cgpa: idx[s.studentId]?.[s.semester || 0]?.cgpa ?? computeGPA(s.subjects),
  })).sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber)));
}

/**
 * Declare a stage transition for a Department/Program/Semester scope.
 *   collection → UNOFFICIAL, finalizing → OFFICIAL.
 */
async function declare(kind, scope, actorId) {
  const from = kind === 'unofficial' ? 'SUBMITTED' : 'UNOFFICIAL';
  if (kind === 'unofficial') {
    // Never half-declare a semester: every subject in the scope (current
    // term, with enrolled students) must have been submitted by its teacher.
    const term = await currentTerm();
    const offerings = await prisma.courseOffering.findMany({
      where: { isDeleted: false, ...(term ? { termId: term.id } : {}), registrations: { some: {} } },
      include: { course: { include: { program: true, semester: true } } },
    });
    const pending = offerings.filter((o) => (o.course?.program?.department || '—') === scope.department
      && (o.course?.program?.shortForm || o.course?.program?.code) === scope.program
      && String(o.course?.semester?.number || '') === String(scope.semester)
      && !o.resultSubmittedAt);
    if (pending.length) {
      const e = new Error(`Waiting for teacher submission: ${pending.map((o) => o.course.code).join(', ')}. All subjects of the semester must be submitted before declaring.`);
      e.status = 409; e.expose = true; e.pending = pending.map((o) => o.course.code); throw e;
    }
  }
  const to = kind === 'unofficial' ? 'UNOFFICIAL' : 'OFFICIAL';
  const rows = await fetchResults([from], scope);
  if (!rows.length) {
    const e = new Error(`No results are waiting for ${kind === 'unofficial' ? 'unofficial' : 'official'} declaration in this scope.`);
    e.status = 409; e.expose = true; throw e;
  }
  const now = new Date();
  const ids = rows.map((r) => r.id);
  await prisma.courseResult.updateMany({
    where: { id: { in: ids }, workflowStage: from },
    data: kind === 'unofficial'
      ? { workflowStage: to, unofficialAt: now, status: 'PUBLISHED', publishedAt: now }
      : { workflowStage: to, officialAt: now, status: 'PUBLISHED' },
  });
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  void actorId;
  return { declared: ids.length, studentIds, offeringIds: [...new Set(rows.map((r) => r.offeringId))] };
}

// ============================================================
// STUDENT VIEW (A10) — all subjects across all semesters. GPA / CGPA /
// transcript only for semesters whose results were declared (per-semester
// gating: a semester is "declared" when ALL its results are UNOFFICIAL+).
// ============================================================
async function studentRecord(studentId) {
  const [profile, regs, results] = await Promise.all([
    prisma.lmsStudentProfile.findUnique({ where: { lmsUserId: studentId } }),
    prisma.courseRegistration.findMany({
      where: { studentId, status: { in: ['ENROLLED', 'COMPLETED'] } },
      include: { offering: { include: { course: { include: { semester: true, program: true } }, term: true } } },
    }),
    prisma.courseResult.findMany({ where: { studentId }, include: { offering: { include: { course: { include: { semester: true, program: true } }, term: true } } } }),
  ]);
  const level = levelFromProgram(profile?.program || profile?.programShortForm);
  const resultByOffering = Object.fromEntries(results.map((r) => [r.offeringId, r]));
  const offerings = new Map();
  for (const reg of regs) if (reg.offering && !reg.offering.isDeleted) offerings.set(reg.offeringId, reg.offering);
  for (const r of results) if (r.offering && !offerings.has(r.offeringId)) offerings.set(r.offeringId, r.offering);

  const sems = {};
  for (const off of offerings.values()) {
    const semNo = off.course?.semester?.number || 0;
    const r = resultByOffering[off.id];
    const stage = r ? r.workflowStage || 'DRAFT' : 'DRAFT';
    (sems[semNo] ||= { semester: semNo, term: off.term?.title || null, subjects: [] }).subjects.push({
      offeringId: off.id,
      courseCode: off.course.code,
      courseTitle: off.course.title,
      creditHours: off.course.creditHours,
      hasLab: !!off.course.hasLab,
      midMarks: r ? r.midMarks : null, midTotalMarks: off.midTotalMarks,
      finalMarks: r ? r.finalMarks : null, finalTotalMarks: off.finalTotalMarks,
      stage,
      totalPercent: r ? r.totalPercent : null,
      letterGrade: r ? r.letterGrade : null,
      gradePoints: r ? r.gradePoints : null,
    });
  }
  const ordered = Object.values(sems).sort((a, b) => a.semester - b.semester);
  const cumulative = [];
  let probations = 0;
  const out = ordered.map((s) => {
    const declared = s.subjects.length > 0 && s.subjects.every((x) => ['UNOFFICIAL', 'OFFICIAL'].includes(x.stage));
    const official = declared && s.subjects.every((x) => x.stage === 'OFFICIAL');
    const subjects = s.subjects.map((x) => (declared ? x : { ...x, totalPercent: null, letterGrade: null, gradePoints: null }));
    let gpa = null; let cgpa = null; let probation = null;
    if (declared) {
      cumulative.push(...s.subjects);
      gpa = computeGPA(s.subjects);
      cgpa = computeGPA(cumulative);
      probation = probationStatus(gpa, level, probations);
      if (probation.onProbation) probations += 1;
    }
    return {
      semester: s.semester,
      term: s.term,
      declared,
      official,
      status: official ? 'OFFICIAL' : declared ? 'UNOFFICIAL' : 'IN_PROGRESS',
      credits: s.subjects.reduce((a, x) => a + (x.creditHours || 0), 0),
      gpa, cgpa, probation,
      subjects,
    };
  });
  const declaredSems = out.filter((s) => s.declared);
  return {
    profile: profile ? {
      fullName: profile.fullName, fatherName: profile.fatherName, rollNumber: profile.rollNumber,
      registrationNumber: profile.registrationNumber, program: profile.program, programShortForm: profile.programShortForm,
      department: profile.department, batch: profile.session, cnic: profile.cnic, dateOfBirth: profile.dateOfBirth,
    } : null,
    level,
    currentSession: (await currentTerm())?.title || null,
    semesters: out,
    cgpa: declaredSems.length ? declaredSems[declaredSems.length - 1].cgpa : null,
    creditsEarned: declaredSems.reduce((a, s) => a + s.credits, 0),
  };
}

// ============================================================
// GAZETTE (A11) — by Batch (admission session). Built progressively from
// every result that has reached the Exam Controller (SUBMITTED → OFFICIAL).
// ============================================================
async function gazetteBatches() {
  const rows = await prisma.courseResult.findMany({
    where: { workflowStage: { in: STAGE_SETS.compilation } },
    select: { studentId: true, workflowStage: true, student: { select: { profile: { select: { session: true, programShortForm: true, department: true } } } } },
  });
  const map = {};
  for (const r of rows) {
    const batch = r.student?.profile?.session || 'Unassigned';
    const b = (map[batch] ||= { batch, students: new Set(), programs: new Set(), stages: {} });
    b.students.add(r.studentId);
    if (r.student?.profile?.programShortForm) b.programs.add(r.student.profile.programShortForm);
    b.stages[r.workflowStage] = (b.stages[r.workflowStage] || 0) + 1;
  }
  const term = await currentTerm();
  return Object.values(map).map((b) => ({ batch: b.batch, currentSession: term?.title || null, students: b.students.size, programs: [...b.programs], stages: b.stages }))
    .sort((a, b) => a.batch.localeCompare(b.batch));
}

async function gazette(batch, { program } = {}) {
  const rows = await prisma.courseResult.findMany({
    where: { workflowStage: { in: STAGE_SETS.compilation }, student: { profile: { is: { session: batch } } } },
    include: resultInclude,
  });
  let shaped = rows.map(shapeResult);
  if (program) shaped = shaped.filter((r) => r.program === program);
  const idx = await gpaIndex([...new Set(shaped.map((r) => r.studentId))], STAGE_SETS.compilation);
  const students = {};
  for (const r of shaped) {
    const s = (students[r.studentId] ||= { studentId: r.studentId, student: r.student, fatherName: r.fatherName, rollNumber: r.rollNumber, registrationNumber: r.registrationNumber, program: r.program, department: r.department, semesters: {} });
    (s.semesters[r.semester || 0] ||= { semester: r.semester, term: r.term, subjects: [] }).subjects.push({
      courseCode: r.courseCode, courseTitle: r.courseTitle, creditHours: r.creditHours,
      midMarks: r.midMarks, midMax: r.midMax, finalMarks: r.finalMarks, finalMax: r.finalMax,
      totalPercent: r.totalPercent, letterGrade: r.letterGrade, gradePoints: r.gradePoints, stage: r.workflowStage,
    });
  }
  const list = Object.values(students).map((s) => {
    const sems = Object.values(s.semesters).sort((a, b) => (a.semester || 0) - (b.semester || 0)).map((sem) => ({
      ...sem,
      gpa: idx[s.studentId]?.[sem.semester || 0]?.gpa ?? computeGPA(sem.subjects),
      // Change 6 — cumulative CGPA at this semester (same index; display only).
      cgpa: idx[s.studentId]?.[sem.semester || 0]?.cgpa ?? null,
      credits: sem.subjects.reduce((a, x) => a + (x.creditHours || 0), 0),
      stage: sem.subjects.every((x) => x.stage === 'OFFICIAL') ? 'OFFICIAL' : sem.subjects.every((x) => ['UNOFFICIAL', 'OFFICIAL'].includes(x.stage)) ? 'UNOFFICIAL' : 'COMPILED',
    }));
    const last = sems[sems.length - 1];
    return { ...s, semesters: sems, cgpa: last ? (idx[s.studentId]?.[last.semester || 0]?.cgpa ?? null) : null };
  }).sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber)));
  const term = await currentTerm();
  return { batch, currentSession: term?.title || null, students: list };
}

// ============================================================
// CUMULATIVE HORIZONTAL GAZETTE — grouped by Batch + Current Semester.
// One row per student: Semester 1 courses (total marks) + Sem 1 GPA,
// Semester 2 … up to the student's current semester, then CGPA and
// Remarks. Reuses gazette() data (same stages), gpaIndex() (existing
// GPA/CGPA), and the existing promotion rules for Remarks. Read-only,
// computed on every request so it always reflects the latest data.
// ============================================================
const REMARK_LABELS = {
  ELIGIBLE: 'Promoted', PROBATION: 'Probation', LAST_PROBATION: 'Last Probation',
  FAILED_COURSES: 'Promoted (failed courses)', REPEAT: 'Repeat Semester', DROPPED: 'Dropped', REMOVED: 'Removed',
};
async function remarksFor(studentIds) {
  const out = {};
  if (!studentIds.length) return out;
  const promotionSvc = require('./promotionService');
  const [{ rows }, records] = await Promise.all([
    promotionSvc.buildPromotionList({ studentIds }),
    prisma.lmsPromotionRecord.findMany({ where: { studentId: { in: studentIds } }, orderBy: { createdAt: 'desc' } }),
  ]);
  for (const id of studentIds) {
    const row = rows.find((r) => r.studentId === id);
    const rec = records.find((r) => r.studentId === id);
    const failed = (row && row.failedCourses || []).map((f) => f.code).filter(Boolean);
    if (row && row.list !== 'pending' && row.status) {
      // Current semester already evaluated by the existing promotion rules.
      let label = REMARK_LABELS[row.status] || row.label || row.status;
      if (row.status === 'FAILED_COURSES' && failed.length) label = `Promoted (failed: ${failed.join(', ')})`;
      out[id] = { status: row.status, label, pending: false };
    } else if (rec) {
      // Last decision taken (e.g. promoted into the current semester).
      let fc = [];
      try { fc = JSON.parse(rec.failedCourses || '[]').map((f) => f.code).filter(Boolean); } catch (_) { fc = []; }
      let label = REMARK_LABELS[rec.outcome] || rec.outcome;
      if (rec.outcome === 'FAILED_COURSES' && fc.length) label = `Promoted (failed: ${fc.join(', ')})`;
      if (rec.toSemester && rec.outcome !== 'REPEAT') label = `${label} to Semester ${rec.toSemester}`;
      out[id] = { status: rec.outcome, label, pending: false };
    } else {
      out[id] = { status: 'PENDING', label: 'Result pending', pending: true };
    }
  }
  return out;
}

async function gazetteCumulative(batch, { program } = {}) {
  const { currentSemesterMap, semesterLabel } = require('./studentSemesterService');
  const base = await gazette(batch, { program });
  const ids = base.students.map((s) => s.studentId);
  const [semMap, idx, remarks, regs] = await Promise.all([
    currentSemesterMap(ids),
    gpaIndex(ids, STAGE_SETS.compilation),
    remarksFor(ids),
    // Current enrolments: a block for a semester the student has reached
    // shows its courses even before any result is submitted.
    prisma.courseRegistration.findMany({
      where: { studentId: { in: ids }, status: { in: ['ENROLLED', 'COMPLETED'] }, offering: { isDeleted: false } },
      select: { studentId: true, offering: { select: { term: { select: { title: true } }, course: { select: { code: true, title: true, creditHours: true, semester: { select: { number: true } } } } } } },
    }),
  ]);
  const groups = new Map();
  for (const s of base.students) {
    const cur = semMap[s.studentId] || { number: 1, label: semesterLabel(1) };
    if (!groups.has(cur.number)) groups.set(cur.number, { currentSemester: cur.number, currentSemesterLabel: cur.label, term: cur.term || base.currentSession, blocks: new Map(), rows: [] });
    const g = groups.get(cur.number);
    const semBy = new Map(s.semesters.map((x) => [x.semester || 0, x]));
    // Courses per semester block (results first, then current enrolments).
    for (const x of s.semesters) {
      const n = x.semester || 0;
      if (n > cur.number) continue;
      if (!g.blocks.has(n)) g.blocks.set(n, { semester: n, term: x.term || null, courses: new Map() });
      const b = g.blocks.get(n);
      if (!b.term && x.term) b.term = x.term;
      for (const c of x.subjects) if (!b.courses.has(c.courseCode)) b.courses.set(c.courseCode, { code: c.courseCode, title: c.courseTitle, creditHours: c.creditHours });
    }
    for (const r of regs.filter((y) => y.studentId === s.studentId)) {
      const n = r.offering?.course?.semester?.number;
      if (!n || n > cur.number) continue;
      if (!g.blocks.has(n)) g.blocks.set(n, { semester: n, term: r.offering?.term?.title || null, courses: new Map() });
      const b = g.blocks.get(n);
      if (!b.term && r.offering?.term?.title) b.term = r.offering.term.title;
      const c = r.offering.course;
      if (!b.courses.has(c.code)) b.courses.set(c.code, { code: c.code, title: c.title, creditHours: c.creditHours });
    }
    const gi = idx[s.studentId] || {};
    const reached = Object.keys(gi).map(Number).filter((n) => n <= cur.number).sort((a, b) => a - b);
    const lastSem = reached[reached.length - 1];
    const semesters = {};
    for (const [n, x] of semBy.entries()) {
      if (n > cur.number) continue;
      semesters[n] = {
        gpa: gi[n]?.gpa ?? null,
        marks: Object.fromEntries(x.subjects.map((c) => [c.courseCode, { total: c.totalPercent, grade: c.letterGrade, gradePoints: c.gradePoints, stage: c.stage }])),
      };
    }
    g.rows.push({
      studentId: s.studentId, rollNumber: s.rollNumber, student: s.student, program: s.program, department: s.department,
      semesters,
      cgpa: lastSem != null ? gi[lastSem].cgpa : null,
      remarks: remarks[s.studentId]?.label || 'Result pending',
      remarksStatus: remarks[s.studentId]?.status || 'PENDING',
    });
  }
  const list = [...groups.values()].sort((a, b) => a.currentSemester - b.currentSemester).map((g) => {
    // Every block from Semester 1 up to the group's current semester.
    const blocks = [];
    for (let n = 1; n <= g.currentSemester; n += 1) {
      const b = g.blocks.get(n) || { semester: n, term: null, courses: new Map() };
      blocks.push({ semester: n, label: semesterLabel(n), term: b.term || (n === g.currentSemester ? g.term : null), courses: [...b.courses.values()].sort((x, y) => String(x.code).localeCompare(String(y.code))) });
    }
    return {
      batch,
      currentSemester: g.currentSemester,
      title: `${batch} – ${g.currentSemesterLabel}`,
      currentSemesterLabel: g.currentSemesterLabel,
      term: g.term,
      blocks,
      rows: g.rows.sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber))),
    };
  });
  return { batch, currentSession: base.currentSession, groups: list };
}

module.exports = {
  STAGE_SETS, currentTerm, fetchResults, buildTree, gpaIndex, subjectSheet, scopeStudents,
  declare, studentRecord, gazetteBatches, gazette, round2, gazetteCumulative,
};
