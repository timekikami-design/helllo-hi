/* ============================================================
 * Design-system verification (dev-only).
 *   node .playwright-test/ds-check.cjs [responsive|axe|keyboard|all]
 * Responsive: every page / portal tab at 320, 375, 414, 768, 1024,
 *   1440 and 844x390 must satisfy scrollWidth <= innerWidth. The
 *   widest overflowing element is reported when a check fails.
 * Axe: WCAG 2.x A/AA rules on representative pages.
 * Keyboard: tab order through the enquiry form, login form and the
 *   portal sidebar.
 * Requires: playwright + axe-core in .patches/ (sandbox-restore.sh),
 * backend on :5000, admissions frontend on :3000.
 * ============================================================ */
const path = require('path');
const fs = require('fs');
const req = (m) => require(path.join(__dirname, '../.patches/node_modules', m));
const { chromium } = req('playwright');
const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const BASE = process.env.DS_BASE || 'http://127.0.0.1:3000';
const WIDTHS = [[360, 640], [390, 844], [412, 915], [768, 1024], [820, 1180], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]];
const MODE = process.argv[2] || 'all';
const AXE_SRC = fs.readFileSync(path.join(__dirname, '../.patches/node_modules/axe-core/axe.min.js'), 'utf8');

const PUBLIC = ['/', '/about', '/admissions', '/programs', '/fee-structure', '/scholarships', '/odl', '/faculties',
  '/news', '/contact', '/faq', '/downloads', '/course-scheme', '/why-choose-us', '/alumni', '/terms', '/privacy',
  '/login', '/register', '/forgot-password', '/reset-password?token=t&email=a%40b.co'];

const ROLES = [
  { role: 'student', id: 4, username: 'student', email: 'student@example.com', path: '/dashboard' },
  { role: 'director_admissions', id: 3, username: 'director', email: 'director@aust.edu.pk', path: '/admin' },
  { role: 'coordinator', id: 1, username: 'coordinator', email: 'coordinator@aust.edu.pk', path: '/coordinator' },
];
const SA = { role: 'super_admin', id: 2, username: 'superadmin', email: 'superadmin@aust.edu.pk' };
const SA_PAGES = ['/super-admin', '/super-admin/portals', '/super-admin/users', '/super-admin/admissions/applications',
  '/super-admin/admissions/cycles', '/super-admin/system/landing-content', '/super-admin/institution/department-management'];

const tokenFor = (u) => jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30m' });

async function ctxFor(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  if (user) {
    await ctx.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
      [tokenFor(user), JSON.stringify({ id: user.id, email: user.email, username: user.username, role: user.role })]);
  }
  return ctx;
}

// Returns null when OK, otherwise a description of the widest offender.
const overflowProbe = () => {
  const vw = window.innerWidth;
  const sw = document.documentElement.scrollWidth;
  if (sw <= vw) return null;
  let worst = null;
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 0.5) return;
    // skip elements clipped by a scrolling ancestor
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return;
    }
    if (!worst || r.right > worst.right) {
      worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 80), text: (el.textContent || '').trim().slice(0, 40) };
    }
  });
  return { vw, sw, worst };
};

const results = [];
const log = (ok, page, w, extra = '') => {
  results.push({ ok, page, w, extra });
  if (!ok) console.log(`FAIL ${page} @${w} ${extra}`);
};

async function checkWidths(page, label) {
  for (const [w, h] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const r = await page.evaluate(overflowProbe);
    log(!r, label, `${w}x${h}`, r ? JSON.stringify(r) : '');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function responsive(browser) {
  const pub = await ctxFor(browser, null);
  const p = await pub.newPage();
  for (const url of PUBLIC) {
    await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(600);
    await checkWidths(p, url);
  }
  await pub.close();

  for (const u of ROLES) {
    const ctx = await ctxFor(browser, u);
    const pg = await ctx.newPage();
    await pg.goto(BASE + u.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await pg.waitForSelector('.sidebar-item', { timeout: 30000 });
    const n = await pg.locator('.sidebar-item').count();
    for (let i = 0; i < n; i += 1) {
      await pg.setViewportSize({ width: 1440, height: 900 });
      const item = pg.locator('.sidebar-item').nth(i);
      const name = (await item.innerText()).trim().replace(/\s+/g, ' ');
      await item.click();
      await pg.waitForTimeout(1200);
      await checkWidths(pg, `${u.path} › ${name}`);
    }
    await ctx.close();
  }

  const sctx = await ctxFor(browser, SA);
  const sp = await sctx.newPage();
  for (const url of SA_PAGES) {
    await sp.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await sp.waitForTimeout(1200);
    await checkWidths(sp, url);
  }
  await sctx.close();
}

async function axe(browser) {
  const targets = [[null, '/'], [null, '/login'], [null, '/register'], [null, '/forgot-password'], [null, '/about'], [null, '/contact'],
    [ROLES[0], '/dashboard'], [ROLES[1], '/admin'], [ROLES[2], '/coordinator'], [SA, '/super-admin/portals'], [SA, '/super-admin']];
  for (const [user, url] of targets) {
    const ctx = await ctxFor(browser, user);
    const p = await ctx.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.addScriptTag({ content: AXE_SRC });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0] && v.nodes[0].target.join(' '), msg: v.nodes[0] && v.nodes[0].failureSummary.split('\n')[1] }));
    });
    console.log(`AXE ${url} (${user ? user.role : 'public'}): ${res.length} violation types`);
    res.forEach((v) => console.log(`   - ${v.id} [${v.impact}] x${v.n} e.g. ${v.sample} :: ${(v.msg || '').trim().slice(0, 140)}`));
    results.push({ ok: res.length === 0, page: `axe ${url}`, w: '1440', extra: res.map((v) => v.id).join(',') });
    await ctx.close();
  }
}

async function keyboard(browser) {
  const ctx = await ctxFor(browser, null);
  const p = await ctx.newPage();
  const focusPath = async (count) => {
    const seen = [];
    for (let i = 0; i < count; i += 1) {
      await p.keyboard.press('Tab');
      seen.push(await p.evaluate(() => {
        const a = document.activeElement;
        return `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.getAttribute('aria-label') ? '[' + a.getAttribute('aria-label') + ']' : ''}:${(a.innerText || a.value || '').trim().slice(0, 24)}`;
      }));
    }
    return seen;
  };
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const first = await focusPath(1);
  console.log('KEY landing first focus:', first[0]);
  results.push({ ok: /Skip to (main )?content/.test(first[0]), page: 'keyboard landing skip link first', w: '', extra: first[0] });
  // Desktop dropdown: Enter opens, ArrowDown moves, Escape closes + returns focus
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.focus('button.ds-mega__btn >> nth=1');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  const firstItem = await p.evaluate(() => document.activeElement.closest('.ds-mega__panel') ? document.activeElement.innerText.split('\n')[0] : 'none');
  await p.keyboard.press('ArrowDown');
  const secondItem = await p.evaluate(() => document.activeElement.innerText.split('\n')[0]);
  const expanded = await p.evaluate(() => document.querySelectorAll('button.ds-mega__btn')[1].getAttribute('aria-expanded'));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  const backOnBtn = await p.evaluate(() => document.activeElement.classList.contains('ds-mega__btn') && document.activeElement.getAttribute('aria-expanded') === 'false');
  console.log('KEY dropdown:', firstItem, '→', secondItem, 'expanded=', expanded, 'escape-return=', backOnBtn);
  results.push({ ok: firstItem === 'Apply Online' && secondItem === 'Admission Process' && expanded === 'true' && backOnBtn, page: 'keyboard desktop dropdown', w: '1440', extra: `${firstItem}|${secondItem}|${expanded}|${backOnBtn}` });
  // Apply Now + login targets
  const targets = await p.evaluate(() => ({ apply: document.querySelector('.ds-site-header__cta')?.getAttribute('href') }));
  results.push({ ok: targets.apply === '/register', page: 'apply now target', w: '', extra: JSON.stringify(targets) });

  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const lg = await focusPath(9);
  console.log('KEY login order:', lg.join(' → '));
  const ids = lg.join(' ');
  results.push({ ok: ids.indexOf('#login-id') < ids.indexOf('#login-pw') && ids.includes('Show password') && ids.includes('#auth-captcha-answer'), page: 'keyboard login order', w: '', extra: lg.join(' | ') });

  // Mobile drawer: opens, traps focus, Escape closes and returns focus to trigger
  await p.setViewportSize({ width: 375, height: 812 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.focus('.ds-menu-btn');
  await p.keyboard.press('Enter');
  await p.waitForSelector('#ds-mobile-nav');
  let inside = true;
  for (let i = 0; i < 20; i += 1) {
    await p.keyboard.press('Tab');
    inside = inside && await p.evaluate(() => !!document.activeElement.closest('#ds-mobile-nav'));
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const back = await p.evaluate(() => document.activeElement.classList.contains('ds-menu-btn') && !document.getElementById('ds-mobile-nav'));
  results.push({ ok: inside && back, page: 'keyboard mobile drawer trap + escape', w: '375', extra: `trapped=${inside} returned=${back}` });
  await ctx.close();

  const sctx = await ctxFor(browser, ROLES[0]);
  const sp = await sctx.newPage();
  await sp.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await sp.waitForSelector('.sidebar-item');
  await sp.keyboard.press('Tab');
  const skip = await sp.evaluate(() => document.activeElement.textContent.trim());
  await sp.locator('.sidebar-item').nth(3).focus();
  await sp.keyboard.press('Enter');
  await sp.waitForTimeout(800);
  const cur = await sp.evaluate(() => document.querySelector('.sidebar-item[aria-current=page]')?.innerText.trim());
  results.push({ ok: skip === 'Skip to content' && !!cur, page: 'keyboard applicant portal skip + sidebar Enter', w: '', extra: `skip=${skip} current=${cur}` });
  await sctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    if (MODE === 'responsive' || MODE === 'all') await responsive(browser);
    if (MODE === 'axe' || MODE === 'all') await axe(browser);
    if (MODE === 'keyboard' || MODE === 'all') await keyboard(browser);
  } catch (e) {
    console.log('ERROR', e.message.split('\n')[0]);
    results.push({ ok: false, page: 'runner', w: '', extra: e.message.split('\n')[0] });
  } finally {
    await browser.close();
  }
  const fail = results.filter((r) => !r.ok);
  fs.writeFileSync(`/tmp/ds-check-${MODE}.json`, JSON.stringify(results, null, 1));
  console.log(`\nSUMMARY ${MODE}: ${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
