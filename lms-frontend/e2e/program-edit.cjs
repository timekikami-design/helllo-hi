// Issue 3 — Edit Program (scratch DB only): create a program through the real
// New Program form, then open Edit and type key-by-key into every field.
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/program-edit.cjs
const { chromium, openAs, counter, realErrors } = require('./lib.cjs');
if (process.env.QA_SCRATCH !== '1') { console.error('Run via browserScratch.sh (scratch DB only).'); process.exit(1); }
const SENTENCE = 'Edited program name typed one key at a time';

(async () => {
  const { ok, done } = counter();
  // Scratch-DB fixture: coordinators only see programs of their own department,
  // and the seeded coord1 has none — give it one so the created program is listed.
  {
    const path = require('path');
    const prisma = require(path.join(__dirname, '../../backend/src/utils/prisma'));
    const u = await prisma.lmsUser.findFirst({ where: { username: 'coord1' } });
    await prisma.lmsStudentProfile.upsert({ where: { lmsUserId: u.id }, update: { department: 'QA Department' }, create: { lmsUserId: u.id, fullName: 'Coordinator One', fatherName: '-', cnic: '00000-0000000-0', dateOfBirth: '1990-01-01', gender: 'Male', program: '-', programShortForm: '-', department: 'QA Department', rollNumber: 'coord1', registrationNumber: 'coord1', session: '-', enrollmentDate: new Date() } });
    await prisma.$disconnect();
  }
  const browser = await chromium.launch();
  try {
    const { page: p, ctx, errors } = await openAs(browser, 'coord1', '/admin/degrees');
    await p.getByRole('button', { name: /new program|add program|create program/i }).first().click();
    const dlg = p.getByRole('dialog');
    await dlg.waitFor();
    const inputs = dlg.locator('input:not([type=number]):not([disabled])');
    await inputs.nth(0).click(); await p.keyboard.type('QA Edit Program', { delay: 10 });
    await inputs.nth(1).click(); await p.keyboard.type('QAEDIT', { delay: 10 });
    const dept = dlg.locator('input[placeholder*="epartment" i], input[name=department]');
    if (await dept.count()) await dept.first().fill('QA Department');
    else await inputs.nth(3).fill('QA Department');
    await dlg.getByRole('button', { name: /create|save/i }).last().click();
    await p.waitForTimeout(2500);
    const edit = p.getByRole('button', { name: /^edit$/i });
    ok((await edit.count()) > 0, 'program created via New Program form');
    await edit.first().click();
    const d2 = p.getByRole('dialog');
    await d2.waitFor();
    const fields = d2.locator('input:not([type=number]):not([disabled])');
    const n = await fields.count();
    for (let i = 0; i < n; i += 1) {
      const f = fields.nth(i);
      await f.click(); await p.keyboard.press('End');
      const before = await f.inputValue();
      const h = await f.elementHandle();
      let lost = -1;
      for (let k = 0; k < SENTENCE.length; k += 1) {
        await p.keyboard.type(SENTENCE[k], { delay: 10 });
        if (!(await p.evaluate((x) => document.activeElement === x && x.isConnected, h))) { lost = k; break; }
      }
      const val = await f.inputValue();
      ok(lost === -1, `Edit Program field ${i + 1}/${n}: focus kept for all ${SENTENCE.length} keystrokes${lost >= 0 ? ` (lost after char ${lost + 1})` : ''}`);
      ok(val === before + SENTENCE, `Edit Program field ${i + 1}/${n}: full text kept`);
    }
    // Save the edit and confirm it persisted.
    // Restore the typed fields (Department decides coordinator scope), rename, save.
    for (let i = 1; i < n; i += 1) await fields.nth(i).fill(i === n - 1 ? 'QA Department' : 'QAEDIT');
    await fields.nth(0).fill('QA Edit Program Renamed');
    await d2.getByRole('button', { name: /save|update/i }).last().click();
    await p.waitForTimeout(2500);
    ok(await p.getByText('QA Edit Program Renamed').first().isVisible().catch(() => false), 'edited program name saved and shown');
    const errs = realErrors(errors);
    ok(errs.length === 0, `no console errors${errs.length ? `: ${errs[0]}` : ''}`);
    await ctx.close();
  } catch (e) { ok(false, e.message.split('\n')[0]); }
  finally { await browser.close(); done(); }
})();
