// Unit tests for the AUST promotion rules (Sections 10 + 11).
// Run: node scripts/qa/unitPromotionRules.js
const { evaluate, listOf } = require('../../src/utils/lmsPromotionRules');

let pass = 0; let fail = 0;
const eq = (got, want, m) => { const ok = got === want; if (ok) pass += 1; else fail += 1; console.log(`  ${ok ? '✔' : '✘'} ${m}${ok ? '' : ` (got ${got}, want ${want})`}`); };

// Course helper: percent → gradePoints via the official AUST scale.
const { gradeFromPercent } = require('../../src/utils/lmsGrading');
const c = (percent, ch = 3, extra = {}) => { const g = gradeFromPercent(percent); return { creditHours: ch, percent, gradePoints: g.points, letterGrade: g.letter, code: `C${percent}`, ...extra }; };
// A semester of n courses all at `pct` (3 cr each).
const semOf = (n, pct) => Array.from({ length: n }, () => c(pct));
const S = (semester, courses) => ({ semester, courses });

console.log('Semester 1 → 2 on GPA');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 70))] }).status, 'ELIGIBLE', 'GPA 3.00 → Eligible');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 60))] }).status, 'ELIGIBLE', 'GPA 2.00 exactly → Eligible');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 59))] }).status, 'PROBATION', 'GPA 1.90 → On Probation');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 55))] }).status, 'PROBATION', 'GPA 1.50 exactly → On Probation');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 54))] }).status, 'DROPPED', 'GPA 1.40 → Dropped');
eq(evaluate({ semester: 1, semesters: [S(1, semOf(5, 59))] }).probations, 1, 'first probation counted');

console.log('Semester 2 → 3 on CGPA');
eq(evaluate({ semester: 2, semesters: [S(1, semOf(5, 59)), S(2, semOf(5, 62))], priorProbations: 1 }).status, 'ELIGIBLE', 'CGPA 2.05 → out of probation, Eligible');
eq(evaluate({ semester: 2, semesters: [S(1, semOf(5, 58)), S(2, semOf(5, 59))], priorProbations: 1 }).status, 'LAST_PROBATION', 'CGPA 1.85 → Last Probation');
eq(evaluate({ semester: 2, semesters: [S(1, semOf(5, 55)), S(2, semOf(5, 52))], priorProbations: 1 }).status, 'DROPPED', 'CGPA 1.35 → Dropped');
eq(evaluate({ semester: 2, semesters: [S(1, semOf(5, 80)), S(2, semOf(5, 50))] }).measure, 'CGPA', 'semester 2 is judged on CGPA');

console.log('End of semester 3');
eq(evaluate({ semester: 3, semesters: [S(1, semOf(5, 60)), S(2, semOf(5, 60)), S(3, semOf(5, 60))] }).status, 'ELIGIBLE', 'CGPA 2.00 → Eligible');
eq(evaluate({ semester: 3, semesters: [S(1, semOf(5, 60)), S(2, semOf(5, 58)), S(3, semOf(5, 58))] }).status, 'REMOVED', 'CGPA < 2.00, never on probation → Removed');
const s3p = evaluate({ semester: 3, semesters: [S(1, semOf(5, 58)), S(2, semOf(5, 59)), S(3, semOf(5, 59))], priorProbations: 2 });
eq(s3p.status, 'DROPPED', 'still on probation after semester 3 → Dropped');
eq(s3p.noReadmission, true, '… with no re-admission');

console.log('Semester 4 onwards');
const good3 = [S(1, semOf(5, 62)), S(2, semOf(5, 62)), S(3, semOf(5, 62))];
eq(evaluate({ semester: 4, semesters: [...good3, S(4, semOf(5, 70))], maxSemesters: 8 }).status, 'ELIGIBLE', 'CGPA ≥ 2.00 → Eligible');
eq(evaluate({ semester: 4, semesters: [S(1, semOf(5, 60)), S(2, semOf(5, 60)), S(3, semOf(5, 60)), S(4, semOf(5, 52))], maxSemesters: 8 }).status, 'REPEAT', 'CGPA < 2.00 → Repeat semester');
eq(evaluate({ semester: 4, semesters: [S(1, semOf(5, 60)), S(2, semOf(5, 60)), S(3, semOf(5, 60)), S(4, semOf(5, 52))], maxSemesters: 4 }).status, 'REMOVED', 'repeat would exceed max duration → Removed');
eq(evaluate({ semester: 4, semesters: [...good3, S(4, semOf(5, 70))], maxSemesters: 4 }).nextSemester, null, 'final semester passed → no next semester');

console.log('Credit-hour rule + failed courses');
// Sem 1: 4 passed × 3 = 12 cr, 1 failed → promoted with failed course.
const f1 = evaluate({ semester: 1, semesters: [S(1, [c(75), c(75), c(75), c(75), c(45)])] });
eq(f1.status, 'FAILED_COURSES', '12 cr passed + 1 failed course → Failed courses (promoted)');
eq(f1.failedCourses.length, 1, 'failed course listed');
eq(listOf(f1.status), 'failed', 'shown on the Failed-courses list');
eq(f1.nextSemester, 2, 'still advances to semester 2');
// Sem 1: only 9 cr passed → repeat (GPA ok).
const r1 = evaluate({ semester: 1, semesters: [S(1, [c(90), c(90), c(90), c(45), c(45)])] });
eq(r1.status, 'REPEAT', 'GPA ok but only 9 cr passed in semester 1 → Repeat semester');
// Sem 3 needs 9.
eq(evaluate({ semester: 3, semesters: [...good3.slice(0, 2), S(3, [c(80), c(80), c(80), c(40), c(40)])] }).status, 'FAILED_COURSES', 'semester 3: 9 cr passed is enough');
eq(evaluate({ semester: 1, semesters: [S(1, [c(50), c(50), c(50), c(50), c(50)])] }).failedCourses.length, 0, 'exactly 50% is a pass');
eq(evaluate({ semester: 1, semesters: [S(1, [c(50), c(50), c(50), c(50), c(49.4)])] }).failedCourses.length, 1, '49.4% is a fail');

const light = [c(80), c(80), c(80), c(80, 2)]; // 11-credit semester
eq(evaluate({ semester: 1, semesters: [S(1, light)], semesterLoad: 11 }).status, 'ELIGIBLE', '11-credit semester fully passed → Eligible (threshold = load)');
eq(evaluate({ semester: 1, semesters: [S(1, [c(80), c(80), c(80), c(40, 2)])], semesterLoad: 11 }).status, 'REPEAT', '11-credit semester with 9 cr passed → Repeat semester');
eq(evaluate({ semester: 1, semesters: [S(1, [...semOf(5, 75), c(40)])], semesterLoad: 18 }).minCh, 12, '18-credit semester keeps the 12-credit rule');
console.log('Professional-subject exception (configurable)');
const prof = [S(1, [c(90), c(90), c(90), c(45, 3, { isProfessional: true }), c(45)])];
eq(evaluate({ semester: 1, semesters: prof }).status, 'REPEAT', 'exception OFF: professional fail counts against credit hours');
eq(evaluate({ semester: 1, semesters: prof, settings: { professionalException: true } }).status, 'FAILED_COURSES', 'exception ON: professional fail does not block promotion');

console.log('Lists');
eq(listOf('ELIGIBLE'), 'eligible', 'Eligible → eligible list');
eq(listOf('PROBATION'), 'eligible', 'On Probation → eligible list (promotable)');
eq(listOf('REPEAT'), 'failed', 'Repeat → failed list');
eq(listOf('DROPPED'), 'dropped', 'Dropped → dropped list');
eq(listOf('REMOVED'), 'dropped', 'Removed → dropped list');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
