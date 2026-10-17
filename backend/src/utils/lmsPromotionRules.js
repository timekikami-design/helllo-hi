// ============================================================
//  AUST SEMESTER PROMOTION RULES (Sections 10 + 11) — pure logic.
// ------------------------------------------------------------
//  Implements the AUST undergraduate promotion rules exactly as
//  specified. No database access here, so the rules are unit-testable
//  (see backend/scripts/qa/unitPromotionRules.js).
//
//  Inputs per student:
//    semester       the semester just completed (1..N)
//    semesters[]    every DECLARED semester so far, in order:
//                   { semester, courses:[{creditHours, percent, gradePoints,
//                     letterGrade, isProfessional}] }
//    priorProbations number of probation terms already served
//    maxSemesters   maximum duration of the program in semesters
//
//  Rules (spec):
//   • Course pass = ≥ 50 % (lmsGrading.PASS_PERCENT).
//   • Semester pass = credit hours PASSED ≥ 12 in semesters 1–2,
//     ≥ 9 in semesters 3–8.
//   • 1 → 2 on GPA, 2 → 3 on CGPA:
//        ≥ 2.00 promoted · 1.50–1.99 probation · < 1.50 dropped.
//   • Probation: first probation after semester 1; LAST probation if
//     the CGPA has not reached 2.00 by the end of semester 2; DROPPED
//     (no re-admission) if not out of probation by semester 3.
//   • End of semester 3: CGPA ≥ 2.00, otherwise REMOVED.
//   • Semester 4 onwards: CGPA ≥ 2.00, otherwise REPEAT the semester —
//     unless repeating would exceed the program's maximum duration, in
//     which case REMOVED.
//   • Failed courses: a student who meets the GPA/CGPA rule and the
//     credit-hour rule but has failed course(s) is promoted with those
//     courses carried as "Failed" and marked for the Special Exam.
//   • Professional-subject exception (configurable): when enabled, a
//     failed course flagged as professional does not count against the
//     semester's passed credit hours (it is still carried as Failed and
//     marked for the Special Exam).
//
//  Outcome labels: Eligible · On Probation · Last Probation ·
//  Failed courses · Repeat semester · Dropped · Removed.
// ============================================================
const { PASS_PERCENT, computeGPA } = require('./lmsGrading');

const LABELS = {
  ELIGIBLE: 'Eligible',
  PROBATION: 'On Probation',
  LAST_PROBATION: 'Last Probation',
  FAILED_COURSES: 'Failed courses',
  REPEAT: 'Repeat semester',
  DROPPED: 'Dropped',
  REMOVED: 'Removed',
};

const DEFAULT_SETTINGS = {
  professionalException: false, // count failed professional subjects as passed credit hours
  minPassCreditsEarly: 12, // semesters 1–2
  minPassCreditsLate: 9, // semesters 3–8
};

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const passed = (c) => Number(c.percent) >= PASS_PERCENT;

function semesterCredits(courses, settings) {
  let passedCh = 0; let attemptedCh = 0;
  for (const c of courses) {
    const ch = Number(c.creditHours) || 0;
    attemptedCh += ch;
    if (passed(c) || (settings.professionalException && c.isProfessional)) passedCh += ch;
  }
  return { passedCh, attemptedCh };
}

/**
 * Evaluate one student at the end of `semester`.
 * @returns {{status:string,label:string,gpa:number,cgpa:number,measure:'GPA'|'CGPA',
 *   value:number,passedCh:number,minCh:number,failedCourses:Array,probations:number,
 *   nextSemester:number|null,reasons:string[]}}
 */
function evaluate({ semester, semesters, priorProbations = 0, maxSemesters = 8, settings = {} }) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const sem = Number(semester);
  const current = semesters.find((s) => Number(s.semester) === sem) || { courses: [] };
  const upTo = semesters.filter((s) => Number(s.semester) <= sem);
  const gpa = computeGPA(current.courses);
  const cgpa = computeGPA(upTo.flatMap((s) => s.courses));
  const { passedCh } = semesterCredits(current.courses, cfg);
  const minCh = sem <= 2 ? cfg.minPassCreditsEarly : cfg.minPassCreditsLate;
  const failedCourses = current.courses.filter((c) => !passed(c)).map((c) => ({
    courseId: c.courseId, code: c.code, title: c.title, creditHours: c.creditHours,
    percent: c.percent, isProfessional: !!c.isProfessional,
  }));
  const measure = sem === 1 ? 'GPA' : 'CGPA';
  const value = round2(sem === 1 ? gpa : cgpa);
  const reasons = [];
  const base = { gpa, cgpa, measure, value, passedCh, minCh, failedCourses, probations: priorProbations };
  const out = (status, extra = {}) => ({ ...base, status, label: LABELS[status], reasons, ...extra });
  const canRepeat = sem < maxSemesters; // repeating needs one more semester within the maximum duration
  const creditsOk = passedCh >= minCh;

  // ---- Semesters 1 and 2: GPA (sem 1) / CGPA (sem 2) bands + probation ----
  if (sem <= 2) {
    if (value < 1.5) {
      reasons.push(`${measure} ${value.toFixed(2)} is below 1.50`);
      return out('DROPPED', { nextSemester: null });
    }
    if (value < 2.0) {
      if (sem === 1) {
        reasons.push(`GPA ${value.toFixed(2)} is between 1.50 and 1.99 — first probation`);
        return out('PROBATION', { nextSemester: 2, probations: priorProbations + 1 });
      }
      reasons.push(`CGPA ${value.toFixed(2)} has not reached 2.00 by the end of semester 2 — last probation`);
      return out('LAST_PROBATION', { nextSemester: 3, probations: priorProbations + 1 });
    }
    if (!creditsOk) {
      reasons.push(`passed ${passedCh} credit hours; at least ${minCh} are required in semester ${sem}`);
      return out('REPEAT', { nextSemester: sem });
    }
    if (failedCourses.length) {
      reasons.push(`${failedCourses.length} failed course(s) carried forward for the Special Exam`);
      return out('FAILED_COURSES', { nextSemester: sem + 1 });
    }
    return out('ELIGIBLE', { nextSemester: sem + 1 });
  }

  // ---- End of semester 3 ----
  if (sem === 3) {
    if (value < 2.0) {
      if (priorProbations > 0) {
        reasons.push(`still on probation at the end of semester 3 (CGPA ${value.toFixed(2)}) — dropped, no re-admission`);
        return out('DROPPED', { nextSemester: null, noReadmission: true });
      }
      reasons.push(`CGPA ${value.toFixed(2)} is below 2.00 at the end of semester 3`);
      return out('REMOVED', { nextSemester: null });
    }
  } else if (value < 2.0) {
    // ---- Semester 4 onwards ----
    if (!canRepeat) {
      reasons.push(`CGPA ${value.toFixed(2)} is below 2.00 and repeating semester ${sem} would exceed the maximum duration (${maxSemesters} semesters)`);
      return out('REMOVED', { nextSemester: null });
    }
    reasons.push(`CGPA ${value.toFixed(2)} is below 2.00 — repeat semester ${sem}`);
    return out('REPEAT', { nextSemester: sem });
  }

  if (!creditsOk) {
    if (!canRepeat) {
      reasons.push(`passed ${passedCh} of the required ${minCh} credit hours and the maximum duration is reached`);
      return out('REMOVED', { nextSemester: null });
    }
    reasons.push(`passed ${passedCh} credit hours; at least ${minCh} are required in semester ${sem}`);
    return out('REPEAT', { nextSemester: sem });
  }
  const isFinal = sem >= maxSemesters;
  if (failedCourses.length) {
    reasons.push(`${failedCourses.length} failed course(s) carried forward for the Special Exam`);
    return out('FAILED_COURSES', { nextSemester: isFinal ? null : sem + 1 });
  }
  return out('ELIGIBLE', { nextSemester: isFinal ? null : sem + 1, completed: isFinal });
}

/** Which list a status belongs to on the Focal Person screen. */
function listOf(status) {
  if (status === 'ELIGIBLE' || status === 'PROBATION' || status === 'LAST_PROBATION') return 'eligible';
  if (status === 'FAILED_COURSES' || status === 'REPEAT') return 'failed';
  return 'dropped';
}

/** Statuses that may be promoted to the next semester. */
const PROMOTABLE = ['ELIGIBLE', 'PROBATION', 'LAST_PROBATION', 'FAILED_COURSES'];

module.exports = { evaluate, listOf, LABELS, PROMOTABLE, DEFAULT_SETTINGS, semesterCredits };
