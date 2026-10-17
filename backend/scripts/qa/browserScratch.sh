#!/usr/bin/env bash
# Browser-test the UI against a throw-away DB copy: stops the pm2 backend,
# serves a scratch copy of dev.db on :5000, seeds fixtures, runs the
# Playwright script, then restores the normal backend. dev.db is untouched.
#   cd backend && bash scripts/qa/browserScratch.sh ../lms-frontend/e2e/roles.cjs
set -u
cd "$(dirname "$0")/../.."
SCRIPT="${1:?usage: browserScratch.sh <playwright-script.cjs>}"
cp prisma/dev.db prisma/qa-scratch.db
export DATABASE_URL="file:./qa-scratch.db" QA_SCRATCH=1
pm2 stop aust-backend >/dev/null 2>&1
PORT=5000 node src/server.js > /tmp/qa-browser-server.log 2>&1 &
SRV=$!
for _ in $(seq 1 60); do curl -sf http://localhost:5000/api/lms/auth/captcha >/dev/null && break; sleep 1; done
node scripts/qa/seedPromotionFixtures.js
node "$SCRIPT"
CODE=$?
kill "$SRV" 2>/dev/null; wait "$SRV" 2>/dev/null
rm -f prisma/qa-scratch.db prisma/qa-scratch.db-journal
pm2 start aust-backend >/dev/null 2>&1
exit $CODE
