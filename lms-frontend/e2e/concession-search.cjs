// Issue 5 — Provost → Concessions & Instalments universal search (scratch DB).
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/concession-search.cjs
const path = require('path');
const { chromium, openAs, counter, realErrors } = require('./lib.cjs');
if (process.env.QA_SCRATCH !== '1') { console.error('Run via browserScratch.sh (scratch DB only).'); process.exit(1); }

(async () => {
  const { ok, done } = counter();
  // Fixture: two students with known identity fields, one concession each.
  const prisma = require(path.join(__dirname, '../../backend/src/utils/prisma'));
  const provost = await prisma.lmsUser.findFirst({ where: { username: 'provost1' } });
  const studs = await prisma.lmsUser.findMany({ where: { role: 'Student', profile: { isNot: null } }, include: { profile: true }, take: 2 });
  const A = studs[0]; const B = studs[1];
  await prisma.lmsStudentProfile.update({ where: { lmsUserId: A.id }, data: { cnic: '35202-1234567-1', phone: '+92 300 1234567', email: 'alpha.search@example.com' } });
  await prisma.lmsStudentProfile.update({ where: { lmsUserId: B.id }, data: { cnic: '61101-7654321-9', phone: '0333-7654321', email: 'beta.search@example.com' } });
  await prisma.lmsFeeConcession.deleteMany({});
  await prisma.lmsFeeConcession.create({ data: { studentId: A.id, kind: 'CONCESSION', title: 'QA alpha concession', percent: 10, grantedById: provost.id } });
  await prisma.lmsFeeConcession.create({ data: { studentId: B.id, kind: 'SCHOLARSHIP', title: 'QA beta scholarship', percent: 20, grantedById: provost.id } });
  const aName = A.profile.fullName; const aRoll = A.profile.rollNumber; const aReg = A.profile.registrationNumber;
  await prisma.$disconnect();

  const browser = await chromium.launch();
  try {
    const { page: p, ctx, errors } = await openAs(browser, 'provost1', '/provost/fee-concessions');
    const rows = p.locator('[data-testid=conc-row]');
    await rows.first().waitFor({ timeout: 30000 });
    const box = p.locator('[data-testid=conc-search]');
    const total = await rows.count();
    ok(total === 2, `full list shows both records (${total})`);

    const expectOnly = async (q, label, expectA = true) => {
      await box.fill('');
      await box.click();
      await p.keyboard.type(q, { delay: 15 });
      ok(await box.evaluate((e) => document.activeElement === e), `${label}: focus kept while typing`);
      await p.waitForTimeout(700);
      const n = await rows.count();
      const txt = n ? await rows.first().innerText() : '';
      ok(n === 1 && txt.includes(expectA ? aName : 'QA beta'), `${label} "${q}" → 1 match (${n})`);
    };
    await expectOnly(aName.slice(0, 5).toUpperCase(), 'name, partial + uppercase');
    await expectOnly(`  ${aRoll}  `, 'roll number with surrounding spaces');
    if (aReg) await expectOnly(aReg, 'ID card / registration number');
    await expectOnly('ALPHA.search@', 'email, partial + mixed case');
    await expectOnly('3520212345671', 'CNIC without dashes');
    await expectOnly('35202-1234567', 'CNIC with dashes');
    await expectOnly('03001234567', 'phone with 0 prefix');
    await expectOnly('+92-300-1234567', 'phone with +92 and dashes');
    await expectOnly('300 1234', 'phone partial with space');
    await expectOnly('923337654321', 'phone 92 prefix (other student)', false);

    // Debounce: the list must not filter on the very first keystroke.
    await box.fill(''); await p.waitForTimeout(500);
    await box.click(); await p.keyboard.type('zz', { delay: 10 });
    const immediate = await rows.count();
    await p.waitForTimeout(700);
    ok(immediate === 2, `debounced: list unchanged right after typing (${immediate})`);
    ok(await p.getByText('No records found').isVisible(), '"No records found" for a non-matching search');
    await box.fill('');
    await p.waitForTimeout(700);
    ok((await rows.count()) === 2, 'clearing the search restores the full list');

    // Type filter still combines with search.
    await p.locator('select').filter({ hasText: 'All types' }).selectOption('SCHOLARSHIP');
    await p.waitForTimeout(1500);
    await box.click(); await p.keyboard.type(aName.slice(0, 5), { delay: 10 });
    await p.waitForTimeout(700);
    ok(await p.getByText('No records found').isVisible(), 'search + type filter combine (alpha is not a scholarship)');

    // Backend list endpoint honours the same rules.
    const token = await p.evaluate(() => localStorage.getItem('lms_token'));
    const api = require('./lib.cjs').API;
    const hit = async (q) => (await (await fetch(`${api}/api/lms/academic/provost/finance/concessions?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } })).json()).items.length;
    ok((await hit('3520212345671')) === 1 && (await hit('0300-1234567')) === 1 && (await hit('nomatch-xyz')) === 0, 'API ?q= matches CNIC/phone and returns none for no match');

    const errs = realErrors(errors);
    ok(errs.length === 0, `no console errors${errs.length ? `: ${errs[0]}` : ''}`);
    await ctx.close();
  } catch (e) { ok(false, e.message.split('\n')[0]); }
  finally { await browser.close(); done(); }
})();
