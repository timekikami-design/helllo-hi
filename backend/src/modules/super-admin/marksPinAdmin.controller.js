// ============================================================
//  SUPER ADMIN — TEACHER MARKS PIN RESET (Section 2)
//  ------------------------------------------------------------
//  Super Admin only (router-level authenticate + requireSuperAdmin).
//  Resets a teacher's Marks PIN to a system-generated TEMPORARY PIN
//  (stored bcrypt-hashed + flagged isTemporary), clears the lockout and
//  invalidates open marks sessions. The plaintext temp PIN is returned
//  ONCE in the response so the Super Admin can copy it to the teacher.
//  Writes LMS tables only (TeacherMarksPin, LmsAuditLog, LmsNotification)
//  plus the Super Admin activity log.
// ============================================================
const prisma = require('../../utils/prisma');
const pin = require('../../utils/marksPin');
const { logSaActivity, logLmsAudit } = require('./superAdmin.service');
const { notify } = require('../../utils/lmsNotify');

const TEACHING_ROLES = ['Teacher', 'CourseCoordinator'];

// GET /api/super-admin/lms/marks-pins — every teacher with their PIN state.
async function listTeacherPins(req, res) {
  try {
    const [teachers, pins] = await Promise.all([
      prisma.lmsUser.findMany({
        where: { role: { in: TEACHING_ROLES } },
        select: {
          id: true, username: true, email: true, role: true, isActive: true,
          profile: { select: { fullName: true, department: true } },
          examProfile: { select: { fullName: true } },
        },
        orderBy: { username: 'asc' },
      }),
      prisma.teacherMarksPin.findMany(),
    ]);
    const byUser = Object.fromEntries(pins.map((p) => [p.lmsUserId, p]));
    const now = new Date();
    res.json({
      teachers: teachers.map((t) => {
        const p = byUser[t.id];
        const locked = !!(p && p.lockedUntil && p.lockedUntil > now);
        return {
          id: t.id, username: t.username, email: t.email, role: t.role, isActive: t.isActive,
          fullName: (t.examProfile && t.examProfile.fullName) || (t.profile && t.profile.fullName) || t.username,
          department: t.profile ? t.profile.department || null : null,
          pinStatus: !p ? 'NOT_SET' : p.isTemporary ? 'RESET_PENDING' : locked ? 'LOCKED' : 'ACTIVE',
          failedAttempts: p ? p.failedAttempts : 0,
          lockedUntil: locked ? p.lockedUntil : null,
          lastVerifiedAt: p ? p.lastVerifiedAt : null,
          resetAt: p ? p.resetAt : null,
        };
      }),
    });
  } catch (e) {
    console.error('SA listTeacherPins error:', e);
    res.status(500).json({ error: 'Failed to load teacher PINs' });
  }
}

// POST /api/super-admin/lms/marks-pins/:lmsUserId/reset
async function resetTeacherPin(req, res) {
  try {
    const { lmsUserId } = req.params;
    const teacher = await prisma.lmsUser.findUnique({ where: { id: lmsUserId }, select: { id: true, username: true, role: true } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
    if (!TEACHING_ROLES.includes(teacher.role)) return res.status(400).json({ error: `A ${teacher.role} account has no Marks PIN.` });

    const { tempPin } = await pin.adminReset(teacher.id, req.user ? req.user.id : null);
    const actor = req.user ? (req.user.username || req.user.email) : 'super_admin';
    await logSaActivity({ req, module: 'lms', action: 'reset_marks_pin', description: `Reset Marks PIN of ${teacher.username} (temporary PIN issued)`, metadata: { lmsUserId: teacher.id, by: actor } });
    await logLmsAudit({ req, action: 'MARKS_PIN_ADMIN_RESET', entity: 'TeacherMarksPin', entityId: teacher.id, after: { by: actor, at: new Date().toISOString(), teacher: teacher.username } });
    await notify(teacher.id, {
      title: 'Marks PIN reset',
      message: 'Your Marks PIN was reset by the Super Admin. Use the temporary PIN you received to open Marks, then set your own new PIN.',
      type: 'INFO', link: '/teacher/marks',
    });
    res.json({ teacher: { id: teacher.id, username: teacher.username }, temporaryPin: tempPin, message: 'Temporary PIN generated. Share it with the teacher securely — it is shown only once.' });
  } catch (e) {
    console.error('SA resetTeacherPin error:', e);
    res.status(500).json({ error: 'Failed to reset the Marks PIN' });
  }
}

module.exports = { listTeacherPins, resetTeacherPin };
