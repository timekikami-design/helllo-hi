// ============================================================
//  PROVOST FEE WORKFLOWS — /api/lms/academic/provost/finance/*
// ------------------------------------------------------------
//  S7.2  Payment submissions: list, view screenshot, approve / reject
//        (rejection reason mandatory). Approval marks the challan (or the
//        next instalment) PAID and lifts a fee block in the same action.
//  S8    Defaulter list: filters semester / program / department, search
//        by username / name / CNIC / phone / roll / email.
//  S9    Concessions, scholarships and monthly instalment plans with full
//        history (who granted / revoked what, when). Every change re-prices
//        the student's open semester challans immediately and is pushed to
//        the student in real time.
//
//  LMS-only. Reads Admission data (base fee) through lmsFeeEngine, never
//  writes it. Mounted BEFORE the main provost router.
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const prisma = require('../../../utils/prisma');
const { lmsAuth, lmsRequireRole } = require('../../../middleware/lmsAuth');
const { validate } = require('../../../middleware/validate');
const { asyncHandler, httpError } = require('../../../utils/lmsHelpers');
const { audit } = require('../../../utils/lmsAudit');
const { notify } = require('../../../utils/lmsNotify');
const { nameMap } = require('../../../utils/lmsWorkflow');
const realtime = require('../../../utils/lmsRealtime');
const fee = require('../../../utils/lmsFeeEngine');
const { resolveStudentPositions, getActiveBlocks } = require('../../../utils/provostFinance');
const { proofAbsPath } = require('../../../middleware/lmsFeeProofUpload');

const router = express.Router();
const PROVOST = [lmsAuth, lmsRequireRole('Provost')];

const str = (v) => (v == null ? '' : String(v));
const q = (req, k) => (req.query[k] != null && req.query[k] !== '' ? String(req.query[k]) : null);

/** Lift an open block when the student no longer has overdue dues. */
async function unblockIfClear(req, studentId, note) {
  const open = await fee.activeBlock(studentId);
  if (!open) return { wasBlocked: false, unblocked: false };
  const dues = await fee.studentDues(studentId);
  if (dues.overdueAmount > 0) return { wasBlocked: true, unblocked: false, remainingOverdue: dues.overdueAmount };
  await prisma.lmsStudentBlock.update({
    where: { id: open.id },
    data: { unblockedById: req.lmsUser.id, unblockedAt: new Date(), unblockNote: note },
  });
  await audit(req, 'PROVOST_STUDENT_UNBLOCK', 'LmsStudentBlock', open.id, { after: { studentId, auto: true, note } });
  fee.pushBlockState(studentId, false);
  return { wasBlocked: true, unblocked: true };
}

// ------------------------------------------------------------
// S7.2 — PAYMENT SUBMISSIONS
// ------------------------------------------------------------
async function submissionRows(where) {
  const subs = await prisma.lmsFeePaymentSubmission.findMany({ where, orderBy: { createdAt: 'desc' } });
  if (!subs.length) return [];
  const [positions, challans, names, blocks] = await Promise.all([
    resolveStudentPositions(),
    prisma.lmsFeeChallan.findMany({ where: { id: { in: [...new Set(subs.map((s) => s.challanId))] } } }),
    nameMap(subs.map((s) => s.reviewedById).filter(Boolean)),
    getActiveBlocks(),
  ]);
  const cMap = new Map(challans.map((c) => [c.id, c]));
  return subs.map((s) => {
    const p = positions.get(s.studentId) || {};
    const c = cMap.get(s.challanId) || {};
    return {
      id: s.id, challanId: s.challanId, challanNo: c.challanNo || null, title: c.title || null,
      feeType: c.feeType || null, studentId: s.studentId, student: p.fullName || s.studentId,
      roll: p.rollNumber || '', program: c.program || p.program || '', department: c.department || p.department || '',
      semester: c.semester != null ? c.semester : p.semester,
      method: s.method, methodLabel: fee.METHOD_LABEL[s.method] || s.method, amount: s.amount,
      transactionId: s.transactionId, paidOn: s.paidOn, status: s.status,
      rejectionReason: s.rejectionReason, reviewedBy: s.reviewedById ? (names[s.reviewedById] || s.reviewedById) : null,
      reviewedAt: s.reviewedAt, createdAt: s.createdAt, blocked: blocks.has(s.studentId),
    };
  });
}

router.get('/finance/submissions', PROVOST, asyncHandler(async (req, res) => {
  const status = q(req, 'status');
  const where = status && status !== 'ALL' ? { status: status.toUpperCase() } : {};
  let rows = await submissionRows(where);
  if (q(req, 'program')) rows = rows.filter((r) => r.program === q(req, 'program'));
  if (q(req, 'department')) rows = rows.filter((r) => r.department === q(req, 'department'));
  if (q(req, 'semester')) rows = rows.filter((r) => String(r.semester) === q(req, 'semester'));
  if (q(req, 'q')) {
    const s = q(req, 'q').toLowerCase();
    rows = rows.filter((r) => [r.student, r.roll, r.transactionId, r.challanNo].some((v) => str(v).toLowerCase().includes(s)));
  }
  const all = await prisma.lmsFeePaymentSubmission.groupBy({ by: ['status'], _count: { _all: true } });
  const count = (k) => all.find((x) => x.status === k)?._count._all || 0;
  res.json({ items: rows, stats: { pending: count('PENDING'), approved: count('APPROVED'), rejected: count('REJECTED') } });
}));

router.get('/finance/submissions/:id/screenshot', PROVOST, asyncHandler(async (req, res) => {
  const sub = await prisma.lmsFeePaymentSubmission.findUnique({ where: { id: parseInt(req.params.id, 10) } });
  if (!sub) throw httpError(404, 'Submission not found');
  res.sendFile(proofAbsPath(sub.screenshotPath));
}));

router.put('/finance/submissions/:id/decide', PROVOST, validate([
  body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
]), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = await prisma.lmsFeePaymentSubmission.findUnique({ where: { id } });
  if (!sub) throw httpError(404, 'Submission not found');
  if (sub.status !== 'PENDING') throw httpError(409, `This submission was already ${sub.status.toLowerCase()}.`);
  const challan = await prisma.lmsFeeChallan.findUnique({ where: { id: sub.challanId } });
  if (!challan) throw httpError(404, 'Fee challan not found');

  if (req.body.action === 'reject') {
    const reason = str(req.body.reason).trim();
    if (reason.length < 5) throw httpError(400, 'A rejection reason (at least 5 characters) is required.');
    await prisma.lmsFeePaymentSubmission.update({
      where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedById: req.lmsUser.id, reviewedAt: new Date() },
    });
    await audit(req, 'PROVOST_FEE_SUBMISSION_REJECT', 'LmsFeePaymentSubmission', id, { before: { status: 'PENDING' }, after: { status: 'REJECTED', reason } });
    await notify(sub.studentId, {
      title: 'Fee payment rejected',
      message: `Your payment for ${challan.title} (Txn ${sub.transactionId}) was rejected. Reason: ${reason}. Please correct it and resubmit.`,
      type: 'WARNING', link: '/student/account',
    });
    fee.pushFeeUpdate(sub.studentId, { challanId: challan.id, submission: 'REJECTED', reason });
    return res.json({ success: true, status: 'REJECTED' });
  }

  // APPROVE — the next unpaid instalment (or the whole challan) becomes PAID.
  const now = new Date();
  const nextInst = await prisma.lmsFeeInstallment.findFirst({ where: { challanId: challan.id, status: 'UNPAID' }, orderBy: { seq: 'asc' } });
  let challanStatus = challan.status;
  await prisma.$transaction(async (tx) => {
    await tx.lmsFeePaymentSubmission.update({ where: { id }, data: { status: 'APPROVED', reviewedById: req.lmsUser.id, reviewedAt: now } });
    if (nextInst) {
      await tx.lmsFeeInstallment.update({ where: { id: nextInst.id }, data: { status: 'PAID', paidAt: now } });
      const left = await tx.lmsFeeInstallment.count({ where: { challanId: challan.id, status: 'UNPAID' } });
      if (left === 0) {
        await tx.lmsFeeChallan.update({ where: { id: challan.id }, data: { status: 'PAID', paidAt: now, paymentRef: sub.transactionId } });
        challanStatus = 'PAID';
      }
    } else {
      await tx.lmsFeeChallan.update({ where: { id: challan.id }, data: { status: 'PAID', paidAt: now, paymentRef: sub.transactionId } });
      challanStatus = 'PAID';
    }
  });
  await audit(req, 'PROVOST_FEE_SUBMISSION_APPROVE', 'LmsFeePaymentSubmission', id, {
    before: { status: 'PENDING', challanStatus: challan.status },
    after: { status: 'APPROVED', challanStatus, installment: nextInst ? nextInst.seq : null },
  });
  const block = await unblockIfClear(req, sub.studentId, `Auto-unblocked on approval of payment ${sub.transactionId}`);
  await notify(sub.studentId, {
    title: 'Fee payment approved',
    message: `Your payment of ${fee.fmtPKR(sub.amount)} for ${challan.title} was approved.${block.unblocked ? ' Your account has been unblocked.' : ''}`,
    type: 'SUCCESS', link: '/student/account',
  });
  fee.pushFeeUpdate(sub.studentId, { challanId: challan.id, submission: 'APPROVED', challanStatus });
  res.json({ success: true, status: 'APPROVED', challanStatus, block });
}));

// ------------------------------------------------------------
// S8 — DEFAULTERS (filters + multi-field search)
// ------------------------------------------------------------
router.get('/finance/defaulters', PROVOST, asyncHandler(async (req, res) => {
  const positions = await resolveStudentPositions();
  const blocks = await getActiveBlocks();
  const users = await prisma.lmsUser.findMany({ where: { role: 'Student' }, select: { id: true, username: true, email: true } });
  const uMap = new Map(users.map((u) => [u.id, u]));
  const include = q(req, 'include') || 'defaulters'; // defaulters | all | blocked
  const rows = [];
  for (const p of positions.values()) {
    const dues = await fee.studentDues(p.studentId);
    const blocked = blocks.get(p.studentId);
    if (include === 'defaulters' && !dues.isDefaulter && !blocked) continue;
    if (include === 'blocked' && !blocked) continue;
    const u = uMap.get(p.studentId) || {};
    rows.push({
      studentId: p.studentId, username: u.username || p.username, name: p.fullName, roll: p.rollNumber,
      cnic: p.cnic, phone: p.phone, email: p.email || u.email || '',
      program: p.program, department: p.department, semester: p.semester,
      outstanding: dues.outstanding, overdue: dues.overdueAmount, isDefaulter: dues.isDefaulter,
      nextDue: dues.next ? { amount: dues.next.amount, dueDate: dues.next.dueDate, title: dues.next.title } : null,
      blocked: !!blocked, blockedAt: blocked?.blockedAt || null, blockReason: blocked?.reason || null,
    });
  }
  let list = rows;
  if (q(req, 'program')) list = list.filter((r) => r.program === q(req, 'program'));
  if (q(req, 'department')) list = list.filter((r) => r.department === q(req, 'department'));
  if (q(req, 'semester')) list = list.filter((r) => String(r.semester) === q(req, 'semester'));
  if (q(req, 'q')) {
    const s = q(req, 'q').toLowerCase();
    // CNIC / phone are matched digit-only (so "17301-1234567-1" and
    // "1730112345671" both work) — but only when the query itself is
    // numeric, otherwise "ADCS-001" would match every "…001" phone number.
    const numeric = /^[0-9\s+\-]+$/.test(s);
    const digits = s.replace(/[^0-9]/g, '');
    list = list.filter((r) => [r.username, r.name, r.roll, r.email, r.cnic, r.phone].some((v) => str(v).toLowerCase().includes(s))
      || (numeric && digits.length >= 3 && [r.cnic, r.phone].some((v) => str(v).replace(/[^0-9]/g, '').includes(digits))));
  }
  list.sort((a, b) => b.overdue - a.overdue || str(a.roll).localeCompare(str(b.roll)));
  res.json({
    items: list,
    stats: {
      total: list.length,
      blocked: list.filter((r) => r.blocked).length,
      overdue: list.reduce((s, r) => s + r.overdue, 0),
      outstanding: list.reduce((s, r) => s + r.outstanding, 0),
    },
  });
}));

// ------------------------------------------------------------
// S9 — CONCESSIONS / SCHOLARSHIPS / INSTALMENT PLANS
// ------------------------------------------------------------
async function concessionRows(where) {
  const rows = await prisma.lmsFeeConcession.findMany({ where, orderBy: { grantedAt: 'desc' } });
  if (!rows.length) return [];
  const positions = await resolveStudentPositions();
  const names = await nameMap([...rows.map((r) => r.grantedById), ...rows.map((r) => r.revokedById)].filter(Boolean));
  return rows.map((r) => {
    const p = positions.get(r.studentId) || {};
    return {
      ...r, student: p.fullName || r.studentId, roll: p.rollNumber || '', program: p.program || '',
      department: p.department || '', currentSemester: p.semester,
      grantedBy: names[r.grantedById] || r.grantedById, revokedBy: r.revokedById ? (names[r.revokedById] || r.revokedById) : null,
    };
  });
}

router.get('/finance/concessions', PROVOST, asyncHandler(async (req, res) => {
  const where = {};
  if (q(req, 'studentId')) where.studentId = q(req, 'studentId');
  if (q(req, 'kind')) where.kind = q(req, 'kind').toUpperCase();
  if (q(req, 'active') === 'true') where.isActive = true;
  let items = await concessionRows(where);
  if (q(req, 'program')) items = items.filter((r) => r.program === q(req, 'program'));
  if (q(req, 'department')) items = items.filter((r) => r.department === q(req, 'department'));
  if (q(req, 'semester')) items = items.filter((r) => String(r.currentSemester) === q(req, 'semester'));
  if (q(req, 'q')) {
    const s = q(req, 'q').toLowerCase();
    items = items.filter((r) => [r.student, r.roll, r.title].some((v) => str(v).toLowerCase().includes(s)));
  }
  res.json({ items });
}));

// Fee preview for one student: Admission base fee, adjustments, net.
router.get('/finance/students/:id/fee-preview', PROVOST, asyncHandler(async (req, res) => {
  const positions = await resolveStudentPositions();
  const pos = positions.get(req.params.id);
  if (!pos) throw httpError(404, 'Student not found');
  const base = await fee.resolveBaseFee(pos.studentId, pos);
  const concessions = await prisma.lmsFeeConcession.findMany({ where: { studentId: pos.studentId, isActive: true } });
  const calc = base ? fee.computeNet(base.amount, concessions, pos.semester) : null;
  const plan = fee.activeInstallmentPlan(concessions, pos.semester);
  res.json({
    student: { id: pos.studentId, name: pos.fullName, roll: pos.rollNumber, program: pos.program, department: pos.department, semester: pos.semester },
    baseFee: base, calc,
    installmentPlan: plan && calc ? { count: plan.installments, rows: fee.splitInstallments(calc.net, plan.installments, plan.firstDueDate || fee.today()) } : null,
    dues: await fee.studentDues(pos.studentId),
  });
}));

router.post('/finance/concessions', PROVOST, validate([
  body('studentId').isString().notEmpty(),
  body('kind').isIn(['CONCESSION', 'SCHOLARSHIP', 'INSTALLMENT']).withMessage('kind must be CONCESSION, SCHOLARSHIP or INSTALLMENT'),
  body('title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('A title (3–120 characters) is required.'),
]), asyncHandler(async (req, res) => {
  const { studentId, kind } = req.body;
  const positions = await resolveStudentPositions();
  const pos = positions.get(studentId);
  if (!pos) throw httpError(404, 'Student not found');
  const base = await fee.resolveBaseFee(studentId, pos);
  if (!base) throw httpError(409, 'No Admission fee record was found for this student\'s program, so no adjustment can be applied.');
  const semester = req.body.semester != null && req.body.semester !== '' ? parseInt(req.body.semester, 10) : null;
  if (semester != null && (!Number.isInteger(semester) || semester < 1 || semester > 12)) throw httpError(400, 'Invalid semester.');
  const data = {
    studentId, kind, title: str(req.body.title).trim(), semester,
    note: req.body.note ? str(req.body.note).trim().slice(0, 500) : null, grantedById: req.lmsUser.id,
  };
  if (kind === 'INSTALLMENT') {
    const n = parseInt(req.body.installments, 10);
    if (!Number.isInteger(n) || n < 2 || n > 12) throw httpError(400, 'Number of monthly instalments must be between 2 and 12.');
    const first = str(req.body.firstDueDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || Number.isNaN(Date.parse(first))) throw httpError(400, 'First instalment due date is required.');
    const existing = await prisma.lmsFeeConcession.findFirst({ where: { studentId, kind: 'INSTALLMENT', isActive: true, semester } });
    if (existing) throw httpError(409, 'This student already has an active instalment plan for that semester. Revoke it first.');
    data.installments = n; data.firstDueDate = first;
  } else {
    const hasPct = req.body.percent != null && req.body.percent !== '';
    const hasAmt = req.body.amount != null && req.body.amount !== '';
    if (hasPct === hasAmt) throw httpError(400, 'Provide either a percentage or a fixed amount (not both).');
    if (hasPct) {
      const p = Number(req.body.percent);
      if (!(p > 0 && p <= 100)) throw httpError(400, 'Percentage must be between 0 and 100.');
      data.percent = p;
    } else {
      const a = Number(req.body.amount);
      if (!(a > 0 && a <= base.amount)) throw httpError(400, `Amount must be between 1 and the base fee (${fee.fmtPKR(base.amount)}).`);
      data.amount = Math.round(a);
    }
  }
  const row = await prisma.lmsFeeConcession.create({ data });
  const { repriced } = await fee.repriceStudent(studentId, pos);
  await audit(req, `PROVOST_FEE_${kind}_GRANT`, 'LmsFeeConcession', row.id, { after: { ...data, baseFee: base.amount, repriced } });
  const what = kind === 'INSTALLMENT'
    ? `a ${data.installments}-month instalment plan`
    : `${kind === 'SCHOLARSHIP' ? 'a scholarship' : 'a fee concession'} (${data.percent != null ? `${data.percent}%` : fee.fmtPKR(data.amount)})`;
  await notify(studentId, {
    title: kind === 'INSTALLMENT' ? 'Instalment plan approved' : (kind === 'SCHOLARSHIP' ? 'Scholarship granted' : 'Fee concession granted'),
    message: `You have been granted ${what}: ${data.title}.`, type: 'FEE', link: '/student/account',
  });
  fee.pushFeeUpdate(studentId, { concession: row.id });
  realtime.emitTo([req.lmsUser.id], 'fee:concession', { id: row.id });
  res.status(201).json({ concession: row, repriced });
}));

router.post('/finance/concessions/:id/revoke', PROVOST, validate([
  body('reason').isString().trim().isLength({ min: 5 }).withMessage('A reason (at least 5 characters) is required.'),
]), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = await prisma.lmsFeeConcession.findUnique({ where: { id } });
  if (!row) throw httpError(404, 'Record not found');
  if (!row.isActive) throw httpError(409, 'Already revoked.');
  const reason = str(req.body.reason).trim();
  const upd = await prisma.lmsFeeConcession.update({ where: { id }, data: { isActive: false, revokedById: req.lmsUser.id, revokedAt: new Date(), revokeReason: reason } });
  const positions = await resolveStudentPositions();
  const { repriced } = await fee.repriceStudent(row.studentId, positions.get(row.studentId) || {});
  await audit(req, `PROVOST_FEE_${row.kind}_REVOKE`, 'LmsFeeConcession', id, { before: { isActive: true }, after: { isActive: false, reason, repriced } });
  await notify(row.studentId, { title: 'Fee adjustment revoked', message: `${row.title} has been revoked. Reason: ${reason}.`, type: 'FEE', link: '/student/account' });
  fee.pushFeeUpdate(row.studentId, { concession: id, revoked: true });
  res.json({ concession: upd, repriced });
}));

module.exports = router;
module.exports.unblockIfClear = unblockIfClear;
