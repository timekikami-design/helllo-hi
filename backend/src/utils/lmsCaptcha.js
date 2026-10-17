// ============================================================
//  LMS LOGIN CAPTCHA (Section 1)
//  ------------------------------------------------------------
//  Independent from the Admissions captcha (middleware/captcha.js and the
//  `CaptchaChallenge` table are NOT used or modified). Server-generated
//  math challenge stored in `LmsCaptchaChallenge`:
//   • answer stored as a SHA-256 hash (never returned to the client)
//   • 5-minute expiry, SINGLE-USE: any verification attempt — right or
//     wrong — consumes the challenge, so every failed login requires a
//     brand-new captcha (no brute-forcing one question)
//   • empty / unknown / expired / reused → rejected
// ============================================================
const crypto = require('crypto');
const prisma = require('./prisma');

const TTL_MS = 5 * 60 * 1000;

const hash = (v) => crypto.createHash('sha256').update(`lms-captcha:${String(v).trim()}`).digest('hex');

async function issue() {
  const ops = ['+', '-', '×'];
  const op = ops[crypto.randomInt(ops.length)];
  let a = crypto.randomInt(1, 13);
  let b = crypto.randomInt(1, 13);
  if (op === '-' && b > a) [a, b] = [b, a];
  if (op === '×') { a = crypto.randomInt(2, 10); b = crypto.randomInt(2, 10); }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.lmsCaptchaChallenge.create({ data: { id, answerHash: hash(answer), expiresAt } });
  // Opportunistic cleanup of stale rows (best-effort).
  prisma.lmsCaptchaChallenge.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(Date.now() - TTL_MS) } }, { used: true, createdAt: { lt: new Date(Date.now() - TTL_MS) } }] } }).catch(() => {});
  return { captchaId: id, question: `What is ${a} ${op} ${b} ?`, expiresAt };
}

/**
 * Verify + consume a challenge. Returns null when valid, otherwise a
 * user-facing error message.
 */
async function verify(captchaId, captchaAnswer) {
  if (!captchaId || captchaAnswer === undefined || captchaAnswer === null || String(captchaAnswer).trim() === '') {
    return 'Please solve the security check (captcha) to sign in.';
  }
  const row = await prisma.lmsCaptchaChallenge.findUnique({ where: { id: String(captchaId) } }).catch(() => null);
  if (!row) return 'Invalid security check. A new captcha has been issued — please try again.';
  if (row.used) return 'This security check was already used. A new captcha has been issued — please try again.';
  // Consume atomically: only one request can flip used=false → true.
  const consumed = await prisma.lmsCaptchaChallenge.updateMany({ where: { id: row.id, used: false }, data: { used: true } });
  if (consumed.count !== 1) return 'This security check was already used. A new captcha has been issued — please try again.';
  if (row.expiresAt < new Date()) return 'The security check has expired. A new captcha has been issued — please try again.';
  if (hash(captchaAnswer) !== row.answerHash) return 'Incorrect captcha answer. A new captcha has been issued — please try again.';
  return null;
}

module.exports = { issue, verify, TTL_MS };
