// Round 3 checks: desktop hero fits one screen, mobile header brand does not
// break, Login opens on click and navigates, route skeletons render.
// Usage: node .playwright-test/round3-check.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.patches', 'node_modules', 'playwright'));
const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const out = [];
const rec = (name, ok, info = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);

(async () => {
  const b = await chromium.launch();

  // 1) Desktop hero fits in one screen and uses a sharp source
  for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const hx = document.querySelector('.hx');
      const cta = document.querySelector('.hx__cta');
      const img = document.querySelector('.hx__img');
      return {
        hxH: hx.getBoundingClientRect().height,
        ctaBottom: cta.getBoundingClientRect().bottom,
        cur: (img.currentSrc || '').split('/').pop(),
        nat: img.naturalWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    rec(`hero fits ${w}x${h}`, r.hxH <= h + 1 && r.ctaBottom <= h && !r.overflow && r.nat >= w,
      `hero ${Math.round(r.hxH)}px, CTA bottom ${Math.round(r.ctaBottom)}px, image ${r.cur} (${r.nat}px wide)`);
    await p.screenshot({ path: `${SHOTS}/hero-${w}x${h}.png` });
    await p.close();
  }

  // 2) Mobile header: brand on one line, no horizontal overflow
  for (const [w, h] of [[390, 844], [360, 640], [320, 640], [600, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const name = document.querySelector('.ds-brand__name');
      const vis = [...name.children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent);
      const row = document.querySelector('.ds-site-header__row').getBoundingClientRect();
      return { vis, nameH: name.getBoundingClientRect().height, rowH: row.height, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    rec(`mobile header ${w}x${h}`, r.nameH < 36 && !r.overflow,
      `brand "${r.vis.join('')}", brand height ${Math.round(r.nameH)}px, header row ${Math.round(r.rowH)}px`);
    await p.screenshot({ path: `${SHOTS}/mobile-${w}x${h}.png` });
    await p.close();
  }

  // 3) Login
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const btn = p.locator('.ds-site-header button', { hasText: 'Login' }).first();
    await btn.hover(); await p.waitForTimeout(250);
    await btn.click(); await p.waitForTimeout(400);
    const expanded = await btn.getAttribute('aria-expanded');
    rec('Login (desktop): hover then click keeps menu open', expanded === 'true', `aria-expanded=${expanded}`);
    await p.screenshot({ path: `${SHOTS}/login-open.png` });
    await p.locator('.ds-site-header a[href="/login"]').first().click();
    await p.waitForURL('**/login', { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(800);
    const hasForm = await p.locator('input[type="password"]').count();
    rec('Login (desktop): menu item opens the /login page', p.url().endsWith('/login') && hasForm > 0, p.url());

    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.mouse.move(5, 600);
    const btn2 = p.locator('.ds-site-header button', { hasText: 'Login' }).first();
    await btn2.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    rec('Login (keyboard): Enter opens menu', (await btn2.getAttribute('aria-expanded')) === 'true');
    await p.close();

    const m = await b.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(BASE + '/', { waitUntil: 'networkidle' });
    const toggle = m.locator('.ds-site-header button[aria-controls]:visible').last();
    let ok = false; let info = 'menu button not found';
    if (await toggle.count()) {
      await toggle.click(); await m.waitForTimeout(400);
      const lb = m.locator('button:visible', { hasText: 'Login' }).last();
      if (await lb.count()) { await lb.click(); await m.waitForTimeout(300); }
      await m.screenshot({ path: `${SHOTS}/mobile-drawer-login.png` });
      const ml = m.locator('a[href="/login"]:visible').first();
      if (await ml.count()) { await ml.click(); await m.waitForTimeout(1200); ok = m.url().endsWith('/login'); info = m.url(); }
      else info = 'no visible /login link in drawer';
    }
    rec('Login (mobile drawer): reaches /login', ok, info);
    await m.close();
  }

  // 4) Skeletons: hold lazy page modules so the Suspense fallback renders
  for (const [route, sel] of [['/about', '.psk--page'], ['/faq', '.psk--page'], ['/programs', '.psk--page'], ['/contact', '.psk--page'], ['/forgot-password', '.psk--auth']]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.route(/\/src\/pages\/.*\.jsx/, async (r) => { await new Promise((x) => setTimeout(x, 1500)); r.continue(); });
    await p.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, route);
    let seen = false;
    try { await p.waitForSelector(sel, { timeout: 1400 }); seen = true; } catch {}
    if (seen) await p.screenshot({ path: `${SHOTS}/skeleton${route.replace(/\//g, '-')}.png` });
    await p.waitForTimeout(3000);
    const gone = (await p.locator('.psk').count()) === 0;
    rec(`skeleton ${route}`, seen && gone, `skeleton shown=${seen}, then replaced by page=${gone}`);
    await ctx.close();
  }

  await b.close();
  console.log(out.join('\n'));
  console.log(`\n${out.filter((l) => l.startsWith('PASS')).length}/${out.length} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
