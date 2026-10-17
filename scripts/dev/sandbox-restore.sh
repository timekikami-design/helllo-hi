#!/bin/bash
# ------------------------------------------------------------------
# Dev-only: rebuild a fresh local sandbox (env, deps, DB + seeds,
# backend + LMS frontend under pm2, Playwright for e2e checks).
# Not used in production. Usage: bash scripts/dev/sandbox-restore.sh
# ------------------------------------------------------------------
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
[ -f backend/.env ] || printf 'DATABASE_URL="file:./dev.db"\nJWT_SECRET="dev-secret-local-sandbox"\nPORT=5000\nFRONTEND_URL="http://localhost:3000"\n' > backend/.env
grep -q '^.patches/' .git/info/exclude 2>/dev/null || echo ".patches/" >> .git/info/exclude
mkdir -p .patches
(cd backend && npm install --cache ~/.npmcache --no-audit --no-fund >/tmp/npm.log 2>&1 \
  && npx prisma db push --skip-generate >/tmp/push.log 2>&1 && npx prisma generate >/tmp/gen.log 2>&1)
for f in seed seedLmsAcademic seedLmsRoles seedUniversityDataset seedDemoAccounts; do
  (cd backend && timeout 300 node prisma/$f.js >/tmp/seed_$f.log 2>&1) || echo "seed FAIL $f"
done
pm2 start ecosystem.config.cjs --only aust-backend >/dev/null 2>&1 || pm2 restart aust-backend >/dev/null
(cd lms-frontend && npm install --cache ~/.npmcache --no-audit --no-fund >/tmp/npmfe.log 2>&1)
pm2 start ecosystem.config.cjs --only lms-frontend >/dev/null 2>&1 || true
if [ "${SKIP_PLAYWRIGHT:-0}" != "1" ]; then
  (cd .patches && echo '{"name":"pwt","private":true}' > package.json \
    && npm install --cache ~/.npmcache --no-audit --no-fund playwright@1.48.2 >/tmp/pw.log 2>&1 \
    && npx playwright install chromium >/tmp/pwi.log 2>&1)
  (sudo apt-get update -qq >/dev/null 2>&1; sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libatspi2.0-0 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 libnss3 libcups2 libdrm2 >/tmp/apt.log 2>&1) || true
fi
echo RESTORED
