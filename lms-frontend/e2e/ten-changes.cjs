// LMS-10 browser checks (scratch DB only):
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/ten-changes.cjs
// Covers the UI of Changes 1, 2, 3/4 (live), 6, 8, 10.
const path = require('path');
const { chromium, openAs, API, realErrors, counter } = require('./lib.cjs');
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');
if (process.env.QA_SCRATCH !== '1') { console.error('Run via browserScratch.sh (scratch DB only).'); process.exit(1); }

const PIN = '24680';
const call = async (token, method, url, body) => {
  const r = await fetch(API + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
async function saLogin() {
  const c = await (await fetch(`${API}/api/auth/captcha`)).json();
  const m = String(c.question).match(/(\d+)\s*([+\-×x*])\s*(\d+)/);
  const a = +m[1]; const b = +m[3];
  const answer = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'superadmin', password: 'superadmin123', captchaId: c.captchaId, captchaAnswer: String(answer) }) });
  return (await r.json()).token;
}
const prisma = require(path.join(__dirname, '../../backend/src/utils/prisma'));

(async () => {
  const { ok, done } = counter();
  const browser = await chromium.launch();
  const shot = (p, n) => p.screenshot({ path: `/tmp/ten-${n}.png`, fullPage: true }).catch(() => {});
  const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
  const run = (k) => !ONLY.length || ONLY.includes(k);
  try {
    // ---------- Change 2: provost searchable combobox ----------
    if (run('2')) {
      const A = await prisma.lmsUser.findFirst({ where: { role: 'Student', profile: { isNot: null } }, include: { profile: true } });
      await prisma.lmsStudentProfile.update({ where: { lmsUserId: A.id }, data: { cnic: '35202-9876543-1', phone: '+92 301 5550101', email: 'gamma.pick@example.com' } });
      const { page: p, ctx, errors } = await openAs(browser, 'provost1', '/provost/fee-concessions');
      await p.locator('[data-testid=conc-new]').click();
      const picker = p.locator('[data-testid=conc-student]');
      await picker.locator('button').first().click();
      const search = picker.locator('input');
      const pick = async (q, label) => {
        await search.fill(''); await search.type(q, { delay: 15 });
        await p.waitForTimeout(300);
        const opts = picker.locator('[role=option]');
        const n = await opts.count();
        const txt = n ? await opts.first().innerText() : '';
        ok(n >= 1 && txt.includes(A.profile.rollNumber), `Change 2: search by ${label} "${q}" finds the student (${n})`);
        ok(await search.evaluate((e) => document.activeElement === e), `Change 2: focus kept while typing ${label}`);
      };
      await pick(A.profile.fullName.slice(0, 4).toLowerCase(), 'name');
      await pick(A.profile.rollNumber, 'roll');
      await pick('3520298765431', 'CNIC (no dashes)');
      await pick('GAMMA.PICK', 'email');
      await pick('03015550101', 'phone (0 prefix)');
      if (A.profile.programShortForm) {
        await search.fill(''); await search.type(A.profile.programShortForm, { delay: 15 });
        ok((await picker.locator('[role=option]').count()) >= 1, 'Change 2: search by program');
        await search.fill(''); await search.type(A.profile.rollNumber, { delay: 15 });
      }
      await picker.locator('[role=option]').first().click();
      ok((await picker.locator('button').first().innerText()).includes(A.profile.rollNumber), 'Change 2: selection shown in the picker');
      await shot(p, 'c2-provost');
      ok(realErrors(errors).length === 0, `Change 2: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }

    // ---------- Change 3/4: My Departments card, live ----------
    if (run('3')) {
      const { page: p, ctx, errors } = await openAs(browser, 'teacher1', '/teacher/settings');
      const card = p.locator('[data-testid=my-departments]');
      await card.waitFor({ timeout: 60000 });
      await p.waitForTimeout(2500);
      const before = await card.innerText();
      ok(/My Departments/.test(before), `Change 3: card visible ("${before.replace(/\s+/g, ' ').slice(0, 90)}")`);
      ok((await card.locator('input,select,textarea').count()) === 0, 'Change 3: card is read-only');
      const depts = (await prisma.department.findMany({ select: { name: true } })).map((d) => d.name);
      const target = depts.find((d) => !before.includes(d));
      const t1 = await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } });
      const sa = await saLogin();
      const r = await call(sa, 'PATCH', `/super-admin/user-management/lms/${t1.id}/department`, { department: target });
      ok(r.status === 200, `Change 4: SA assigned "${target}" (${r.status})`);
      let seen = false;
      for (let i = 0; i < 15 && !seen; i += 1) { await p.waitForTimeout(1000); seen = (await card.innerText()).includes(target); }
      ok(seen, 'Change 3: new department appears on the card without refresh');
      await shot(p, 'c3-departments');
      ok(realErrors(errors).length === 0, `Change 3: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }

    // ---------- Change 1: marks Total input for an uncreated slot ----------
    if (run('1')) {
      const t = (await lmsLogin(API, 'teacher1')).token;
      const st = await call(t, 'GET', '/lms/academic/teacher/marks/pin/status');
      if (!st.body?.isSet) await call(t, 'POST', '/lms/academic/teacher/marks/pin/setup', { pin: PIN, confirmPin: PIN, password: 'Lms@1234' });
      const offs = await call(t, 'GET', '/lms/academic/teacher/offerings');
      const open = (offs.body?.offerings || []).find((o) => !o.locked && !o.submitted);
      if (open) {
        await prisma.courseWeightage.upsert({ where: { courseId: open.courseId || open.course.id }, update: { quizCount: 3, quizWeight: 10 }, create: { courseId: open.courseId || open.course.id, assignmentWeight: 10, quizWeight: 10, labTaskWeight: 0, semesterProjectWeight: 0, midWeight: 30, finalWeight: 50, assignmentCount: 1, quizCount: 3, labTaskCount: 0 } });
        const { page: p, ctx, errors } = await openAs(browser, 'teacher1', `/teacher/offerings/${open.id}?tab=marks&scope=marks`);
        const boxes = p.locator('input[inputmode="numeric"][type="password"]');
        await boxes.first().waitFor({ timeout: 90000 });
        await boxes.first().click(); await p.keyboard.type(PIN, { delay: 60 });
        await p.getByRole('button', { name: /unlock/i }).click();
        const totalInput = p.locator('input[aria-label$="total marks"]').first();
        await totalInput.waitFor({ timeout: 60000 });
        const label = (await totalInput.getAttribute('aria-label')).replace(/ total marks$/, '');
        ok(true, `Change 1: Total input shown for uncreated "${label}"`);
        await totalInput.fill('20');
        const cell = p.locator(`input[aria-label="${label} obtained"]`).first();
        await cell.click(); await p.keyboard.type('15', { delay: 30 }); await p.keyboard.press('Enter');
        await p.waitForTimeout(4000);
        ok((await p.getByText(/something went wrong/i).count()) === 0, 'Change 1: no crash after saving');
        const created = await prisma.quiz.findFirst({ where: { offeringId: open.id, description: 'Created from the Marks module' } }).catch(() => null)
          || await prisma.assignment2.findFirst({ where: { offeringId: open.id, description: 'Created from the Marks module' } }).catch(() => null);
        ok(!!created, `Change 1: item auto-created on first saved mark (${created && created.title})`);
        await shot(p, 'c1-marks');
        ok(realErrors(errors).length === 0, `Change 1: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
        await ctx.close();
      } else console.log('SKIP Change 1 UI: no open offering');
    }

    // ---------- Change 8: scheme batch + copy UI ----------
    if (run('8')) {
      // Fixture (same as the API test): coord1 in the ADCS department + one scheme.
      const program = await prisma.lmsProgram.findFirst({ where: { shortForm: 'ADCS' } });
      const c1 = await prisma.lmsUser.findFirst({ where: { username: 'coord1' } });
      const dep = program.department || 'Department of Computing';
      await prisma.lmsStudentProfile.upsert({ where: { lmsUserId: c1.id }, update: { department: dep }, create: { lmsUserId: c1.id, fullName: 'Coordinator One', fatherName: '-', cnic: '-', dateOfBirth: '-', gender: '-', program: '-', programShortForm: '-', department: dep, rollNumber: 'coord1', registrationNumber: 'coord1', session: '-', enrollmentDate: new Date() } });
      const coordTok = (await lmsLogin(API, 'coord1')).token;
      if (!(await prisma.schemeOfStudy.findFirst({ where: { programId: program.id, isDeleted: false } }))) {
        const r = await call(coordTok, 'POST', '/lms/academic/coordinator/schemes', { programId: program.id, name: 'ADCS Scheme', batch: '' });
        ok(r.status === 201, `Change 8: fixture scheme created (${r.status})`);
      }
      const { page: p, ctx, errors } = await openAs(browser, 'coord1', '/admin/schemes');
      await p.locator('[data-testid=scheme-batch]').first().waitFor({ timeout: 60000 });
      const n0 = await p.locator('[data-testid=scheme-batch]').count();
      ok(n0 >= 1, `Change 8: schemes show batch label (${n0})`);
      await p.locator('button[title="Copy to a new batch"]').first().click();
      await p.locator('[data-testid=clone-batch]').fill('Spring 2188');
      await p.locator('[data-testid=clone-save]').click();
      await p.waitForTimeout(3000);
      ok(await p.getByText('Batch: Spring 2188').count() >= 1, 'Change 8: copied scheme appears with the new batch');
      await shot(p, 'c8-schemes');
      ok(realErrors(errors).length === 0, `Change 8: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }

    // ---------- Change 10: student study scheme labels ----------
    if (run('10')) {
      const { page: p, ctx, errors } = await openAs(browser, 'QAP-FAIL', '/student/scheme', 'Qa@12345');
      await p.locator('[data-testid=course-enrollment]').first().waitFor({ timeout: 60000 });
      const labels = await p.locator('[data-testid=course-enrollment]').allInnerTexts();
      ok(labels.every((l) => ['Completed', 'Currently Enrolled', 'Upcoming'].includes(l.trim())), `Change 10: enrollment labels valid (${[...new Set(labels)].join(', ')})`);
      const results = await p.locator('[data-testid=course-result]').allInnerTexts();
      ok(results.some((r) => /Fail/i.test(r)), `Change 10: Pass/Fail shown (${[...new Set(results)].join(', ')})`);
      await shot(p, 'c10-scheme');
      ok(realErrors(errors).length === 0, `Change 10: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }

    // ---------- Change 6: gazette toggle + download dialog ----------
    if (run('6')) {
      const { page: p, ctx, errors } = await openAs(browser, 'exam1', '/exam/gazette');
      const batchBtn = p.locator('button', { hasText: 'Batch' }).first();
      await batchBtn.waitFor({ timeout: 60000 });
      await batchBtn.click();
      const toggle = p.locator('[data-testid=gazette-layout-toggle]');
      await toggle.waitFor({ timeout: 60000 });
      ok((await toggle.locator('button[aria-pressed=true]').innerText()).includes('Current'), 'Change 6: default is the existing view');
      const search = p.locator('input[placeholder="Search name / roll no"]');
      await search.fill('a');
      const navs = []; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs.push(f.url()); });
      await toggle.locator('button', { hasText: 'Horizontal' }).click();
      await p.locator('[data-testid=gazette-horizontal]').waitFor({ timeout: 10000 });
      ok(true, 'Change 6: horizontal layout renders');
      const hHead = await p.locator('[data-testid=gazette-horizontal] thead').first().innerText().catch(() => '');
      ok(/GPA/.test(hHead) && /CGPA/.test(hHead) && /Remarks/i.test(hHead), 'Change 6: horizontal has GPA, CGPA, Remarks columns');
      await toggle.locator('button', { hasText: 'Vertical' }).click();
      await p.locator('[data-testid=gazette-vertical]').waitFor({ timeout: 10000 });
      ok(/Semester/.test(await p.locator('[data-testid=gazette-vertical]').innerText()), 'Change 6: vertical grouped by semester');
      ok(navs.length === 0 && (await search.inputValue()) === 'a', 'Change 6: toggle keeps filters, no page reload');
      await shot(p, 'c6-gazette-vertical');
      await p.locator('button', { hasText: 'PDF' }).click();
      const dlg = p.locator('[data-testid=gazette-download-dialog]');
      await dlg.waitFor({ timeout: 10000 });
      ok((await dlg.locator('input[type=radio]').count()) === 3, 'Change 6: download dialog offers Standard / Horizontal / Vertical');
      await dlg.locator('input[value=horizontal]').check();
      const [download] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }).catch(() => null), p.locator('[data-testid=gazette-download-go]').click()]);
      ok(!!download, `Change 6: horizontal PDF downloaded (${download && download.suggestedFilename()})`);
      ok(realErrors(errors).length === 0, `Change 6: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }
  } catch (e) {
    ok(false, `unexpected: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
  done();
})();
