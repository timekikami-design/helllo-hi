// Issues 2 & 3 check: type a full sentence key-by-key into text fields and
// assert (a) focus never leaves the field and (b) the full value is kept.
//   node e2e/typing.cjs [scenario ...]
const { chromium, openAs, counter } = require('./lib.cjs');

const SENTENCE = 'Associate Degree in Computer Science and Data';

// Type char-by-char; after every key confirm the same element still has focus.
async function typeAndCheck(p, locator, label, ok) {
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout: 90000 });
  await el.click();
  await el.fill('');
  const handle = await el.elementHandle();
  let lost = -1;
  for (let i = 0; i < SENTENCE.length; i += 1) {
    await p.keyboard.type(SENTENCE[i], { delay: 15 });
    const same = await p.evaluate((h) => document.activeElement === h && h.isConnected, handle);
    if (!same) { lost = i; break; }
  }
  const val = await el.inputValue().catch(() => '');
  ok(lost === -1, `${label}: focus kept for all ${SENTENCE.length} keystrokes${lost >= 0 ? ` (lost after char ${lost + 1})` : ''}`);
  ok(val === SENTENCE, `${label}: full sentence kept${val === SENTENCE ? '' : ` (got "${val}")`}`);
}

const SCENARIOS = {
  // Issue 3 — Course Coordinator → Programs → New / Edit Program
  async programs(browser, ok) {
    const { page: p, ctx } = await openAs(browser, 'coord1', '/admin/degrees');
    await p.getByRole('button', { name: /new program|add program|create program/i }).first().click();
    const dlg = p.getByRole('dialog');
    await dlg.waitFor();
    const inputs = dlg.locator('input:not([type=number]):not([disabled])');
    const n = await inputs.count();
    for (let i = 0; i < n; i += 1) await typeAndCheck(p, inputs.nth(i), `New Program field ${i + 1}/${n}`, ok);
    await dlg.getByRole('button', { name: /close dialog/i }).click();
    // Edit Program
    const edit = p.getByRole('button', { name: /^edit$/i });
    if (await edit.count()) {
      await edit.first().click();
      const d2 = p.getByRole('dialog');
      await d2.waitFor();
      await typeAndCheck(p, d2.locator('input:not([type=number]):not([disabled])').first(), 'Edit Program name', ok);
      await d2.getByRole('button', { name: /close dialog/i }).click();
    } else console.log('SKIP Edit Program: this account has no programs (Edit uses the same Modal + inputs as New)');
    await ctx.close();
  },
  async examSettings(browser, ok) {
    const { page: p, ctx } = await openAs(browser, 'exam1', '/exam/settings');
    await typeAndCheck(p, p.locator('input[placeholder="Full name"]'), 'Exam settings: Name', ok);
    await typeAndCheck(p, p.locator('input[placeholder="Father\'s name"]'), 'Exam settings: Father name', ok);
    await ctx.close();
  },
  async studentSettings(browser, ok) {
    const { page: p, ctx } = await openAs(browser, 'ADCS-001', '/student/settings');
    const f = p.locator('main input[type=text], main input:not([type]), main textarea').filter({ hasNot: p.locator('[disabled]') });
    await typeAndCheck(p, f.first(), 'Student settings: first text field', ok);
    await ctx.close();
  },
  async teacherAnnouncement(browser, ok) {
    const { page: p, ctx } = await openAs(browser, 'teacher1', '/teacher/announcements');
    const btn = p.getByRole('button', { name: /new|create|post|add/i }).first();
    if (await btn.count()) await btn.click().catch(() => {});
    const field = p.locator('[role=dialog] input[type=text], [role=dialog] input:not([type]), [role=dialog] textarea, main textarea, main input[type=text]');
    await typeAndCheck(p, field.first(), 'Teacher announcement: title/body', ok);
    await ctx.close();
  },
  async messages(browser, ok) {
    const { page: p, ctx } = await openAs(browser, 'teacher1', '/teacher/messages');
    const field = p.locator('main textarea, main input[type=text], main input:not([type])');
    await typeAndCheck(p, field.last(), 'Teacher messages: compose', ok);
    await ctx.close();
  },
};

(async () => {
  const { ok, done } = counter();
  const pick = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      if (pick.length && !pick.includes(name)) continue;
      console.log(`\n== ${name}`);
      try { await fn(browser, ok); } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
    }
  } finally { await browser.close(); done(); }
})();
