// ============================================================
//  SUPER ADMIN — LMS COURSE COORDINATOR ASSIGNMENT (Section 12)
//  ------------------------------------------------------------
//  Lets the Super Admin assign an EXISTING LMS account (a Teacher or an
//  existing Course Coordinator) as a department's Course Coordinator.
//
//  Root cause this fixes: the department form's "existing user" list only
//  contained Admissions `User` rows, so LMS teachers could never be chosen,
//  and an Admissions user chosen there received an LMS login with a random,
//  never-communicated password (could not sign in).
//
//  LMS-ONLY writes: LmsUser.role, LmsStudentProfile.department (the LMS
//  department-isolation key), LmsDepartmentCoordinator, LmsNotification.
//  The Admissions Department / DepartmentStaff / User tables are only READ.
// ============================================================
const prisma = require('../../utils/prisma');
const { logSaActivity, logLmsAudit } = require('./superAdmin.service');
const { notify } = require('../../utils/lmsNotify');

const ASSIGNABLE_ROLES = ['Teacher', 'CourseCoordinator'];

async function bindDepartment(lmsUserId, departmentName) {
  const existing = await prisma.lmsStudentProfile.findUnique({ where: { lmsUserId } });
  if (existing) {
    if (String(existing.department || '').trim() !== departmentName) {
      await prisma.lmsStudentProfile.update({ where: { lmsUserId }, data: { department: departmentName } });
    }
    return;
  }
  await prisma.lmsStudentProfile.create({
    data: {
      lmsUserId, fullName: '', fatherName: '', cnic: '', dateOfBirth: '', gender: '',
      program: '', programShortForm: '', department: departmentName, rollNumber: '',
      registrationNumber: '', session: '', enrollmentDate: new Date(), designation: 'Course Coordinator',
    },
  });
}

function displayOf(u) {
  const name = (u.examProfile && u.examProfile.fullName) || (u.profile && u.profile.fullName) || '';
  return name || u.username;
}

// GET /api/super-admin/lms/course-coordinators?departmentId=
// → { candidates: [...LMS teachers/coordinators], assignments: [...] }
async function listCoordinators(req, res) {
  try {
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId, 10) : null;
    const [users, rows, departments] = await Promise.all([
      prisma.lmsUser.findMany({
        where: { role: { in: ASSIGNABLE_ROLES } },
        select: {
          id: true, username: true, email: true, role: true, isActive: true,
          profile: { select: { fullName: true, department: true } },
          examProfile: { select: { fullName: true } },
        },
        orderBy: { username: 'asc' },
      }),
      prisma.lmsDepartmentCoordinator.findMany({ where: departmentId ? { departmentId } : {}, orderBy: { id: 'asc' } }),
      prisma.department.findMany({ select: { id: true, name: true } }),
    ]);
    const deptName = Object.fromEntries(departments.map((d) => [d.id, d.name]));
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json({
      candidates: users.map((u) => ({
        id: u.id, username: u.username, email: u.email, role: u.role, isActive: u.isActive,
        fullName: displayOf(u), department: u.profile ? u.profile.department || null : null,
      })),
      assignments: rows.map((r) => {
        const u = byId[r.lmsUserId];
        return {
          id: r.id, departmentId: r.departmentId, department: deptName[r.departmentId] || null,
          lmsUserId: r.lmsUserId, username: u ? u.username : null, email: u ? u.email : null,
          fullName: u ? displayOf(u) : null, role: u ? u.role : null, createdAt: r.createdAt,
        };
      }),
    });
  } catch (e) {
    console.error('SA listCoordinators error:', e);
    res.status(500).json({ error: 'Failed to load LMS course coordinators' });
  }
}

// POST /api/super-admin/lms/course-coordinators  { departmentId, lmsUserId }
async function assignCoordinator(req, res) {
  try {
    const departmentId = parseInt(req.body.departmentId, 10);
    const lmsUserId = String(req.body.lmsUserId || '');
    if (!departmentId || !lmsUserId) return res.status(400).json({ error: 'departmentId and lmsUserId are required.' });
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } });
    if (!dept) return res.status(404).json({ error: 'Department not found.' });
    const user = await prisma.lmsUser.findUnique({ where: { id: lmsUserId } });
    if (!user) return res.status(404).json({ error: 'LMS user not found.' });
    if (!ASSIGNABLE_ROLES.includes(user.role)) {
      return res.status(400).json({ error: `An LMS ${user.role} cannot be assigned as Course Coordinator.` });
    }
    if (user.isActive === false) return res.status(400).json({ error: 'This LMS account is deactivated. Reactivate it first.' });

    // A coordinator is bound to exactly ONE department (the LMS isolation key
    // is a single department string). Refuse a silent re-binding.
    const other = await prisma.lmsDepartmentCoordinator.findFirst({ where: { lmsUserId, departmentId: { not: departmentId } } });
    if (other) {
      const od = await prisma.department.findUnique({ where: { id: other.departmentId }, select: { name: true } });
      return res.status(409).json({ error: `${user.username} is already the Course Coordinator of "${od ? od.name : other.departmentId}". Remove that assignment first.` });
    }

    const existing = await prisma.lmsDepartmentCoordinator.findUnique({ where: { departmentId_lmsUserId: { departmentId, lmsUserId } } });
    const row = existing || await prisma.lmsDepartmentCoordinator.create({
      data: { departmentId, lmsUserId, assignedById: req.user ? req.user.id : null, previousRole: user.role },
    });
    // Correct role + department mapping + an active, unlocked login.
    await prisma.lmsUser.update({
      where: { id: lmsUserId },
      data: { role: 'CourseCoordinator', isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await bindDepartment(lmsUserId, dept.name);
    await notify(lmsUserId, {
      title: 'Course Coordinator assignment',
      message: `You have been assigned as the Course Coordinator for ${dept.name}. Sign in again to load your coordinator workspace.`,
      type: 'INFO',
    });
    await logSaActivity({ req, module: 'users', action: 'assign_lms_course_coordinator', description: `Assigned LMS user ${user.username} as Course Coordinator of ${dept.name}`, metadata: { departmentId, lmsUserId } });
    await logLmsAudit({ req, action: 'SA_ASSIGN_COURSE_COORDINATOR', entity: 'LmsDepartmentCoordinator', entityId: row.id, after: { departmentId, lmsUserId } }).catch(() => {});
    res.status(existing ? 200 : 201).json({ assignment: row, message: 'Course Coordinator assigned.' });
  } catch (e) {
    console.error('SA assignCoordinator error:', e);
    res.status(500).json({ error: 'Failed to assign Course Coordinator' });
  }
}

// DELETE /api/super-admin/lms/course-coordinators/:id
async function unassignCoordinator(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await prisma.lmsDepartmentCoordinator.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Assignment not found.' });
    await prisma.lmsDepartmentCoordinator.delete({ where: { id } });
    // Restore the previous LMS role (e.g. Teacher) when no other assignment remains.
    const remaining = await prisma.lmsDepartmentCoordinator.count({ where: { lmsUserId: row.lmsUserId } });
    if (!remaining && row.previousRole && row.previousRole !== 'CourseCoordinator') {
      await prisma.lmsUser.update({ where: { id: row.lmsUserId }, data: { role: row.previousRole } }).catch(() => {});
    }
    await logSaActivity({ req, module: 'users', action: 'unassign_lms_course_coordinator', description: `Removed LMS Course Coordinator assignment #${id}`, metadata: { departmentId: row.departmentId, lmsUserId: row.lmsUserId } });
    res.json({ message: 'Assignment removed.' });
  } catch (e) {
    console.error('SA unassignCoordinator error:', e);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
}

module.exports = { listCoordinators, assignCoordinator, unassignCoordinator };
