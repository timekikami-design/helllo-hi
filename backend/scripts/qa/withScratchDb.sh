#!/usr/bin/env bash
# Run a QA script against a throw-away copy of the dev DB.
# Needed for tests that create DECLARED results (DB triggers make them
# immutable, so they could never be cleaned up from dev.db).
#   cd backend && bash scripts/qa/withScratchDb.sh scripts/qa/e2ePromotion.js
set -u
cd "$(dirname "$0")/../.."
SCRIPT="${1:?usage: withScratchDb.sh <script.js>}"
PORT="${QA_PORT:-5055}"
cp prisma/dev.db prisma/qa-scratch.db
export DATABASE_URL="file:./qa-scratch.db" QA_SCRATCH=1 QA_BASE="http://localhost:${PORT}"
PORT="$PORT" node src/server.js > /tmp/qa-scratch-server.log 2>&1 &
SRV=$!
for _ in $(seq 1 60); do
  curl -sf "http://localhost:${PORT}/api/lms/auth/captcha" > /dev/null && break
  sleep 1
done
node "$SCRIPT"
CODE=$?
kill "$SRV" 2>/dev/null; wait "$SRV" 2>/dev/null
rm -f prisma/qa-scratch.db prisma/qa-scratch.db-journal
exit $CODE
