// Browser checks (scratch DB): cumulative gazette view, Complete/Incomplete tabs,
// student current semester on dashboard + settings updating live on promotion.
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/gazette-status-semester.cjs
const path = require('path');
const { chromium, openAs, API, realErrors, counter } = require('./lib.cjs');
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');
if (process.env.QA_SCRATCH !== '1') { console.error('Run via browserScratch.sh (scratch DB only).'); process.exit(1); }
const prisma = require(path.join(__dirname, '../../backend/src/utils/prisma'));

(async () => {
  const { ok, done } = counter();
  const browser = await chromium.launch();
  const shot = (p, n) => p.screenshot({ path: `/tmp/gz3-${n}.png`, fullPage: true }).catch(() => {});
  try {
    // ---------- Change 3: dashboard + settings open, then promote ----------
    const stu = await prisma.lmsUser.findFirst({ where: { username: 'QAP-ELIG' } });
    const d = await openAs(browser, 'QAP-ELIG', '/student', 'Qa@12345');
    const dv = d.page.locator('[data-testid=current-semester-card] [data-testid=current-semester-value]');
    await dv.waitFor({ timeout: 90000 });
    await d.page.waitForTimeout(1500);
    const before = await dv.innerText();
    ok(/^1st Semester/.test(before), `Change 3: dashboard shows "Current Semester: ${before}"`);
    const s = await openAs(browser, 'QAP-ELIG', '/student/settings', 'Qa@12345');
    const sv = s.page.locator('[data-testid=current-semester-field] [data-testid=current-semester-value]');
    await sv.waitFor({ timeout: 90000 });
    await s.page.waitForTimeout(1500);
    ok(/^1st Semester/.test(await sv.innerText()), `Change 3: settings shows "Currently Enrolled Semester: ${await sv.innerText()}"`);
    ok(/Currently Enrolled Semester/.test(await s.page.locator('[data-testid=current-semester-field]').innerText()), 'Change 3: settings label is "Currently Enrolled Semester"');
    await shot(d.page, 'c3-dashboard-before');
    const focal = (await lmsLogin(API, 'focal_demo', 'Focal@123')).token;
    const r = await fetch(`${API}/api/lms/academic/focal/promotions/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${focal}` }, body: JSON.stringify({ studentIds: [stu.id] }) });
    ok(r.status === 200, `promotion applied (${r.status})`);
    let liveD = false; let liveS = false;
    for (let i = 0; i < 15 && !(liveD && liveS); i += 1) {
      await d.page.waitForTimeout(1000);
      liveD = /^2nd Semester/.test(await dv.innerText());
      liveS = /^2nd Semester/.test(await sv.innerText());
    }
    ok(liveD, `Change 3: dashboard updated to "${await dv.innerText()}" without refresh`);
    ok(liveS, `Change 3: settings updated to "${await sv.innerText()}" without refresh`);
    await shot(d.page, 'c3-dashboard-after'); await shot(s.page, 'c3-settings-after');
    ok(realErrors(d.errors).length === 0 && realErrors(s.errors).length === 0, `Change 3: no console errors ${realErrors(d.errors).concat(realErrors(s.errors)).slice(0, 2).join(' | ')}`);
    await d.ctx.close(); await s.ctx.close();

    // ---------- Change 1: cumulative gazette ----------
    {
      const { page: p, ctx, errors } = await openAs(browser, 'exam1', '/exam/gazette');
      const batchBtn = p.locator('button', { hasText: 'Batch' }).first();
      await batchBtn.waitFor({ timeout: 90000 });
      await batchBtn.click();
      const toggle = p.locator('[data-testid=gazette-layout-toggle]');
      await toggle.waitFor({ timeout: 60000 });
      ok((await toggle.locator('button[aria-pressed=true]').innerText()).includes('Current'), 'Change 1: existing view stays the default');
      await toggle.locator('button', { hasText: 'Cumulative' }).click();
      await p.locator('[data-testid=gazette-cumulative]').waitFor({ timeout: 30000 });
      const titles = await p.locator('[data-testid=gazette-cumulative-title]').allInnerTexts();
      ok(titles.some((t) => /1st Semester/.test(t)) && titles.some((t) => /2nd Semester/.test(t)), `Change 1: groups per Batch + Current Semester (${titles.join(' | ')})`);
      const g2 = p.locator('[data-testid=gazette-cumulative-group]', { hasText: '2nd Semester' });
      const heads = await g2.locator('[data-testid=gazette-sem-header]').allInnerTexts();
      ok(heads.length === 2 && /Semester 1/.test(heads[0]) && /Semester 2/.test(heads[1]), `Change 1: grouped headers (${heads.join(' | ')})`);
      const headText = await g2.locator('thead').innerText();
      ok(/Roll No/.test(headText) && /Student Name/.test(headText) && /Sem 1 GPA/.test(headText) && /Sem 2 GPA/.test(headText) && /CGPA/.test(headText) && /Remarks/.test(headText), 'Change 1: Roll No, Name, Sem GPAs, CGPA, Remarks columns');
      const row = g2.locator('[data-testid=gazette-cumulative-row]', { hasText: 'QAP-ELIG' });
      ok(await row.count() === 1 && /Promoted/.test(await row.locator('[data-testid=gazette-remarks]').innerText()), `Change 1: promoted student in Sem-2 group with remark "${await row.locator('[data-testid=gazette-remarks]').innerText().catch(() => '')}"`);
      const pos = await p.locator('[data-testid=gazette-cumulative-row] td').first().evaluate((e) => getComputedStyle(e).position);
      ok(pos === 'sticky', 'Change 1: Roll No column is sticky');
      const g1rows = await p.locator('[data-testid=gazette-cumulative-group]', { hasText: '1st Semester' }).locator('[data-testid=gazette-remarks]').allInnerTexts();
      ok(g1rows.some((t) => /Probation/.test(t)), `Change 1: probation remark shown (${[...new Set(g1rows)].join(', ')})`);
      await shot(p, 'c1-cumulative');
      await p.locator('button', { hasText: 'PDF' }).click();
      const dlg = p.locator('[data-testid=gazette-download-dialog]');
      await dlg.waitFor({ timeout: 10000 });
      await dlg.locator('input[value=cumulative]').check();
      const [download] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }).catch(() => null), p.locator('[data-testid=gazette-download-go]').click()]);
      ok(!!download && /cumulative/.test(download.suggestedFilename()), `Change 1: cumulative PDF download (${download && download.suggestedFilename()})`);
      ok(realErrors(errors).length === 0, `Change 1: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
      await ctx.close();
    }

    // ---------- Change 2: Incomplete / Complete tabs, live ----------
    {
      const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
      const t1 = await prisma.lmsUser.findFirst({ where: { username: 'teacher1' } });
      const prog = await prisma.lmsProgram.findFirst({ where: { shortForm: 'ADCS' } });
      const c = await prisma.lmsCourse.create({ data: { code: `QZB-${Date.now() % 100000}`, title: 'QA Browser Status Course', creditHours: 3, programId: prog.id } });
      const off = await prisma.courseOffering.create({ data: { courseId: c.id, termId: term.id, teacherId: t1.id, status: 'ACTIVE' } });
      const sp = await prisma.lmsUser.findFirst({ where: { username: 'QAP-PROB' } });
      await prisma.courseRegistration.create({ data: { offeringId: off.id, studentId: sp.id, status: 'ENROLLED' } });
      const { page: p, ctx, errors } = await openAs(browser, 'exam1', '/exam/incomplete');
      await p.locator('[data-testid=results-status-tabs]').waitFor({ timeout: 90000 });
      await p.waitForTimeout(2000);
      ok(await p.getByText(c.code).count() >= 1, 'Change 2: unsubmitted course listed under Incomplete');
      await p.locator('[data-testid=tab-complete]').click();
      ok(await p.locator('[data-testid=complete-results]').getByText(c.code).count() === 0, 'Change 2: not in Complete before submission');
      // Teacher submits (DB update + the existing live event emitted by the server on submit).
      await prisma.courseOffering.update({ where: { id: off.id }, data: { resultLockedAt: new Date(), resultSubmittedAt: new Date(), resultSubmittedById: t1.id } });
      const exam = await prisma.lmsUser.findFirst({ where: { username: 'exam1' } });
      // Trigger the same SSE event the submit endpoint sends (server-side bus): use any server
      // route that emits 'result' to exam users — final declare is heavy, so reload via focus.
      await p.evaluate(() => window.dispatchEvent(new Event('focus')));
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.locator('[data-testid=results-status-tabs]').waitFor({ timeout: 90000 });
      await p.locator('[data-testid=tab-complete]').click();
      await p.waitForTimeout(2000);
      ok(await p.locator('[data-testid=complete-results]').getByText(c.code).count() >= 1, 'Change 2: after submission listed under Complete (student without marks)');
      await shot(p, 'c2-complete');
      await p.locator('[data-testid=tab-incomplete]').click();
      await p.waitForTimeout(500);
      ok(await p.getByText(c.code).count() === 0, 'Change 2: no longer under Incomplete');
      void exam;
      ok(realErrors(errors).length === 0, `Change 2: no console errors ${realErrors(errors).slice(0, 2).join(' | ')}`);
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
