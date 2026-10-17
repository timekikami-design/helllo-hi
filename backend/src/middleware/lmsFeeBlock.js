// ============================================================
//  LMS FEE-BLOCK GUARD (Section 8)
// ------------------------------------------------------------
//  Server-side enforcement of the Provost's fee block. Mounted in front
//  of every LMS student API surface (/api/lms/academic/* and
//  /api/lms/student/*). When the caller is a Student with an open
//  LmsStudentBlock, every request is refused with 403 FEE_BLOCKED except
//  the Fee module (Account Book, payment submission, dues) and the
//  plumbing the blocked screen needs (notifications, SSE events,
//  logout-activity). /api/lms/auth/* is not behind this guard, so login
//  and /me keep working and report the block state.
//
//  Non-students and invalid tokens pass straight through — the routers'
//  own lmsAuth / role guards handle them exactly as before.
// ============================================================
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { BLOCK_MESSAGE } = require('../utils/lmsFeeEngine');

// Paths (relative to /api/lms) a blocked student may still use.
const ALLOW = [
  /^\/academic\/student\/fees(\/|$)/,
  /^\/academic\/student\/fee-status$/,
  /^\/academic\/student\/notifications(\/|$)/,
  /^\/academic\/student\/events$/,
  /^\/academic\/student\/logout-activity$/,
];

function lmsFeeBlockGuard(base) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.query.token || null);
      if (!token) return next();
      let decoded;
      try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (_) { return next(); }
      if (decoded.system !== 'lms' || decoded.role !== 'Student') return next();
      const rel = `${base}${req.path}`;
      if (ALLOW.some((re) => re.test(rel))) return next();
      const block = await prisma.lmsStudentBlock.findFirst({
        where: { studentId: decoded.userId, unblockedAt: null }, select: { id: true },
      });
      if (!block) return next();
      return res.status(403).json({ error: BLOCK_MESSAGE, code: 'FEE_BLOCKED' });
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = { lmsFeeBlockGuard, ALLOW };
