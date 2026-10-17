// Seeds the QAP-* promotion fixtures (declared results) — SCRATCH DB ONLY.
// Used by the browser test (lms-frontend/e2e/roles.cjs).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../src/utils/prisma');
if (!process.env.QA_SCRATCH) { console.error('Scratch DB only (QA_SCRATCH=1).'); process.exit(2); }
const STUDENTS = { 'QAP-ELIG': [80, 75, 70, 85], 'QAP-PROB': [62, 58, 55, 60], 'QAP-RPT': [85, 80, 78, 40], 'QAP-FAIL': [85, 80, 78, 40], 'QAP-DROP': [45, 50, 52, 40] };
(async () => {
  const { gradeFromPercent } = require('../../src/utils/lmsGrading');
  const tmpl = await prisma.lmsStudentProfile.findFirst({ where: { programShortForm: 'ADCS' } });
  const sem1 = await prisma.lmsSemester.findFirst({ where: { programId: 1, number: 1, isDeleted: false }, include: { courses: { where: { isDeleted: false }, orderBy: { id: 'asc' } } } });
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  const offs = await prisma.courseOffering.findMany({ where: { termId: term.id, isDeleted: false, courseId: { in: sem1.courses.map((c) => c.id) } } });
  const ids = {};
  for (const [roll, marks] of Object.entries(STUDENTS)) {
    const u = await prisma.lmsUser.create({ data: { username: roll, passwordHash: await bcrypt.hash('Qa@12345', 10), role: 'Student', mustChangePassword: false } });
    ids[roll] = u.id;
    const { id: _i, lmsUserId: _l, createdAt: _c, updatedAt: _u, ...rest } = tmpl;
    await prisma.lmsStudentProfile.create({ data: { ...rest, lmsUserId: u.id, fullName: `QA ${roll}`, rollNumber: roll, registrationNumber: `REG-${roll}`, cnic: `00000-${crypto.randomInt(1e6, 9e6)}-1`, email: `${roll.toLowerCase()}@qa.test` } });
    for (let i = 0; i < sem1.courses.length; i += 1) {
      const c = sem1.courses[i]; const off = offs.find((o) => o.courseId === c.id);
      await prisma.courseRegistration.create({ data: { offeringId: off.id, studentId: u.id, status: 'ENROLLED' } });
      const g = gradeFromPercent(marks[i]);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CourseResult" (offeringId, studentId, totalPercent, letterGrade, gradePoints, status, workflowStage, publishedAt, unofficialAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 'UNOFFICIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        off.id, u.id, marks[i], g.letter, g.points,
      );
    }
  }

  await prisma.systemConfiguration.deleteMany({ where: { key: 'lms_promotion_settings' } });
  console.log('seeded', Object.keys(ids).join(', '));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
