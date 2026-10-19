// Issue 1 regression check: after logout the /login page must load once and
// stay put (no reload loop), for every LMS role. Also covers stale browser
// state (cached profile with no / an invalid token).
//   node e2e/logout-loop.cjs [username ...]
const { chromium, UI, counter } = require('./lib.cjs');

const ACCOUNTS = [
  ['ADCS-001', '/student'], ['teacher1', '/teacher'], ['coord1', '/admin'],
  ['exam1', '/exam'], ['provost1', '/provost'], ['focal_demo', '/focal', 'Focal@123'],
];

async function uiLogin(p, u, pw, base) {
  await p.goto(UI + '/login', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /\d+\s*[+\-×]\s*\d+/.test(document.querySelector('[data-testid="captcha-question"]')?.textContent || ''), null, { timeout: 90000 });
  const q = await p.locator('[data-testid="captcha-question"]').textContent();
  const m = String(q).match(/(\d+)\s*([+\-×])\s*(\d+)/);
  const ans = m[2] === '+' ? +m[1] + +m[3] : m[2] === '-' ? +m[1] - +m[3] : +m[1] * +m[3];
  await p.fill('#username', u);
  await p.fill('#password', pw || 'Lms@1234');
  await p.fill('#captchaAnswer', String(ans));
  await p.getByRole('button', { name: /^sign in$/i }).click();
  await p.waitForURL((url) => url.pathname.startsWith(base), { timeout: 120000 });
}

// Count full document loads of the main frame over `ms`.
async function docLoadsDuring(p, ms) {
  let n = 0;
  const h = (r) => { if (r.isNavigationRequest() && r.frame() === p.mainFrame()) n += 1; };
  p.on('request', h);
  await p.waitForTimeout(ms);
  p.off('request', h);
  return n;
}

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000); p.setDefaultNavigationTimeout(120000);
  return { ctx, p };
}

(async () => {
  const { ok, done } = counter();
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    for (const [u, base, pw] of ACCOUNTS.filter(([x]) => !only.length || only.includes(x))) {
      const { ctx, p } = await newPage(browser);
      try {
        await uiLogin(p, u, pw, base);
        await p.waitForTimeout(3000);
        await p.getByRole('button', { name: /sign out/i }).first().click();
        await p.waitForURL(/\/login$/, { timeout: 30000 });
        const loads = await docLoadsDuring(p, 12000);
        ok(loads === 0, `${u}: /login stable for 12s after logout (document reloads: ${loads})`);
        ok(new URL(p.url()).pathname === '/login', `${u}: still on /login`);
        const st = await p.evaluate(() => [localStorage.getItem('lms_token'), localStorage.getItem('aust_user')]);
        ok(!st[0] && !st[1], `${u}: token and cached profile cleared`);
        await p.fill('#username', 'typed without interruption');
        await p.waitForTimeout(1000);
        ok((await p.inputValue('#username')) === 'typed without interruption', `${u}: login form usable`);
        // Log back in once more — the guard must not bounce.
        await uiLogin(p, u, pw, base);
        ok(new URL(p.url()).pathname.startsWith(base), `${u}: can sign in again after logout`);
      } catch (e) { ok(false, `${u}: ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }

    if (!only.length) {
      // Stale-state scenarios (previous browser session left data behind).
      const bad = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.invalid';
      for (const [label, path, tok] of [['cached profile, no token', '/teacher', null], ['cached profile, invalid token', '/teacher', bad]]) {
        const { ctx, p } = await newPage(browser);
        await ctx.addInitScript(([t]) => {
          if (sessionStorage.getItem('qa_seeded')) return;
          sessionStorage.setItem('qa_seeded', '1');
          localStorage.setItem('aust_user', JSON.stringify({ role: 'teacher', username: 'teacher1' }));
          if (t) { localStorage.setItem('lms_token', t); localStorage.setItem('lms_role', 'Teacher'); }
        }, [tok]);
        let loads = 0;
        p.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === p.mainFrame()) loads += 1; });
        await p.goto(UI + path, { waitUntil: 'load' });
        await p.waitForTimeout(15000);
        ok(new URL(p.url()).pathname === '/login' && loads <= 2, `${label}: settles on /login (document loads: ${loads})`);
        await ctx.close();
      }
    }
  } catch (e) { ok(false, `fatal ${e.message}`); } finally { await browser.close(); done(); }
})();
