// S7 / S8 / S9 browser flow: Provost announces → student submits proof →
// Provost rejects (reason) → student sees it live → Provost blocks via
// Defaulters → student blocked on every page → resubmits from Accounts
// Book → Provost approves & unblocks → concession re-prices the notice.
const fs = require('fs');
const path = require('path');
const { chromium, openAs, realErrors, counter, UI } = require('./lib.cjs');
const prisma = require('../../backend/src/utils/prisma');
const { ok, done } = counter();
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const OUT = process.env.SHOTS || '/tmp';
const T = { timeout: 90000 };

async function cleanup() {
  const anns = await prisma.lmsFeeAnnouncement.findMany({ where: { title: 'BT Semester Fee' } });
  const ch = await prisma.lmsFeeChallan.findMany({ where: { sourceAnnouncementId: { in: anns.map((a) => a.id) } } });
  const ids = ch.map((c) => c.id);
  await prisma.lmsFeePaymentSubmission.deleteMany({ where: { challanId: { in: ids } } });
  await prisma.lmsFeeInstallment.deleteMany({ where: { challanId: { in: ids } } });
  await prisma.lmsFeeChallan.deleteMany({ where: { id: { in: ids } } });
  await prisma.lmsFeeAnnouncement.deleteMany({ where: { title: 'BT Semester Fee' } });
  await prisma.lmsFeeConcession.deleteMany({ where: { title: { startsWith: 'BT ' } } });
  await prisma.lmsStudentBlock.deleteMany({ where: { reason: { startsWith: 'BT ' } } });
}

(async () => {
  await cleanup();
  const proof = path.join(OUT, 'bt-proof.png'); fs.writeFileSync(proof, PNG);
  const browser = await chromium.launch();
  const future = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  try {
    // Provost announces a semester fee (no amount field).
    const P = await openAs(browser, 'provost1', '/provost/fee-announce');
    await P.page.waitForSelector('button:has-text("Announce Semester Fee")', T);
    await P.page.click('button:has-text("Announce Semester Fee")');
    await P.page.waitForSelector('[data-testid="amount-locked"]', T);
    ok(true, 'semester fee form: amount locked to Admission record');
    ok(!/\bSection\b/.test(await P.page.innerText('body')), 'no "Section" scope on announce page');
    const dialog = P.page.locator('[data-testid="amount-locked"]').locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
    await dialog.locator('input').first().fill('BT Semester Fee');
    await P.page.fill('[data-testid="ann-deadline"]', future);
    await dialog.locator('select').first().selectOption('PROGRAM');
    await dialog.locator('select').nth(1).selectOption('ADCS');
    await P.page.screenshot({ path: path.join(OUT, 'bt_announce.png') });
    await P.page.click('button:has-text("Announce Fee")');
    await P.page.waitForSelector('text=/Fee announced — \\d+ student/', T);
    ok(true, 'announcement created');

    // Student: notice banner + proof submission.
    const S = await openAs(browser, 'ADCS-003', '/student');
    await S.page.waitForSelector('[data-testid="fee-due-banner"]', T);
    const banner = await S.page.innerText('[data-testid="fee-due-banner"]');
    ok(/You must submit PKR [0-9,]+ before \d+ \w+ \d{4}\./.test(banner), `dashboard banner (oldest open fee first): ${banner.trim().slice(0, 70)}`);
    await S.page.goto(`${UI}/student/account`, { waitUntil: 'domcontentloaded' });
    const card = S.page.locator('[data-testid="fee-card"]', { hasText: 'BT Semester Fee' });
    await card.waitFor(T);
    ok((await card.innerText()).includes('You must submit PKR 45,000 before'), 'fee card notice');
    await card.locator('[data-testid="submit-proof"]').click();
    await S.page.selectOption('[data-testid="pay-method"]', 'BANK');
    await S.page.fill('[data-testid="pay-txn"]', 'BT-TXN-1001');
    await S.page.setInputFiles('[data-testid="pay-file"]', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
    ok(/PNG, JPG or WEBP/.test(await S.page.innerText('[data-testid="pay-error"]')), 'client rejects non-image file');
    await S.page.setInputFiles('[data-testid="pay-file"]', proof);
    await S.page.screenshot({ path: path.join(OUT, 'bt_proof.png') });
    await S.page.click('[data-testid="pay-send"]');
    await S.page.waitForSelector('text=Payment proof submitted', T);
    await card.locator('[data-testid="submission-status"]').waitFor(T);
    ok(/Pending Provost review/.test(await card.locator('[data-testid="submission-status"]').innerText()), 'student sees Pending');

    // Provost rejects with reason.
    await P.page.goto(`${UI}/provost/fee-approvals`, { waitUntil: 'domcontentloaded' });
    const row = P.page.locator('[data-testid="sub-row"]', { hasText: 'BT-TXN-1001' });
    await row.waitFor(T);
    await row.locator('[data-testid="sub-review"]').click();
    await P.page.waitForSelector('[data-testid="sub-shot"]', T);
    ok(true, 'Provost sees the uploaded screenshot');
    await P.page.click('[data-testid="sub-reject"]');
    await P.page.waitForSelector('text=Enter a rejection reason', T);
    ok(true, 'reject without a reason is refused');
    await P.page.fill('[data-testid="sub-reason"]', 'Bank reference not found, please re-check');
    await P.page.screenshot({ path: path.join(OUT, 'bt_review.png') });
    await P.page.click('[data-testid="sub-reject"]');
    await P.page.waitForSelector('text=Payment rejected', T);
    await S.page.waitForFunction(() => /Rejected/.test(document.body.innerText) && /Bank reference not found/.test(document.body.innerText), null, T);
    ok(true, 'student sees Rejected + reason live (no reload)');
    ok(await card.locator('button:has-text("Resubmit Payment")').count() === 1, 'Resubmit button shown');

    // Make it overdue, block via Defaulters (search + program filter).
    const sid = (await prisma.lmsUser.findUnique({ where: { username: 'ADCS-003' } })).id;
    await prisma.lmsFeeChallan.updateMany({ where: { studentId: sid, title: 'BT Semester Fee' }, data: { dueDate: '2026-01-01' } });
    await P.page.goto(`${UI}/provost/defaulters`, { waitUntil: 'domcontentloaded' });
    await P.page.waitForSelector('[data-testid="def-search"]', T);
    await P.page.fill('[data-testid="def-search"]', 'ADCS-003');
    await P.page.selectOption('[data-testid="def-prog"]', 'ADCS');
    const drow = P.page.locator('[data-testid="def-row"]', { hasText: 'ADCS-003' });
    await drow.waitFor(T);
    await P.page.waitForTimeout(800);
    ok(await P.page.locator('[data-testid="def-row"]').count() === 1, 'search + program filter → only ADCS-003');
    await drow.locator('[data-testid="def-block"]').click();
    await P.page.fill('[data-testid="def-reason"]', 'BT fee not submitted');
    await P.page.click('[data-testid="def-confirm"]');
    await P.page.waitForSelector('text=Blocked 1 student', T);
    await P.page.screenshot({ path: path.join(OUT, 'bt_defaulters.png') });

    // Student blocked on every page; fee page still works.
    await S.page.goto(`${UI}/student/courses`, { waitUntil: 'domcontentloaded' });
    await S.page.waitForSelector('[data-testid="fee-block-screen"]', T);
    ok((await S.page.innerText('[data-testid="fee-block-message"]')).trim() === 'Your fee has not been submitted. Please submit your fee first.', 'block screen with the exact message on Courses');
    await S.page.goto(`${UI}/student/results`, { waitUntil: 'domcontentloaded' });
    await S.page.waitForSelector('[data-testid="fee-block-screen"]', T);
    ok(true, 'block screen on Results');
    await S.page.screenshot({ path: path.join(OUT, 'bt_blocked.png') });
    const S2 = await openAs(browser, 'ADCS-003', '/student');
    await S2.page.waitForSelector('[data-testid="fee-block-screen"]', T);
    ok(true, 'block screen right after a fresh login');
    await S2.page.click('button:has-text("Go to Accounts Book")');
    await S2.page.waitForSelector('[data-testid="fee-block-banner"]', T);
    ok(true, 'Accounts Book reachable while blocked');
    const c2 = S2.page.locator('[data-testid="fee-card"]', { hasText: 'BT Semester Fee' });
    await c2.locator('button:has-text("Resubmit Payment")').click();
    await S2.page.selectOption('[data-testid="pay-method"]', 'EASYPAISA');
    await S2.page.fill('[data-testid="pay-txn"]', 'BT-TXN-1002');
    await S2.page.setInputFiles('[data-testid="pay-file"]', proof);
    await S2.page.click('[data-testid="pay-send"]');
    await S2.page.waitForSelector('text=Payment proof submitted', T);
    ok(true, 'blocked student resubmits');

    // Provost approves → unblocks in one action; student unblocked live.
    await P.page.goto(`${UI}/provost/fee-approvals`, { waitUntil: 'domcontentloaded' });
    const row2 = P.page.locator('[data-testid="sub-row"]', { hasText: 'BT-TXN-1002' });
    await row2.waitFor(T);
    ok((await row2.innerText()).includes('BLOCKED'), 'approval list flags the student as BLOCKED');
    await row2.locator('[data-testid="sub-review"]').click();
    await P.page.waitForSelector('button:has-text("Approve & Unblock")', T);
    await P.page.click('[data-testid="sub-approve"]');
    await P.page.waitForSelector('text=student unblocked', T);
    ok(true, 'Approve & Unblock');
    await S.page.waitForFunction(() => !document.querySelector('[data-testid="fee-block-screen"]'), null, T);
    ok(true, 'block screen disappears live after approval');

    // Concession re-prices the student's notice.
    await P.page.goto(`${UI}/provost/fee-concessions`, { waitUntil: 'domcontentloaded' });
    await P.page.waitForSelector('[data-testid="conc-new"]', T);
    await P.page.click('[data-testid="conc-new"]');
    const s4 = (await prisma.lmsUser.findUnique({ where: { username: 'ADCS-004' } })).id;
    await P.page.selectOption('[data-testid="conc-student"]', s4);
    await P.page.waitForSelector('[data-testid="conc-preview"]', T);
    ok(/Admission base fee: PKR 45,000/.test(await P.page.innerText('[data-testid="conc-preview"]')), 'preview shows the Admission base fee');
    await P.page.fill('[data-testid="conc-title"]', 'BT Need-based');
    await P.page.fill('[data-testid="conc-value"]', '10');
    await P.page.waitForFunction(() => /after this: PKR 40,500/.test(document.querySelector('[data-testid="conc-preview"]').innerText), null, T);
    ok(true, 'live preview: 10% → PKR 40,500');
    await P.page.click('[data-testid="conc-save"]');
    await P.page.waitForSelector('text=/Concession granted/', T);
    await P.page.locator('[data-testid="conc-row"]', { hasText: 'BT Need-based' }).waitFor(T);
    await P.page.screenshot({ path: path.join(OUT, 'bt_concessions.png') });
    ok(true, 'concession listed in history');
    const S4 = await openAs(browser, 'ADCS-004', '/student/account');
    const c4 = S4.page.locator('[data-testid="fee-card"]', { hasText: 'BT Semester Fee' });
    await c4.waitFor(T);
    ok((await c4.innerText()).includes('You must submit PKR 40,500'), 'student notice reflects the concession');

    const errs = realErrors([...P.errors, ...S.errors, ...S2.errors, ...S4.errors]);
    ok(errs.length === 0, `no console errors${errs.length ? `: ${errs.slice(0, 4).join(' | ')}` : ''}`);
  } catch (e) {
    ok(false, `flow aborted: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
    await cleanup();
  }
  done();
})();
