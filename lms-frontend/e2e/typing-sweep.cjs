// Issue 2 sweep: visit many LMS pages per role and type a sentence key-by-key
// into every visible, enabled text field on the page (inputs + textareas),
// reporting any field that loses focus or drops characters. Read-only:
// nothing is submitted; typed values are cleared afterwards.
//   node e2e/typing-sweep.cjs [username ...]
const { chromium, openAs, counter } = require('./lib.cjs');

const TEXT = 'type a whole sentence';
const PAGES = {
  'ADCS-001': ['/student/settings', '/student/messages', '/student/notes', '/student/ai-tutor', '/student/appeals', '/student/library', '/student/withdrawal', '/student/announcements'],
  teacher1: ['/teacher/announcements', '/teacher/messages', '/teacher/students', '/teacher/settings', '/teacher/library', '/teacher/appeals', '/teacher/history'],
  coord1: ['/admin/degrees', '/admin/courses', '/admin/teachers', '/admin/students', '/admin/announcements', '/admin/settings', '/admin/quick-messages', '/admin/enrollments'],
  exam1: ['/exam/settings', '/exam/datesheets', '/exam/ufm', '/exam/gazette', '/exam/grievances'],
  provost1: ['/provost/fee-concessions', '/provost/fee-records', '/provost/defaulters', '/provost/settings', '/provost/students', '/provost/fee-approvals'],
  focal_demo: ['/focal/student-search', '/focal/enrollments', '/focal/quick-messages', '/focal/settings', '/focal/promotions'],
};
const PW = { focal_demo: 'Focal@123' };

(async () => {
  const { ok, done } = counter();
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    for (const [user, paths] of Object.entries(PAGES)) {
      if (only.length && !only.includes(user)) continue;
      const s = await openAs(browser, user, null, PW[user]);
      const p = s.page;
      for (const path of paths) {
        try {
          await p.goto(require('./lib.cjs').UI + path, { waitUntil: 'domcontentloaded' });
          await p.waitForTimeout(4000);
          if (new URL(p.url()).pathname === '/login') { ok(false, `${user} ${path}: redirected to login`); continue; }
          const fields = p.locator('main input:visible:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=number]):not([type=date]):not([type=time]):not([type=datetime-local]):not([type=color]):not([type=range]):not([disabled]):not([readonly]), main textarea:visible:not([disabled]):not([readonly])');
          const n = Math.min(await fields.count(), 6);
          if (!n) { console.log(`  -   ${user} ${path}: no text fields on initial view`); continue; }
          for (let i = 0; i < n; i += 1) {
            const f = fields.nth(i);
            const before = await f.inputValue().catch(() => '');
            await f.click({ timeout: 5000 });
            await p.keyboard.press('End'); // type after any pre-filled value
            const h = await f.elementHandle();
            let lost = -1;
            for (let k = 0; k < TEXT.length; k += 1) {
              await p.keyboard.type(TEXT[k], { delay: 10 });
              if (!(await p.evaluate((x) => document.activeElement === x && x.isConnected, h))) { lost = k; break; }
            }
            const val = lost === -1 ? await f.inputValue() : '';
            const label = (await f.getAttribute('placeholder')) || (await f.getAttribute('aria-label')) || (await f.getAttribute('id')) || `#${i + 1}`;
            ok(lost === -1 && val.endsWith(TEXT), `${user} ${path} [${label}]: continuous typing${lost >= 0 ? ` — LOST FOCUS after char ${lost + 1}` : ''}`);
            if (lost === -1) await f.fill(before).catch(() => {});
          }
        } catch (e) { ok(false, `${user} ${path}: ${e.message.split('\n')[0]}`); }
      }
      await s.ctx.close();
    }
  } finally { await browser.close(); done(); }
})();
