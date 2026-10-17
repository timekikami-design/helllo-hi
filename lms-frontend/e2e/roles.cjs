// Multi-role browser checks for S10/S11 (Focal promotions) and S13/S14
// (no Section / Room anywhere). Run against a backend whose DB holds the
// QAP-* promotion fixtures (see backend/scripts/qa/seedPromotionFixtures.js):
//   node e2e/roles.cjs
const { chromium, openAs, realErrors, counter } = require('./lib.cjs');
const prisma = require('../../backend/src/utils/prisma');
const { ok, done } = counter();
const T = { timeout: 90000 };
const SHOTS = process.env.SHOTS || '/tmp';
async function until(fn, ms = 60000) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 1000)); } }

// Visible-text checks: whole word "Section"/"Sections"/"Sec" and "Room"/"Rooms"
// (the BigBlueButton "Breakout rooms" feature name is not a physical room).
const SECTION_RE = /\b(Section|Sections|Sec)\b/;
const ROOM_RE = /\b(Room|Rooms)\b/;
const stripAllowed = (t) => t.replace(/Breakout rooms?/gi, '').replace(/meeting room/gi, '').replace(/BigBlueButton room/gi, '');

const PAGES = [
  ['provost1', undefined, ['/provost/fee-records', '/provost/defaulters', '/provost/fee-approvals', '/provost/fee-concessions', '/provost/fee-announce', '/provost/students']],
  ['exam1', undefined, ['/exam/schedule', '/exam/datesheets', '/exam/gazette', '/exam/attendance', '/exam/midterm', '/exam/finalterm', '/exam/dashboard']],
  ['teacher1', undefined, ['/teacher/subjects', '/teacher/lab-tasks', '/teacher/dashboard']],
  ['ADCS-001', undefined, ['/student/schedule', '/student/courses', '/student/results', '/student/account', '/student/dashboard']],
  ['focal_demo', 'Focal@123', ['/focal/reports', '/focal/student-search', '/focal/promotions']],
  ['coord1', undefined, ['/admin/schedule', '/admin/teachers', '/admin/students', '/admin/teacher-assignment', '/admin/teacher-assignment/new', '/admin/dashboard']],
];

(async () => {
  const browser = await chromium.launch();
  try {
    console.log('== S13/S14 visible-text sweep per role');
    for (const [user, pw, paths] of PAGES) {
      const s = await openAs(browser, user, null, pw);
      for (const p of paths) {
        try {
          await s.page.goto(`${process.env.QA_UI || 'http://localhost:3001'}${p}`, { waitUntil: 'domcontentloaded' });
          await s.page.waitForSelector('main, h1, [class*="card"]', T);
          await s.page.waitForTimeout(2500);
          const text = stripAllowed(await s.page.innerText('body'));
          const sec = text.match(SECTION_RE); const room = text.match(ROOM_RE);
          ok(!sec, `${user} ${p}: no "Section"${sec ? ` (found "${text.slice(Math.max(0, sec.index - 40), sec.index + 30).replace(/\s+/g, ' ')}")` : ''}`);
          ok(!room, `${user} ${p}: no "Room"${room ? ` (found "${text.slice(Math.max(0, room.index - 40), room.index + 30).replace(/\s+/g, ' ')}")` : ''}`);
        } catch (e) { ok(false, `${user} ${p}: loads (${e.message.split('\n')[0]})`); }
      }
      const errs = realErrors(s.errors);
      ok(errs.length === 0, `${user}: no page errors${errs.length ? ` ${errs.slice(0, 2).join(' | ').slice(0, 300)}` : ''}`);
      await s.ctx.close();
    }

    console.log('\n== S10/S11 Focal Person promotion flow');
    const ids = Object.fromEntries((await prisma.lmsUser.findMany({ where: { username: { startsWith: 'QAP-' } } })).map((u) => [u.username, u.id]));
    const F = await openAs(browser, 'focal_demo', '/focal/promotions', 'Focal@123');
    const pg = F.page;
    await pg.waitForSelector('[data-testid="promo-tab-eligible"]', T);
    await pg.waitForSelector('[data-testid="promo-row"][data-roll="QAP-ELIG"]', T);
    ok(true, 'Eligible list shows QAP-ELIG');
    ok(/eligible/i.test(await pg.innerText('[data-testid="promo-row"][data-roll="QAP-ELIG"] [data-testid="promo-label"]')), 'label "Eligible"');
    ok(/on probation/i.test(await pg.innerText('[data-testid="promo-row"][data-roll="QAP-PROB"]')), 'QAP-PROB labelled "On Probation"');
    await pg.click('[data-testid="promo-tab-failed"]');
    await pg.waitForSelector('[data-testid="promo-row"][data-roll="QAP-RPT"]', T);
    const rpt = await pg.innerText('[data-testid="promo-row"][data-roll="QAP-RPT"]');
    ok(/repeat semester/i.test(rpt) && /EN-101/.test(rpt) && /failed/i.test(rpt), 'Failed-courses list: QAP-RPT "Repeat semester", EN-101 shown as Failed');
    await pg.click('[data-testid="promo-tab-dropped"]');
    await pg.waitForSelector('[data-testid="promo-row"][data-roll="QAP-DROP"]', T);
    ok(/dropped/i.test(await pg.innerText('[data-testid="promo-row"][data-roll="QAP-DROP"]')), 'Dropped list: QAP-DROP "Dropped"');

    // Search + filter
    await pg.click('[data-testid="promo-tab-eligible"]');
    await pg.fill('[data-testid="promo-search"]', 'QAP-ELIG');
    await pg.waitForTimeout(500);
    ok((await pg.$$('[data-testid="promo-row"]')).length === 1, 'search by roll no. narrows to one row');
    await pg.fill('[data-testid="promo-search"]', '');

    // Professional-subject exception (configurable) → QAP-FAIL becomes "Failed courses"
    await pg.click('[data-testid="promo-settings"]');
    await pg.waitForSelector('[data-testid="prof-toggle"]', T);
    if (!(await pg.isChecked('[data-testid="prof-toggle"]'))) await pg.check('[data-testid="prof-toggle"]');
    await pg.fill('[data-testid="prof-codes"]', 'EN-101');
    await pg.click('[data-testid="prof-save"]');
    await pg.click('[data-testid="promo-tab-failed"]');
    await pg.waitForFunction(() => /failed courses/i.test(document.querySelector('[data-roll="QAP-FAIL"]')?.innerText || ''), null, T);
    ok(true, 'exception ON (EN-101 professional): QAP-FAIL labelled "Failed courses"');

    // One-click single promotion
    await pg.click('[data-testid="promo-tab-eligible"]');
    await pg.click('[data-testid="promo-row"][data-roll="QAP-ELIG"] [data-testid="promo-apply"]');
    await pg.waitForFunction(() => /decision recorded/i.test(document.querySelector('[data-roll="QAP-ELIG"]')?.innerText || ''), null, T).catch(() => {});
    const st = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-ELIG'] } });
    ok(st?.currentSemester === 2, 'one click: QAP-ELIG promoted to semester 2');
    const regs = await prisma.courseRegistration.count({ where: { studentId: ids['QAP-ELIG'], offering: { course: { semester: { number: 2 } } } } });
    ok(regs === 4, `auto-enrolled in ${regs}/4 semester-2 courses`);

    // Bulk promotion
    // Bulk on the Failed-courses list: select QAP-FAIL (promote) + QAP-RPT (repeat).
    await pg.click('[data-testid="promo-tab-failed"]');
    await pg.waitForSelector('[data-testid="promo-row"][data-roll="QAP-FAIL"] [data-testid="promo-check"]', T);
    await pg.check('[data-testid="promo-row"][data-roll="QAP-FAIL"] [data-testid="promo-check"]');
    await pg.check('[data-testid="promo-row"][data-roll="QAP-RPT"] [data-testid="promo-check"]');
    await pg.click('[data-testid="promo-bulk"]');
    await pg.waitForTimeout(3000);
    const both = await until(async () => {
      const a = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-FAIL'] } });
      const b = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-RPT'] } });
      return a?.currentSemester === 2 && b && b.currentSemester === 1;
    });
    ok(both, 'bulk (failed list): QAP-FAIL promoted with failed course, QAP-RPT repeats semester 1');
    // Select-all on the Eligible list (QAP-PROB remaining) → bulk.
    await pg.click('[data-testid="promo-tab-eligible"]');
    await pg.waitForSelector('[data-testid="promo-select-all"]', T);
    await pg.click('[data-testid="promo-select-all"]');
    await pg.click('[data-testid="promo-bulk"]');
    await pg.waitForTimeout(3000);
    const sp = await until(async () => { const x = await prisma.lmsStudentStanding.findUnique({ where: { studentId: ids['QAP-PROB'] } }); return x?.currentSemester === 2 ? x : null; });
    ok(sp?.currentSemester === 2 && sp?.probations === 1, 'bulk: QAP-PROB promoted with probation');

    // Special exam tab
    await pg.click('[data-testid="promo-tab-special"]');
    const specialCount = await prisma.lmsSpecialExamCandidate.count({ where: { studentId: { in: Object.values(ids) } } });
    if (specialCount) {
      await pg.waitForSelector('[data-testid="special-row"]', T);
      ok(/EN-101/.test(await pg.innerText('[data-testid="special-row"]')) && /failed/i.test(await pg.innerText('[data-testid="special-row"]')), 'Special Exam tab lists EN-101 as Failed');
      await pg.click('[data-testid="special-enroll"]');
      await pg.waitForTimeout(2000);
      const c = await prisma.lmsSpecialExamCandidate.findFirst({ where: { studentId: { in: Object.values(ids) } } });
      ok(c?.status === 'ENROLLED', 'enrolled for the Special Exam from the UI');
    } else ok(false, 'Special Exam candidate created by promotion');
    await pg.click('[data-testid="promo-tab-history"]');
    await pg.waitForSelector('[data-testid="history-row"]', T);
    ok((await pg.$$('[data-testid="history-row"]')).length >= 2, 'History tab lists decisions');
    await pg.screenshot({ path: `${SHOTS}/bt-focal-promotions.png`, fullPage: true });
    const fe = realErrors(F.errors);
    ok(fe.length === 0, `focal: no page errors${fe.length ? ` ${fe.slice(0, 2).join(' | ').slice(0, 300)}` : ''}`);

    // Student sees the promotion notice
    const S = await openAs(browser, 'QAP-ELIG', '/student/dashboard', 'Qa@12345');
    await S.page.waitForTimeout(3000);
    const n = await prisma.lmsNotification.count({ where: { userId: ids['QAP-ELIG'], title: 'Semester promotion' } });
    ok(n === 1, 'student received the promotion notification');
    await S.ctx.close();
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
