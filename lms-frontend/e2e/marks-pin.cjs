// Issue 4 check: Teacher → Marks → unlock with personal PIN must show the
// marks screen (not the "Something went wrong" error boundary); marks can be
// entered and saved; a wrong PIN shows an inline error; and saved marks reach
// the student in real time.
// Run on the scratch DB (sets a PIN for teacher1):
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/marks-pin.cjs
const { chromium, openAs, API, realErrors, counter } = require('./lib.cjs');
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');

const PIN = '24680';
const call = async (token, method, url, body) => {
  const r = await fetch(API + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

async function typePin(p, pin) {
  const boxes = p.locator('input[inputmode="numeric"][type="password"]');
  await boxes.first().waitFor({ timeout: 90000 });
  // Type like a person: click the first box, then key in the digits
  // (the gate auto-advances focus between boxes).
  await boxes.first().click();
  await p.keyboard.type(pin, { delay: 60 });
}

(async () => {
  const { ok, done } = counter();
  const t = (await lmsLogin(API, 'teacher1')).token;
  const st = await call(t, 'GET', '/lms/academic/teacher/marks/pin/status');
  if (!st.body?.isSet) {
    const r = await call(t, 'POST', '/lms/academic/teacher/marks/pin/setup', { pin: PIN, confirmPin: PIN, password: 'Lms@1234' });
    ok(r.status === 201, `PIN set up for teacher1 (${r.status})`);
  }
  // Real-world data shape: the Course Coordinator has configured weightage
  // (counts larger than what the teacher has created yet, per-item weights,
  // lab + project) — the local seed has none, so create it on the scratch DB.
  if (process.env.QA_SCRATCH) {
    const prisma = require('../../backend/src/utils/prisma');
    const offs0 = await prisma.courseOffering.findMany({ where: { teacher: { username: 'teacher1' } }, include: { course: true } });
    for (const o of offs0) {
      await prisma.lmsCourse.update({ where: { id: o.courseId }, data: { hasLab: true } }).catch(() => {});
      await prisma.courseWeightage.upsert({
        where: { courseId: o.courseId },
        update: {},
        create: { courseId: o.courseId, assignmentWeight: 10, quizWeight: 10, labTaskWeight: 10, semesterProjectWeight: 5, midWeight: 25, finalWeight: 40,
          assignmentCount: 3, quizCount: 2, labTaskCount: 2,
          assignmentItems: JSON.stringify([{ label: 'A1', weight: 5 }, { label: 'A2', weight: 3 }, { label: 'A3', weight: 2 }]),
          quizItems: JSON.stringify([{ label: 'Q1', weight: 5 }, { label: 'Q2', weight: 5 }]) },
      });
    }
    console.log(`  configured weightage on ${offs0.length} offering course(s)`);
  }
  const browser = await chromium.launch();
  try {
    const offs = await call(t, 'GET', '/lms/academic/teacher/offerings');
    const offeringId = (offs.body?.offerings || [])[0]?.id;
    ok(!!offeringId, `teacher1 has an offering (${offeringId})`);
    const targets = [
      ...(offs.body?.offerings || []).map((o) => [`offering ${o.id} (${o.course?.code || ''})`, `/teacher/offerings/${o.id}?tab=marks&scope=marks`]),
      ['Results Submission', '/teacher/results-submission'],
    ];
    let wrongTested = false;
    for (const [label, path] of targets) {
      const s = await openAs(browser, 'teacher1', path);
      const p = s.page;
      const fails = [];
      p.on('response', (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) fails.push(`${r.status()} ${r.url().replace(API, '').split('?')[0]}`); });
      await p.waitForTimeout(4000);
      if (!wrongTested) {
        await typePin(p, '11111');
        await p.getByRole('button', { name: /unlock/i }).click();
        await p.waitForTimeout(2500);
        ok((await p.getByText(/something went wrong/i).count()) === 0, 'wrong PIN: no error-boundary crash');
        ok(/invalid|incorrect|wrong|attempt/i.test(await p.locator('body').innerText()), 'wrong PIN: inline error message shown');
        wrongTested = true;
      }
      await typePin(p, PIN);
      await p.getByRole('button', { name: /unlock/i }).click();
      await p.waitForTimeout(6000);
      const crashed = await p.getByText(/something went wrong/i).count();
      ok(crashed === 0, `${label}: unlocked screen renders (no "Something went wrong")`);
      const errs = realErrors(s.errors);
      ok(errs.length === 0, `${label}: no console errors${errs.length ? `: ${errs.slice(0, 3).join(' | ').slice(0, 1200)}` : ''}`);
      const f = [...new Set(fails)].filter((x) => !/pin\/unlock/.test(x));
      if (f.length) console.log(`  ${label} failed API calls:`, f.slice(0, 8).join(' ; '));
      await p.screenshot({ path: `/tmp/marks-${label.replace(/\W+/g, '_')}.png`, fullPage: true });
      await s.ctx.close();
    }

    // ---- Edit + save a Mid mark on an OPEN offering, with the student's
    // course page open in a second browser → must update without refresh.
    const prisma = require('../../backend/src/utils/prisma');
    const open = (offs.body?.offerings || []).find((o) => !o.locked && !o.submitted);
    if (open) {
      const reg = await prisma.courseRegistration.findFirst({ where: { offeringId: open.id, status: 'ENROLLED', student: { username: 'ADCS-001' } }, include: { student: true } })
        || await prisma.courseRegistration.findFirst({ where: { offeringId: open.id, status: 'ENROLLED' }, include: { student: true } });
      const stuUser = reg.student.username;
      // Mid/Final obtained marks need the course Mid/Final totals first (existing rule).
      await prisma.courseOffering.update({ where: { id: open.id }, data: { midTotalMarks: 100, finalTotalMarks: 100 } });
      const stu = await openAs(browser, stuUser, `/student/results`, stuUser.startsWith('QAP-') ? 'Qa@12345' : undefined);
      await stu.page.waitForTimeout(5000);
      const tch = await openAs(browser, 'teacher1', `/teacher/offerings/${open.id}?tab=marks&scope=marks`);
      const tp = tch.page;
      await tp.waitForTimeout(3000);
      await typePin(tp, PIN);
      await tp.getByRole('button', { name: /unlock/i }).click();
      const row = tp.locator('tr', { hasText: reg.student.linkedRollNumber || reg.student.username });
      const mid = row.getByLabel('Mid obtained');
      await mid.waitFor({ timeout: 60000 });
      const newVal = String(40 + Math.floor(Math.random() * 40));
      await mid.click();
      await mid.fill('');
      await tp.keyboard.type(newVal, { delay: 40 });
      await tp.keyboard.press('Enter');
      await tp.waitForTimeout(4000);
      ok((await tp.getByText(/something went wrong|couldn.t be shown/i).count()) === 0, 'save Mid mark: no crash');
      const dbr = await prisma.courseResult.findFirst({ where: { offeringId: open.id, studentId: reg.studentId } });
      ok(dbr && Number(dbr.midMarks) === Number(newVal), `Mid mark persisted (${dbr && dbr.midMarks} = ${newVal})`);
      ok((await mid.inputValue()) === newVal, 'teacher grid shows the saved value');
      // Student page reflects it in real time (no reload).
      let seen = false;
      for (let i = 0; i < 20 && !seen; i += 1) {
        await stu.page.waitForTimeout(1000);
        seen = (await stu.page.locator('body').innerText()).includes(`${newVal} / `);
      }
      ok(seen, `student results page shows ${newVal} without a manual refresh`);
      const te = realErrors(tch.errors); const se = realErrors(stu.errors);
      ok(te.length === 0 && se.length === 0, `no console errors while saving${te.concat(se).length ? `: ${te.concat(se).slice(0, 3).join(' | ').slice(0, 800)}` : ''}`);
      await tch.ctx.close(); await stu.ctx.close();
    } else console.log('SKIP edit/save: no open offering');

    // ---- Lockout path: 5 wrong PINs → locked screen (must not crash).
    {
      const s2 = await openAs(browser, 'teacher1', `/teacher/offerings/${offeringId}?tab=marks&scope=marks`);
      const p2 = s2.page;
      await p2.waitForTimeout(3000);
      for (let i = 0; i < 5; i += 1) {
        if (!(await p2.locator('input[inputmode="numeric"][type="password"]').count())) break;
        await typePin(p2, '13579');
        await p2.getByRole('button', { name: /unlock/i }).click();
        await p2.waitForTimeout(1500);
      }
      await p2.reload(); await p2.waitForTimeout(4000);
      const txt = await p2.locator('body').innerText();
      ok((await p2.getByText(/something went wrong|couldn.t be shown/i).count()) === 0, 'lockout: no crash');
      ok(/locked/i.test(txt) && !/Invalid Date/.test(txt), `lockout: locked message with a real time${/Invalid Date/.test(txt) ? ' (shows "Invalid Date")' : ''}`);
      ok(realErrors(s2.errors).length === 0, 'lockout: no console errors');
      await s2.ctx.close();
      await prisma.teacherMarksPin.update({ where: { lmsUserId: (await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } })).id }, data: { failedAttempts: 0, lockedUntil: null } });
    }
  } catch (e) { ok(false, `exception ${e.message.split('\n')[0]}`); } finally { await browser.close(); done(); }
})();
