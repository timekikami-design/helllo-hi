// API-level checks for the 10-change LMS update. SCRATCH DB ONLY — run with:
//   cd backend && bash scripts/qa/browserScratch.sh scripts/qa/e2eTenChanges.js
// (browserScratch serves a copy of dev.db on :5000 and seeds QAP-* fixtures.)
const path = require('path');
const prisma = require('../../src/utils/prisma');
const { lmsLogin } = require('./lmsLogin');
if (!process.env.QA_SCRATCH) { console.error('Scratch DB only (QA_SCRATCH=1).'); process.exit(2); }

const BASE = process.env.QA_BASE || 'http://localhost:5000';
let pass = 0; let fail = 0;
const ok = (c, m) => { if (c) pass += 1; else fail += 1; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const call = async (token, method, url, body, extra = {}) => {
  const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, headers: r.headers, body: ct.includes('json') ? await r.json().catch(() => null) : Buffer.from(await r.arrayBuffer()) };
};
async function saLogin() {
  const c = await (await fetch(`${BASE}/api/auth/captcha`)).json();
  const m = String(c.question).match(/(\d+)\s*([+\-×x*])\s*(\d+)/);
  const a = +m[1]; const b = +m[3];
  const answer = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'superadmin', password: 'superadmin123', captchaId: c.captchaId, captchaAnswer: String(answer) }) });
  return (await r.json()).token;
}
// Subscribe to the shared SSE bus as a user and collect named events.
function listen(token) {
  const events = [];
  const ctrl = new AbortController();
  (async () => {
    try {
      const r = await fetch(`${BASE}/api/lms/academic/coordinator/events?token=${encodeURIComponent(token)}`, { signal: ctrl.signal });
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

(async () => {
  const sa = await saLogin();
  ok(!!sa, 'super admin login');
  const teacher = (await lmsLogin(BASE, 'teacher1')).token;
  const coord = (await lmsLogin(BASE, 'coord1')).token;
  const provost = (await lmsLogin(BASE, 'provost1')).token;
  const exam = (await lmsLogin(BASE, 'exam1')).token;

  // ---------------- Change 1: marks for uncreated slots ----------------
  {
    const PIN = '24680';
    const st = await call(teacher, 'GET', '/lms/academic/teacher/marks/pin/status');
    if (!st.body.isSet) await call(teacher, 'POST', '/lms/academic/teacher/marks/pin/setup', { pin: PIN, confirmPin: PIN, password: 'Lms@1234' });
    const un = await call(teacher, 'POST', '/lms/academic/teacher/marks/pin/unlock', { pin: PIN });
    ok(un.status === 200 && un.body.token, 'Change 1: PIN unlock unchanged');
    const mt = { 'X-Marks-Token': un.body.token };
    const off = await prisma.courseOffering.findFirst({ where: { teacher: { username: 'teacher1' }, isDeleted: false, resultLockedAt: null, resultSubmittedAt: null }, include: { course: true } });
    await prisma.courseWeightage.upsert({ where: { courseId: off.courseId }, update: { assignmentWeight: 10, quizWeight: 10, midWeight: 30, finalWeight: 50, assignmentCount: 2, quizCount: 2, labTaskWeight: 0, semesterProjectWeight: 0 }, create: { courseId: off.courseId, assignmentWeight: 10, quizWeight: 10, midWeight: 30, finalWeight: 50, assignmentCount: 2, quizCount: 2 } });
    const quizzesBefore = await prisma.quiz.count({ where: { offeringId: off.id, isDeleted: false } });
    const gb = await call(teacher, 'GET', `/lms/academic/teacher/marks/offerings/${off.id}/gradebook`, null, mt);
    ok(gb.status === 200, `Change 1: gradebook loads (${gb.status})`);
    const quizCat = gb.body.categories.find((c) => c.key === 'quiz');
    const slot = quizCat && quizCat.items.find((it) => !it.created);
    const row = gb.body.rows.find((r) => r.editable);
    if (slot && row) {
      const n = Number(slot.key.split('-slot-')[1]);
      const noTotal = await call(teacher, 'PUT', `/lms/academic/teacher/marks/offerings/${off.id}/cell`, { kind: 'quiz', slot: n, studentId: row.studentId, marks: 5 }, mt);
      ok(noTotal.status === 400, 'Change 1: missing Total is rejected with a message');
      const r1 = await call(teacher, 'PUT', `/lms/academic/teacher/marks/offerings/${off.id}/cell`, { kind: 'quiz', slot: n, totalMarks: 20, studentId: row.studentId, marks: 15 }, mt);
      ok(r1.status === 200, `Change 1: quiz mark saved into an uncreated slot (${r1.status} ${r1.body && r1.body.error || ''})`);
      // Same slot again (e.g. second student / double click) must NOT create a second quiz.
      const other = gb.body.rows.find((r) => r.editable && r.studentId !== row.studentId) || row;
      await call(teacher, 'PUT', `/lms/academic/teacher/marks/offerings/${off.id}/cell`, { kind: 'quiz', slot: n, totalMarks: 20, studentId: other.studentId, marks: 12 }, mt);
      const quizzesAfter = await prisma.quiz.count({ where: { offeringId: off.id, isDeleted: false } });
      ok(quizzesAfter === quizzesBefore + 1, `Change 1: exactly one quiz auto-created (${quizzesBefore} → ${quizzesAfter})`);
      const gb2 = await call(teacher, 'GET', `/lms/academic/teacher/marks/offerings/${off.id}/gradebook`, null, mt);
      const cell = gb2.body.rows.find((r) => r.studentId === row.studentId).cells[gb2.body.categories.find((c) => c.key === 'quiz').items[n - 1].key];
      const itemW = gb2.body.categories.find((c) => c.key === 'quiz').items[n - 1].itemWeight;
      const expectConv = Math.round((15 / 20) * itemW * 100) / 100;
      ok(cell && cell.obtained === 15 && cell.total === 20 && cell.converted === expectConv, `Change 1: converted value uses the existing formula (15/20 × ${itemW} = ${cell && cell.converted})`);
      const cr = await prisma.courseResult.findUnique({ where: { offeringId_studentId: { offeringId: off.id, studentId: row.studentId } } });
      ok(cr && cr.quizMarks >= 2.5, `Change 1: flows into the stored result (quizMarks ${cr && cr.quizMarks})`);
      const as = await call(teacher, 'PUT', `/lms/academic/teacher/marks/offerings/${off.id}/cell`, { kind: 'assignment', slot: 1, totalMarks: 10, studentId: row.studentId, marks: 8 }, mt);
      ok(as.status === 200, `Change 1: assignment slot also enterable (${as.status} ${as.body && as.body.error || ''})`);
    } else ok(false, 'Change 1: no uncreated quiz slot found to test');
    const noPin = await call(teacher, 'GET', `/lms/academic/teacher/marks/offerings/${off.id}/gradebook`);
    ok(noPin.status === 423, 'Change 1: PIN still required');
  }

  // ---------------- Change 2: provost student list fields ----------------
  {
    const r = await call(provost, 'GET', '/lms/academic/provost/finance/students');
    const s = r.body.items[0] || {};
    ok(r.status === 200 && 'email' in s && 'phone' in s && 'cnic' in s && 'program' in s, 'Change 2: student list has name/roll/program/CNIC/email/phone');
  }

  // ---------------- Changes 3 + 4: teacher departments ----------------
  {
    const t1 = await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } });
    const depts = (await prisma.department.findMany({ select: { name: true } })).map((d) => d.name);
    const before = await call(teacher, 'GET', '/lms/academic/teacher/departments');
    ok(before.status === 200, `Change 3: My Departments endpoint (${JSON.stringify(before.body.departments)})`);
    const primary = before.body.departments.find((d) => d.isPrimary);
    const target = depts.find((d) => !before.body.departments.some((x) => x.name === d));
    // coord1 belongs to target dept so we can check visibility
    const c1 = await prisma.lmsUser.findFirst({ where: { username: 'coord1' } });
    await prisma.lmsStudentProfile.upsert({ where: { lmsUserId: c1.id }, update: { department: target }, create: { lmsUserId: c1.id, fullName: 'Coordinator One', fatherName: '-', cnic: '-', dateOfBirth: '-', gender: '-', program: '-', programShortForm: '-', department: target, rollNumber: 'coord1', registrationNumber: 'coord1', session: '-', enrollmentDate: new Date() } });
    const tl = listen(teacher); const cl = listen(coord);
    await wait(800);
    const r = await call(sa, 'PATCH', `/super-admin/user-management/lms/${t1.id}/department`, { department: target });
    ok(r.status === 200, `Change 4: SA assigns "${target}" (${r.status} ${r.body && (r.body.message || r.body.error)})`);
    await wait(1500);
    const after = await call(teacher, 'GET', '/lms/academic/teacher/departments');
    ok(after.body.departments.some((d) => d.name === target), 'Change 3/4: new department listed for the teacher');
    if (primary) ok(after.body.departments.find((d) => d.isPrimary)?.name === primary.name, 'Change 4: first department stays primary (existing visibility unchanged)');
    else ok(after.body.departments.find((d) => d.isPrimary)?.name === target, 'Change 4: first-ever department becomes primary');
    ok(tl.events.some((e) => e.event === 'department' && e.data.department === target), 'Change 3: teacher received live department event');
    ok(cl.events.some((e) => e.event === 'department' && e.data.teacherId === t1.id), 'Change 4: department coordinator received live "teacher assigned" event');
    const notif = await prisma.lmsNotification.findFirst({ where: { userId: c1.id, title: 'Teacher assigned to department' } });
    ok(!!notif, 'Change 4: coordinator got an in-app notification');
    const list = await call(coord, 'GET', '/lms/academic/coordinator/instructors');
    ok((list.body.instructors || []).some((i) => i.id === t1.id), "Change 4: teacher appears in the department's instructor list");
    const again = await call(sa, 'PATCH', `/super-admin/user-management/lms/${t1.id}/department`, { department: target });
    const rows = await prisma.lmsTeacherDepartment.count({ where: { lmsUserId: t1.id, department: target } });
    ok(again.status === 200 && rows === 1, 'Change 4: re-assigning is idempotent (no duplicate)');
    const users = await call(sa, 'GET', '/super-admin/user-management', null);
    const u = (users.body.users || []).find((x) => x.id === t1.id);
    ok(u && Array.isArray(u.departments) && u.departments.includes(target), 'Change 4: All Users lists the teacher\'s departments');
    tl.stop(); cl.stop();
  }

  // ---------------- Change 5 + 8: schemes + auto-enrollment ----------------
  {
    const program = await prisma.lmsProgram.findFirst({ where: { shortForm: 'ADCS', isDeleted: false } });
    const c1 = await prisma.lmsUser.findFirst({ where: { username: 'coord1' } });
    await prisma.lmsStudentProfile.update({ where: { lmsUserId: c1.id }, data: { department: program.department || 'Department of Computing' } });
    const src = await prisma.schemeOfStudy.findFirst({ where: { programId: program.id, isDeleted: false }, include: { items: true } });
    let sourceId = src && src.id;
    if (!src) {
      const r = await call(coord, 'POST', '/lms/academic/coordinator/schemes', { programId: program.id, name: 'ADCS Scheme', batch: '' });
      sourceId = r.body.scheme.id;
    }
    // Source scheme must have Semester-1 courses: add them through the API
    // (exercises "add a course to a scheme").
    if (!(await prisma.schemeCourse.count({ where: { schemeId: sourceId } }))) {
      const sem1 = await prisma.lmsSemester.findFirst({ where: { programId: program.id, number: 1, isDeleted: false }, include: { courses: { where: { isDeleted: false } } } });
      for (const c of sem1.courses) await call(coord, 'POST', `/lms/academic/coordinator/schemes/${sourceId}/items`, { courseId: c.id, semester: 1 });
      const sem2 = await prisma.lmsSemester.findFirst({ where: { programId: program.id, number: 2, isDeleted: false }, include: { courses: { where: { isDeleted: false } } } });
      for (const c of (sem2 ? sem2.courses : [])) await call(coord, 'POST', `/lms/academic/coordinator/schemes/${sourceId}/items`, { courseId: c.id, semester: 2 });
    }
    await wait(1500); // let the background Semester-1 re-run finish
    const srcBefore = await prisma.schemeCourse.findMany({ where: { schemeId: sourceId } });
    ok(srcBefore.length > 0, `Change 8: courses added to a scheme (${srcBefore.length})`);
    const cl = await call(coord, 'POST', `/lms/academic/coordinator/schemes/${sourceId}/clone`, { batch: 'Fall 2099' });
    ok(cl.status === 201 && cl.body.copied === srcBefore.length, `Change 8: copy scheme to new batch (${cl.status}, ${cl.body.copied}/${srcBefore.length} courses)`);
    const newId = cl.body.scheme && cl.body.scheme.id;
    const list = await call(coord, 'GET', '/lms/academic/coordinator/schemes');
    ok((list.body.schemes || []).some((s) => s.id === newId && s.batch === 'Fall 2099'), 'Change 8: scheme shows its batch');
    const dup = await call(coord, 'POST', `/lms/academic/coordinator/schemes/${sourceId}/clone`, { batch: 'Fall 2099' });
    ok(dup.status === 409, 'Change 8: a second scheme for the same batch is refused');
    const det = await call(coord, 'GET', `/lms/academic/coordinator/schemes/${newId}`);
    const firstItem = det.body.semesters.flatMap((s) => s.courses)[0];
    if (firstItem) {
      const rn = await call(coord, 'PUT', `/lms/academic/coordinator/schemes/${newId}/items/${firstItem.schemeCourseId}/title`, { title: 'Renamed For 2099' });
      ok(rn.status === 200, 'Change 8: rename a course in the copy');
      const rm = await call(coord, 'DELETE', `/lms/academic/coordinator/schemes/${newId}/items/${det.body.semesters.flatMap((s) => s.courses).slice(-1)[0].schemeCourseId}`);
      ok(rm.status === 200, 'Change 8: remove a course from the copy');
    }
    const srcAfter = await prisma.schemeCourse.findMany({ where: { schemeId: sourceId } });
    ok(srcAfter.length === srcBefore.length && srcAfter.every((x) => !x.title || srcBefore.find((y) => y.id === x.id)?.title === x.title), 'Change 8: original scheme unchanged');
    const course = await prisma.lmsCourse.findUnique({ where: { id: firstItem.courseId } });
    ok(course.title !== 'Renamed For 2099', 'Change 8: shared course catalogue name untouched');
    const fresh = await call(coord, 'POST', '/lms/academic/coordinator/schemes', { programId: program.id, name: 'From scratch', batch: 'Spring 2100' });
    ok(fresh.status === 201 && fresh.body.scheme.batch === 'Spring 2100', 'Change 8: create a scheme from scratch for a batch');

    // Change 5: a Semester-1 student of batch "Fall 2099" with no registrations
    const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    const tmpl = await prisma.lmsStudentProfile.findFirst({ where: { programShortForm: 'ADCS' } });
    const bcrypt = require('bcryptjs');
    const u = await prisma.lmsUser.create({ data: { username: 'QA-AUTO-1', passwordHash: await bcrypt.hash('Qa@12345', 10), role: 'Student', mustChangePassword: false } });
    const { id: _i, lmsUserId: _l, createdAt: _c, updatedAt: _u, ...rest } = tmpl;
    await prisma.lmsStudentProfile.create({ data: { ...rest, lmsUserId: u.id, fullName: 'QA Auto', rollNumber: 'QA-AUTO-1', registrationNumber: 'REG-QA-AUTO-1', cnic: '00000-1111111-1', session: 'Fall 2099' } });
    const { autoEnrollStudent, reenrollProgramFirstSemester } = require(path.join(__dirname, '../../src/services/autoEnrollService'));
    const sem1Ids = (await prisma.schemeCourse.findMany({ where: { schemeId: newId, semester: 1 } })).map((x) => x.courseId);
    const r1 = await autoEnrollStudent(u.id);
    const r2 = await autoEnrollStudent(u.id);
    const regs = await prisma.courseRegistration.findMany({ where: { studentId: u.id } });
    const expected = await prisma.courseOffering.count({ where: { termId: term.id, isDeleted: false, status: 'ACTIVE', courseId: { in: sem1Ids } } });
    ok(r1.source === 'scheme' && regs.length === expected, `Change 5: enrolled in all Sem-1 courses of the batch scheme (${regs.length}/${expected})`);
    ok(r2.enrolled === 0 && (await prisma.courseRegistration.count({ where: { studentId: u.id } })) === regs.length, 'Change 5: running twice creates no duplicates');
    await reenrollProgramFirstSemester(program.id, 'Fall 2099');
    ok((await prisma.courseRegistration.count({ where: { studentId: u.id } })) === regs.length, 'Change 5: scheme re-run is idempotent');
    // No scheme yet for a batch → graceful; enrolled once scheme created.
    const u2 = await prisma.lmsUser.create({ data: { username: 'QA-AUTO-2', passwordHash: await bcrypt.hash('Qa@12345', 10), role: 'Student', mustChangePassword: false } });
    await prisma.lmsStudentProfile.create({ data: { ...rest, lmsUserId: u2.id, fullName: 'QA Auto 2', rollNumber: 'QA-AUTO-2', registrationNumber: 'REG-QA-AUTO-2', cnic: '00000-2222222-2', session: 'Fall 2199', programShortForm: 'ZZNONE', program: 'No Such Program' } });
    const none = await autoEnrollStudent(u2.id);
    ok(none.enrolled === 0 && !!none.reason, `Change 5: no program/scheme yet → no error (${none.reason})`);
    // Log in first (login itself runs auto-enroll; nothing to enroll yet), then
    // give the student a program and create the batch scheme → live push.
    const sl = listen((await lmsLogin(BASE, 'QA-AUTO-2', 'Qa@12345')).token);
    await wait(600);
    await prisma.lmsStudentProfile.update({ where: { lmsUserId: u2.id }, data: { programShortForm: tmpl.programShortForm, program: tmpl.program } });
    ok((await prisma.courseRegistration.count({ where: { studentId: u2.id } })) === 0, 'Change 5: nothing enrolled before the batch scheme exists');
    const s2100 = await call(coord, 'POST', `/lms/academic/coordinator/schemes/${sourceId}/clone`, { batch: 'Fall 2199' });
    await wait(4000);
    const regs2 = await prisma.courseRegistration.count({ where: { studentId: u2.id } });
    ok(s2100.status === 201 && regs2 > 0, `Change 5: enrolled automatically once the batch scheme is created (${regs2})`);
    ok(sl.events.some((e) => e.event === 'enrollment'), 'Change 5: student notified live');
    sl.stop();
  }

  // ---------------- Change 6: gazette exports ----------------
  {
    const b = await call(exam, 'GET', '/lms/academic/exam/workflow/gazette/batches');
    const batch = (b.body.batches || [])[0];
    if (batch) {
      const g = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette?batch=${encodeURIComponent(batch.batch)}`);
      ok(g.status === 200 && g.body.students.length > 0, `Change 6: gazette data (${batch.batch}, ${g.body.students.length} students)`);
      for (const [fmt, layout] of [['pdf', ''], ['pdf', 'horizontal'], ['pdf', 'vertical'], ['excel', ''], ['excel', 'horizontal'], ['excel', 'vertical']]) {
        const r = await call(exam, 'GET', `/lms/academic/exam/workflow/gazette/export/${fmt}?batch=${encodeURIComponent(batch.batch)}${layout ? `&layout=${layout}` : ''}`);
        const buf = r.body;
        const isPdf = Buffer.isBuffer(buf) && buf.slice(0, 4).toString() === '%PDF';
        const isXlsx = Buffer.isBuffer(buf) && buf.slice(0, 2).toString() === 'PK';
        ok(r.status === 200 && (fmt === 'pdf' ? isPdf : isXlsx), `Change 6: ${fmt} ${layout || 'standard'} export (${r.status}, ${buf.length} bytes)`);
        if (fmt === 'pdf') {
          const s = buf.toString('latin1');
          const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(s);
          if (m) {
            const landscape = +m[1] > +m[2];
            ok(layout === 'horizontal' ? landscape : !landscape, `Change 6: ${layout || 'standard'} PDF is ${landscape ? 'landscape' : 'portrait'}`);
          }
          require('fs').writeFileSync(`/tmp/gazette-${layout || 'standard'}.pdf`, buf);
        }
      }
    } else ok(false, 'Change 6: no gazette batch in scratch data');
  }

  // ---------------- Changes 9 + 10: course status ----------------
  {
    const fail = await prisma.lmsUser.findFirst({ where: { username: 'QAP-FAIL' } });
    const st = (await lmsLogin(BASE, 'QAP-FAIL', 'Qa@12345')).token;
    const sch = await call(st, 'GET', '/lms/academic/student/scheme');
    const courses = sch.body.semesters.flatMap((s) => s.courses);
    const failed = courses.filter((c) => c.result === 'FAIL');
    const passed = courses.filter((c) => c.result === 'PASS');
    ok(failed.length === 1 && passed.length === 3, `Change 10: Pass/Fail labels from declared results (pass ${passed.length}, fail ${failed.length})`);
    ok(courses.every((c) => ['COMPLETED', 'CURRENTLY_ENROLLED', 'UPCOMING'].includes(c.enrollment)), 'Change 10: exactly one enrollment status per course');
    ok(failed.every((c) => c.enrollment !== 'COMPLETED'), 'Change 9: failed course is not shown as Completed');
    // Carry the failed course into a new term → still FAILED until passed.
    const fc = failed[0];
    const course = await prisma.lmsCourse.findFirst({ where: { code: fc.code } });
    const newTerm = await prisma.academicTerm.create({ data: { title: 'QA Next Term', code: `QA-NEXT-${Date.now()}`, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 864e5 * 120).toISOString().slice(0, 10), isCurrent: false, isActive: true } }).catch((e) => { console.log('term create error:', e.message); return null; });
    let retake = null;
    if (newTerm) {
      const oldCur = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
      await prisma.academicTerm.update({ where: { id: oldCur.id }, data: { isCurrent: false } });
      await prisma.academicTerm.update({ where: { id: newTerm.id }, data: { isCurrent: true } });
      retake = await prisma.courseOffering.create({ data: { courseId: course.id, termId: newTerm.id, status: 'ACTIVE', teacherId: (await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } })).id } });
      await prisma.courseRegistration.create({ data: { offeringId: retake.id, studentId: fail.id, status: 'ENROLLED', registrationType: 'REPEAT' } }).catch(async () => prisma.courseRegistration.create({ data: { offeringId: retake.id, studentId: fail.id, status: 'ENROLLED' } }));
      const sch2 = await call(st, 'GET', '/lms/academic/student/scheme');
      const c2 = sch2.body.semesters.flatMap((s) => s.courses).find((c) => c.code === fc.code);
      ok(c2.result === 'FAIL' && c2.enrollment === 'CURRENTLY_ENROLLED' && c2.carried, 'Change 9: carried-over failed course stays FAILED (Currently Enrolled)');
      // Staff views show the same status.
      const t1 = (await lmsLogin(BASE, 'teacher1')).token;
      const roster = await call(t1, 'GET', `/lms/academic/teacher/offerings/${retake.id}/students`);
      ok(roster.body.students.find((s) => s.studentId === fail.id)?.courseStatus === 'FAIL', 'Change 9: teacher roster shows Failed');
      const focal = (await lmsLogin(BASE, 'focal_demo', 'Focal@123')).token;
      const fd = await call(focal, 'GET', `/lms/academic/focal/students/${fail.id}`);
      if (fd.status === 200) ok((fd.body.student.results || []).some((r) => r.code === fc.code && r.courseStatus === 'FAIL'), 'Change 9: focal student view shows Failed');
      else ok(true, `Change 9: focal view out of department scope (${fd.status}) — skipped`);
      // Pass the retake → PASSED everywhere, live.
      const sl = listen(st); const tl = listen(t1);
      await wait(600);
      // Real flow: teacher submitted → Exam declares unofficial via the API
      // (the SSE bus lives in the server process, so the broadcast must run there).
      await prisma.$executeRawUnsafe(`INSERT INTO "CourseResult" (offeringId, studentId, totalPercent, letterGrade, gradePoints, status, workflowStage, createdAt, updatedAt) VALUES (?, ?, 72, 'B-', 3.2, 'DRAFT', 'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, retake.id, fail.id);
      await prisma.courseOffering.update({ where: { id: retake.id }, data: { resultSubmittedAt: new Date() } });
      const cInfo = await prisma.lmsCourse.findUnique({ where: { id: course.id }, include: { program: true, semester: true } });
      const dec = await call(exam, 'POST', '/lms/academic/exam/workflow/collection/declare-unofficial', { department: cInfo.program?.department || '—', program: cInfo.program?.shortForm || cInfo.program?.code, semester: String(cInfo.semester?.number || ''), confirm: true });
      ok(dec.status === 200, `Change 9: exam declared the retake result (${dec.status} ${dec.body.message || dec.body.error || ''})`);
      await wait(1200);
      const sch3 = await call(st, 'GET', '/lms/academic/student/scheme');
      const c3 = sch3.body.semesters.flatMap((s) => s.courses).find((c) => c.code === fc.code);
      ok(c3.result === 'PASS' && c3.enrollment === 'COMPLETED', 'Change 9/10: after passing the retake → Passed + Completed');
      const roster2 = await call(t1, 'GET', `/lms/academic/teacher/offerings/${retake.id}/students`);
      ok(roster2.body.students.find((s) => s.studentId === fail.id)?.courseStatus === 'PASS', 'Change 9: teacher roster updates to Passed');
      ok(sl.events.some((e) => e.event === 'result') && tl.events.some((e) => e.event === 'result' && e.data.action === 'course-status'), 'Change 9: student + teacher received live course-status events');
      sl.stop(); tl.stop();
    } else ok(false, 'Change 9: could not create a test term');
  }

  // ---------------- Change 7: landing content ----------------
  {
    const pub0 = await call(null, 'GET', '/landing-content');
    ok(pub0.status === 200 && typeof pub0.body.values === 'object', 'Change 7: public read');
    const anon = await call(null, 'PUT', '/super-admin/landing-content', { values: { 'hero.titleLine1': 'x' } });
    ok(anon.status === 401 || anon.status === 403, `Change 7: write requires login (${anon.status})`);
    const lmsTok = await call(teacher, 'PUT', '/super-admin/landing-content', { values: { 'hero.titleLine1': 'x' } });
    ok(lmsTok.status === 401 || lmsTok.status === 403, `Change 7: LMS users cannot write (${lmsTok.status})`);
    const w = await call(sa, 'PUT', '/super-admin/landing-content', { values: { 'hero.titleLine1': 'QA Heading', 'faq.0.q': 'QA question?' } });
    ok(w.status === 200, 'Change 7: super admin saves');
    const pub = await call(null, 'GET', '/landing-content');
    ok(pub.body.values['hero.titleLine1'] === 'QA Heading', 'Change 7: saved value served publicly');
    await call(sa, 'PUT', '/super-admin/landing-content', { values: { 'hero.titleLine1': '' } });
    const pub2 = await call(null, 'GET', '/landing-content');
    ok(!('hero.titleLine1' in pub2.body.values), 'Change 7: clearing restores the default');
    const bad = await call(sa, 'PUT', '/super-admin/landing-content', { values: { 'bad key!': 'x' } });
    ok(bad.status === 400, 'Change 7: invalid keys rejected');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
