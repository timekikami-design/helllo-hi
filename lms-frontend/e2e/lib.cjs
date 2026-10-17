// Shared helpers for the LMS headless-browser checks (Playwright).
// Playwright is NOT a project dependency: install it anywhere and point
// PW_PATH at its node_modules (default: ../../.patches/node_modules).
const path = require('path');
const PW = process.env.PW_PATH || path.join(__dirname, '..', '..', '.patches', 'node_modules', 'playwright');
const { chromium } = require(PW);
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');
const API = process.env.QA_BASE || 'http://localhost:5000';
const UI = process.env.QA_UI || 'http://localhost:3001';

async function openAs(browser, username, p, password) {
  const l = await lmsLogin(API, username, password);
  if (!l.token) throw new Error(`login failed ${username} ${JSON.stringify(l)}`);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([t, r]) => { localStorage.setItem('lms_token', t); localStorage.setItem('lms_role', r); }, [l.token, l.role]);
  const page = await ctx.newPage();
  // The Vite dev server compiles each page on first visit — slow on a
  // low-memory sandbox, so allow generous navigation / action timeouts.
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  if (p) await page.goto(UI + p, { waitUntil: 'domcontentloaded' });
  return { page, ctx, errors, token: l.token };
}
// Expected HTTP errors (e.g. 403 FEE_BLOCKED while a student is blocked)
// and SSE reconnect noise are not application errors.
const realErrors = (errs) => errs.filter((e) => !/favicon|EventSource|ERR_ABORTED|net::ERR|Failed to load resource/.test(e));
function counter() {
  let pass = 0; let fail = 0;
  const ok = (c, m) => { if (c) pass += 1; else fail += 1; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
  const done = () => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };
  return { ok, done };
}
module.exports = { chromium, openAs, API, UI, realErrors, counter };
