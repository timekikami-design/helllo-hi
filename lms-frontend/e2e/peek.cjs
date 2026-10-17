// Usage: node peek.cjs <username> <path> [screenshot]
const { chromium, openAs, realErrors } = require('./lib.cjs');
(async () => {
  const [u, p, shot] = process.argv.slice(2);
  const b = await chromium.launch();
  const T = await openAs(b, u, p);
  await T.page.waitForTimeout(9000);
  console.log('URL', T.page.url());
  console.log((await T.page.innerText('main').catch(() => T.page.innerText('body'))).replace(/\s+/g, ' ').slice(0, 500));
  console.log('ERR', realErrors(T.errors).slice(0, 5));
  if (shot) await T.page.screenshot({ path: shot, fullPage: true });
  await b.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
