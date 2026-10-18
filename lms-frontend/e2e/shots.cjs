// lms-frontend/e2e/shots.cjs
// Visual review helper for the redesign: captures pages per role in light
// and dark mode at desktop and mobile widths, and reports horizontal
// overflow + console errors.
//   SHOTS=/tmp/shots node e2e/shots.cjs "ADCS-001:/student,/student/courses" "anon:/login"
const fs = require('fs');
const { chromium, UI, API, realErrors } = require('./lib.cjs');
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');

const OUT = process.env.SHOTS || '/tmp/shots';
const WIDTHS = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const PW = { focal_demo: 'Focal@123', coordinator_demo: 'Coordinator@123' };
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  for (const job of process.argv.slice(2)) {
    const [user, paths] = job.split(':');
    let token = null; let role = null;
    if (user !== 'anon') { const l = await lmsLogin(API, user, PW[user]); token = l.token; role = l.role; }
    for (const theme of THEMES) for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, colorScheme: theme });
      await ctx.addInitScript(([t, r, th]) => {
        if (t) { localStorage.setItem('lms_token', t); localStorage.setItem('lms_role', r); }
        localStorage.setItem('aust_theme', th);
      }, [token, role, theme]);
      const page = await ctx.newPage();
      page.setDefaultTimeout(120000);
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      for (const p of paths.split(',')) {
        await page.goto(UI + p, { waitUntil: 'domcontentloaded', timeout: 180000 });
        await page.waitForTimeout(3500);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const name = `${user}${p.replace(/\//g, '_')}-${theme}-${w}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: process.env.FULL === '1' });
        console.log(`${name} overflowX=${over}`);
      }
      const e = realErrors(errors);
      if (e.length) console.log(`  errors(${user} ${theme} ${w}): ${e.slice(0, 3).join(' | ').slice(0, 400)}`);
      await ctx.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
