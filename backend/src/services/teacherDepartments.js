// ============================================================
//  TEACHER DEPARTMENTS (Changes 3 & 4)
//  ------------------------------------------------------------
//  A teacher's PRIMARY department is the existing
//  LmsStudentProfile.department (unchanged; all existing coordinator /
//  focal visibility keeps using it). Further departments assigned by the
//  Super Admin are recorded in the additive LmsTeacherDepartment table.
// ============================================================
const prisma = require('../utils/prisma');
const realtime = require('../utils/lmsRealtime');

/** All departments of a teacher: [{ name, isPrimary }] (primary first). */
async function departmentsOf(lmsUserId) {
  const profile = await prisma.lmsStudentProfile.findUnique({ where: { lmsUserId }, select: { department: true } });
  const primary = profile && profile.department ? profile.department.trim() : '';
  const extra = await prisma.lmsTeacherDepartment.findMany({ where: { lmsUserId }, orderBy: { createdAt: 'asc' } });
  const out = [];
  if (primary) out.push({ name: primary, isPrimary: true });
  for (const r of extra) if (r.department && r.department !== primary) out.push({ name: r.department, isPrimary: false });
  return out;
}

/** LmsUser ids of teachers who belong to a department (primary or additional). */
async function teacherIdsInDepartment(department) {
  const d = String(department || '').trim();
  if (!d) return [];
  const [profiles, extra] = await Promise.all([
    prisma.lmsStudentProfile.findMany({ where: { department: d, lmsUser: { role: 'Teacher' } }, select: { lmsUserId: true } }),
    prisma.lmsTeacherDepartment.findMany({ where: { department: d }, select: { lmsUserId: true } }),
  ]);
  return [...new Set([...profiles.map((p) => p.lmsUserId), ...extra.map((e) => e.lmsUserId)])];
}

/** Everyone in a department: coordinators, focal persons, teachers, students. */
async function departmentMemberIds(department) {
  const d = String(department || '').trim();
  if (!d) return [];
  const profiles = await prisma.lmsStudentProfile.findMany({ where: { department: d }, select: { lmsUserId: true } });
  const extra = await prisma.lmsTeacherDepartment.findMany({ where: { department: d }, select: { lmsUserId: true } });
  let coordIds = [];
  try {
    const dept = await prisma.department.findFirst({ where: { name: d }, select: { id: true } });
    if (dept) coordIds = (await prisma.lmsDepartmentCoordinator.findMany({ where: { departmentId: dept.id }, select: { lmsUserId: true } })).map((c) => c.lmsUserId);
  } catch (_) { /* read-only lookup; ignore */ }
  return [...new Set([...profiles.map((p) => p.lmsUserId), ...extra.map((e) => e.lmsUserId), ...coordIds])];
}

/**
 * Assign a department to a teacher. First assignment becomes the primary
 * (stored on the profile exactly as before); later ones are ADDED. Pushes a
 * real-time `department` event to the teacher and every department member.
 */
async function assignTeacherDepartment(lmsUserId, department, assignedById) {
  const d = String(department || '').trim();
  const current = await departmentsOf(lmsUserId);
  const hasPrimary = current.some((x) => x.isPrimary);
  let added = false;
  if (!hasPrimary) {
    const existing = await prisma.lmsStudentProfile.findUnique({ where: { lmsUserId } });
    if (existing) await prisma.lmsStudentProfile.update({ where: { lmsUserId }, data: { department: d } });
    else {
      await prisma.lmsStudentProfile.create({ data: { lmsUserId, fullName: '', fatherName: '', cnic: '', dateOfBirth: '', gender: '', program: '', programShortForm: '', department: d, rollNumber: '', registrationNumber: '', session: '', enrollmentDate: new Date() } });
    }
    added = true;
  } else if (!current.some((x) => x.name === d)) added = true;
  await prisma.lmsTeacherDepartment.upsert({
    where: { lmsUserId_department: { lmsUserId, department: d } },
    update: {},
    create: { lmsUserId, department: d, isPrimary: !hasPrimary, assignedById: assignedById || null },
  });
  const departments = await departmentsOf(lmsUserId);
  await broadcastAssignment(lmsUserId, d, departments);
  return { departments, added, primary: !hasPrimary };
}

async function broadcastAssignment(lmsUserId, department, departments) {
  try {
    const u = await prisma.lmsUser.findUnique({ where: { id: lmsUserId }, select: { username: true, profile: { select: { fullName: true } } } });
    const teacherName = (u && u.profile && u.profile.fullName) || (u && u.username) || '';
    const members = await departmentMemberIds(department);
    const payload = { action: 'teacher-assigned', teacherId: lmsUserId, teacherName, department, departments };
    realtime.emitTo([...new Set([lmsUserId, ...members])], 'department', payload);
    // In-app notification so coordinators / focal persons / members see
    // "Teacher X is assigned to Department Y" in their notification list.
    const { notifyMany } = require('../utils/lmsNotify');
    await notifyMany(members.filter((m) => m !== lmsUserId), { title: 'Teacher assigned to department', message: `${teacherName} is assigned to ${department}.`, type: 'INFO' });
  } catch (e) { console.warn('[teacherDepartments] broadcast failed:', e.message); }
}

module.exports = { departmentsOf, teacherIdsInDepartment, departmentMemberIds, assignTeacherDepartment, broadcastAssignment };
