// LMS-10 Change 7 (+ Change 4 dialog) browser checks on the Admission app
// (port 3000) against the scratch DB:
//   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/landing-admin.cjs
const { chromium, API, realErrors, counter } = require('./lib.cjs');
if (process.env.QA_SCRATCH !== '1') { console.error('Run via browserScratch.sh (scratch DB only).'); process.exit(1); }
const ADM = process.env.QA_ADM || 'http://localhost:3000';

async function saLogin() {
  const c = await (await fetch(`${API}/api/auth/captcha`)).json();
  const m = String(c.question).match(/(\d+)\s*([+\-×x*])\s*(\d+)/);
  const a = +m[1]; const b = +m[3];
  const answer = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'superadmin', password: 'superadmin123', captchaId: c.captchaId, captchaAnswer: String(answer) }) });
  return r.json();
}

(async () => {
  const { ok, done } = counter();
  const browser = await chromium.launch();
  const newPage = async (ctx) => { const p = await ctx.newPage(); p.setDefaultTimeout(90000); p.setDefaultNavigationTimeout(120000); const errors = []; p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', (e) => errors.push(e.message)); return { p, errors }; };
  try {
    // Landing renders the original text by default.
    const pub = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const { p: land, errors: le } = await newPage(pub);
    await land.goto(ADM + '/', { waitUntil: 'domcontentloaded' });
    await land.locator('h1').first().waitFor();
    await land.waitForTimeout(2500);
    const h1 = (await land.locator('h1').first().innerText()).replace(/\s+/g, ' ');
    ok(/Education is your right,/.test(h1) && /Any Time/.test(h1) && /Anywhere\./.test(h1), `Change 7: landing shows the original heading ("${h1}")`);
    const body0 = await land.locator('body').innerText();
    ok(/Experience a connected digital learning environment/.test(body0), 'Change 7: original hero subtitle shown');
    await land.screenshot({ path: '/tmp/ten-c7-landing-default.png' });

    // Super Admin editor.
    const login = await saLogin();
    ok(!!login.token, 'super admin login');
    const sa = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await sa.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, [login.token, JSON.stringify(login.user)]);
    const { p: ed, errors: ee } = await newPage(sa);
    await ed.goto(ADM + '/super-admin/system/landing-content', { waitUntil: 'domcontentloaded' });
    const field = ed.locator('[data-testid="landing-field-hero.titleLine1"] input');
    await field.waitFor();
    ok((await field.inputValue()) === 'Education is your right,', 'Change 7: editor pre-filled with the current text');
    ok(await ed.getByText('Landing Page Content').count() >= 1, 'Change 7: sidebar entry present');
    await field.fill('Learning without limits,');
    await ed.locator('[data-testid=landing-save-all]').click();
    await ed.waitForTimeout(2000);
    // Already-open landing page updates without a manual refresh (BroadcastChannel / poll).
    let live = false;
    for (let i = 0; i < 25 && !live; i += 1) { await land.waitForTimeout(1000); live = /Learning without limits,/.test(await land.locator('h1').first().innerText()); }
    ok(live, 'Change 7: open landing page shows the saved text without refresh');
    await land.screenshot({ path: '/tmp/ten-c7-landing-edited.png' });
    // Reset to default restores the original.
    await ed.screenshot({ path: '/tmp/ten-c7-editor-saved.png' });
    await ed.locator('[data-testid="landing-field-hero.titleLine1"] button').first().click({ timeout: 15000 });
    await ed.locator('[data-testid=landing-save-all]').click();
    await ed.waitForTimeout(1500);
    const pubRes = await (await fetch(`${API}/api/landing-content`)).json();
    ok(!pubRes.values['hero.titleLine1'], 'Change 7: "Default" restores the original text');
    await ed.screenshot({ path: '/tmp/ten-c7-editor.png' });
    ok(realErrors(ee).length === 0, `Change 7: editor has no console errors ${realErrors(ee).slice(0, 2).join(' | ')}`);
    ok(realErrors(le).length === 0, `Change 7: landing has no console errors ${realErrors(le).slice(0, 2).join(' | ')}`);

    // Change 4 — All Users page loads and shows teachers' departments.
    const { p: us, errors: ue } = await newPage(sa);
    await us.goto(ADM + '/super-admin/users', { waitUntil: 'domcontentloaded' });
    await us.waitForTimeout(6000);
    ok((await us.getByText(/something went wrong/i).count()) === 0, 'Change 4: All Users page renders');
    await us.screenshot({ path: '/tmp/ten-c4-users.png' });
    ok(realErrors(ue).length === 0, `Change 4: All Users no console errors ${realErrors(ue).slice(0, 2).join(' | ')}`);
  } catch (e) {
    ok(false, `unexpected: ${e.message.split('\n')[0]}`);
  } finally { await browser.close(); }
  done();
})();
