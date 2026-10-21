# Change 2 (results status): per-course Complete/Incomplete by teacher submission.
import sys
p='backend/src/routes/lms/academic/exam.js'
s=open(p).read()
if "kind === 'complete'" in s: print('already applied'); sys.exit(0)
start=s.index("  if (kind === 'incomplete') {\n    // registrations with no published result")
end=s.index("  if (kind === 'absentees') {", start)
new='''  if (kind === 'incomplete' || kind === 'complete') {
    // Per COURSE, decided by the teacher's submission action:
    //   Complete   = the teacher submitted the course result (resultSubmittedAt
    //                set) - even if some students have no marks in it;
    //   Incomplete = the teacher has not submitted it yet.
    // A course is therefore never in both lists and moves from Incomplete to
    // Complete the moment it is submitted.
    const offerings = await prisma.courseOffering.findMany({
      where: { termId, isDeleted: false, registrations: { some: { status: 'ENROLLED' } } },
      include: {
        course: { include: { program: true, semester: true } },
        term: true,
        registrations: { where: { status: 'ENROLLED' }, select: { studentId: true } },
        results: { select: { studentId: true, totalPercent: true, midMarks: true, finalMarks: true, assignmentMarks: true, quizMarks: true, labMarks: true, projectMarks: true } },
      },
    });
    const allStudentIds = offerings.flatMap((o) => o.registrations.map((r) => r.studentId));
    const names = await nameMap(allStudentIds);
    const teacherNames = await nameMap(offerings.map((o) => o.teacherId).filter(Boolean));
    const stuCtx = await studentContextMap(allStudentIds);
    const ctxOf = (o) => {
      const first = stuCtx[o.registrations[0]?.studentId] || {};
      return {
        offeringId: o.id,
        course: o.course ? `${o.course.code} ${o.course.title}` : null,
        courseCode: o.course?.code || null,
        teacherId: o.teacherId || null,
        teacher: o.teacherId ? (teacherNames[o.teacherId] || o.teacherId) : null,
        department: o.course?.program?.department || first.department || null,
        program: o.course?.program?.shortForm || o.course?.program?.code || first.program || null,
        semester: o.course?.semester ? String(o.course.semester.number) : null,
        session: o.term?.title || first.session || null,
      };
    };
    const hasMarks = (r) => !!r && [r.totalPercent, r.midMarks, r.finalMarks, r.assignmentMarks, r.quizMarks, r.labMarks, r.projectMarks].some((v) => Number(v) > 0);
    let rows = [];
    if (kind === 'incomplete') {
      // Row shape unchanged (one row per enrolled student of an unsubmitted course).
      for (const o of offerings.filter((x) => !x.resultSubmittedAt)) {
        const resBy = new Map(o.results.map((r) => [r.studentId, r]));
        const c = ctxOf(o);
        for (const reg of o.registrations) {
          const sctx = stuCtx[reg.studentId] || {};
          rows.push({
            ...c,
            studentId: reg.studentId,
            student: names[reg.studentId] || reg.studentId,
            session: c.session || sctx.session || null,
            batch: sctx.batch || null,
            status: resBy.has(reg.studentId) ? 'DRAFT' : 'NO_RESULT',
          });
        }
      }
    } else {
      // One row per submitted course.
      for (const o of offerings.filter((x) => x.resultSubmittedAt)) {
        const resBy = new Map(o.results.map((r) => [r.studentId, r]));
        const withMarks = o.registrations.filter((reg) => hasMarks(resBy.get(reg.studentId))).length;
        const batches = [...new Set(o.registrations.map((reg) => stuCtx[reg.studentId]?.batch).filter(Boolean))];
        rows.push({
          ...ctxOf(o),
          batch: batches.length === 1 ? batches[0] : (batches.join(', ') || null),
          submittedAt: o.resultSubmittedAt,
          enrolled: o.registrations.length,
          withMarks,
          withoutMarks: o.registrations.length - withMarks,
          status: 'COMPLETE',
        });
      }
      rows.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }
    const departments = [...new Set(rows.map((r) => r.department).filter(Boolean))].sort();
    const { department, program, semester, session, batch } = req.query;
    if (department) rows = rows.filter((r) => r.department === department);
    if (program) rows = rows.filter((r) => r.program === program);
    if (semester) rows = rows.filter((r) => String(r.semester) === String(semester));
    if (session) rows = rows.filter((r) => r.session === session);
    if (batch) rows = rows.filter((r) => String(r.batch) === String(batch));
    return res.json({
      report: kind, term: term?.title || null, rows, departments,
      counts: {
        complete: offerings.filter((x) => x.resultSubmittedAt).length,
        incomplete: offerings.filter((x) => !x.resultSubmittedAt).length,
      },
    });
  }

'''
s=s[:start]+new+s[end:]
old='''  if (kind === 'incomplete') {
    const regs = await prisma.courseRegistration.findMany({
      where: { status: 'ENROLLED', offering: { termId } },
      include: { offering: { include: { course: true } } },
    });
    const names = await nameMap(regs.map((r) => r.studentId));
    const rows = [];
    for (const reg of regs) {
      const result = await prisma.courseResult.findUnique({
        where: { offeringId_studentId: { offeringId: reg.offeringId, studentId: reg.studentId } },
      });
      if (!result || result.status !== 'PUBLISHED') {
        rows.push({ student: names[reg.studentId] || reg.studentId, course: reg.offering?.course ? `${reg.offering.course.code} ${reg.offering.course.title}` : '', status: result ? 'DRAFT' : 'NO_RESULT' });
      }
    }
    return rows;
  }'''
new2='''  if (kind === 'incomplete') {
    // Same per-course rule as the live report: only courses NOT yet submitted.
    const regs = await prisma.courseRegistration.findMany({
      where: { status: 'ENROLLED', offering: { termId, isDeleted: false, resultSubmittedAt: null } },
      include: { offering: { include: { course: true } } },
    });
    const names = await nameMap(regs.map((r) => r.studentId));
    const rows = [];
    for (const reg of regs) {
      const result = await prisma.courseResult.findUnique({
        where: { offeringId_studentId: { offeringId: reg.offeringId, studentId: reg.studentId } },
      });
      rows.push({ student: names[reg.studentId] || reg.studentId, course: reg.offering?.course ? `${reg.offering.course.code} ${reg.offering.course.title}` : '', status: result ? 'DRAFT' : 'NO_RESULT' });
    }
    return rows;
  }
  if (kind === 'complete') {
    const offs = await prisma.courseOffering.findMany({
      where: { termId, isDeleted: false, resultSubmittedAt: { not: null }, registrations: { some: { status: 'ENROLLED' } } },
      include: { course: true, _count: { select: { registrations: true } } },
    });
    const teachers = await nameMap(offs.map((o) => o.teacherId).filter(Boolean));
    return offs.map((o) => ({ course: o.course ? `${o.course.code} ${o.course.title}` : '', teacher: o.teacherId ? (teachers[o.teacherId] || o.teacherId) : '', enrolled: o._count.registrations, submittedAt: o.resultSubmittedAt ? new Date(o.resultSubmittedAt).toISOString() : '', status: 'COMPLETE' }));
  }'''
assert old in s; s=s.replace(old,new2)
s=s.replace("const kind = req.params.kind; // gazette | absentees | probation | incomplete\n","const kind = req.params.kind; // gazette | absentees | probation | incomplete | complete\n")
open(p,'w').write(s); print('applied')
