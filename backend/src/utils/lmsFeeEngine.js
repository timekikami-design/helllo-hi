// ============================================================
//  LMS FEE ENGINE  (Sections 7, 8, 9)
// ------------------------------------------------------------
//  Single source of truth for what an LMS student owes.
//
//  * Base fee  — READ-ONLY from the Admission System's Fee Management
//    record for the student's admitted program + cycle:
//        Enrollment(lmsUserId) → Application(userId, latest)
//          → FeeStructure(cycleId, programId).totalAmount
//          → else CycleProgram(admissionCycleId, programId).totalFee
//    For LMS students without an admission link (seeded / legacy
//    accounts) the program's latest Admission fee is used, matched by the
//    Admission Program code. Nothing is ever written to Admission tables.
//    The base fee is the same every semester up to the program's last
//    semester and cannot be edited from the LMS.
//  * Adjustments — LMS-only LmsFeeConcession rows (CONCESSION /
//    SCHOLARSHIP) reduce the payable amount; INSTALLMENT plans split it
//    into monthly LmsFeeInstallment rows.
//  * Defaulter status — unpaid challans / instalments past their due date.
// ============================================================
const prisma = require('./prisma');
const realtime = require('./lmsRealtime');

const BLOCK_MESSAGE = 'Your fee has not been submitted. Please submit your fee first.';
const METHODS = ['BANK', 'JAZZCASH', 'EASYPAISA'];
const METHOD_LABEL = { BANK: 'Bank Transfer', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa' };

const round = (n) => Math.round(Number(n || 0));
const today = () => new Date().toISOString().slice(0, 10);
const parseJson = (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };

// ------------------------------------------------------------
// BASE FEE (read-only Admission lookup)
// ------------------------------------------------------------
async function feeFromCycleProgram(cycleId, programId) {
  const fs = await prisma.feeStructure.findUnique({ where: { cycleId_programId: { cycleId, programId } } }).catch(() => null);
  if (fs && fs.totalAmount > 0) return { amount: fs.totalAmount, lineItems: parseJson(fs.lineItems, []), source: 'ADMISSION_FEE_STRUCTURE' };
  const cp = await prisma.cycleProgram.findUnique({
    where: { admissionCycleId_programId: { admissionCycleId: cycleId, programId } },
  }).catch(() => null);
  if (cp && cp.totalFee > 0) return { amount: cp.totalFee, lineItems: parseJson(cp.feeBreakdown, []), source: 'ADMISSION_CYCLE_PROGRAM' };
  return null;
}

/**
 * Resolve a student's per-semester base fee from the Admission System.
 * @returns {Promise<{amount:number, lineItems:Array, source:string}|null>}
 */
async function resolveBaseFee(lmsUserId, pos = {}) {
  const enrollment = await prisma.enrollment.findFirst({ where: { lmsUserId } }).catch(() => null);
  if (enrollment?.userId) {
    const app = await prisma.application.findFirst({
      where: { userId: enrollment.userId },
      orderBy: { submittedAt: 'desc' },
      select: { programId: true, admissionCycleId: true },
    }).catch(() => null);
    if (app) {
      const f = await feeFromCycleProgram(app.admissionCycleId, app.programId);
      if (f) return f;
    }
  }
  const code = pos.program || null;
  if (!code) return null;
  const program = await prisma.program.findFirst({
    where: { OR: [{ code }, { shortForm: code }] }, select: { id: true, fee: true },
  }).catch(() => null);
  if (!program) return null;
  const fs = await prisma.feeStructure.findFirst({ where: { programId: program.id }, orderBy: { cycleId: 'desc' } }).catch(() => null);
  if (fs && fs.totalAmount > 0) return { amount: fs.totalAmount, lineItems: parseJson(fs.lineItems, []), source: 'ADMISSION_FEE_STRUCTURE' };
  const cp = await prisma.cycleProgram.findFirst({ where: { programId: program.id }, orderBy: { admissionCycleId: 'desc' } }).catch(() => null);
  if (cp && cp.totalFee > 0) return { amount: cp.totalFee, lineItems: parseJson(cp.feeBreakdown, []), source: 'ADMISSION_CYCLE_PROGRAM' };
  if (program.fee > 0) return { amount: program.fee, lineItems: [], source: 'ADMISSION_PROGRAM' };
  return null;
}

// ------------------------------------------------------------
// CONCESSIONS / SCHOLARSHIPS / INSTALMENTS
// ------------------------------------------------------------
function appliesToSemester(c, semester) {
  return c.semester == null || semester == null || Number(c.semester) === Number(semester);
}

/** Payable amount after active concessions/scholarships (base never changes). */
function computeNet(base, concessions, semester) {
  const deductions = [];
  let remaining = round(base);
  for (const c of concessions) {
    if (!c.isActive || !['CONCESSION', 'SCHOLARSHIP'].includes(c.kind) || !appliesToSemester(c, semester)) continue;
    const off = c.percent != null ? round((base * Number(c.percent)) / 100) : round(c.amount);
    const applied = Math.min(off, remaining);
    if (applied <= 0) continue;
    remaining -= applied;
    deductions.push({
      concessionId: c.id, kind: c.kind,
      label: `${c.kind === 'SCHOLARSHIP' ? 'Scholarship' : 'Concession'}: ${c.title}${c.percent != null ? ` (${c.percent}%)` : ''}`,
      amount: -applied,
    });
  }
  return { base: round(base), deductions, net: remaining };
}

function activeInstallmentPlan(concessions, semester) {
  return concessions.find((c) => c.isActive && c.kind === 'INSTALLMENT' && appliesToSemester(c, semester)) || null;
}

function addMonths(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function splitInstallments(total, count, firstDue) {
  const n = Math.max(1, Number(count) || 1);
  const each = Math.floor(total / n);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({ seq: i + 1, amount: i === n - 1 ? total - each * (n - 1) : each, dueDate: addMonths(firstDue, i) });
  }
  return rows;
}

// ------------------------------------------------------------
// CHALLAN re-pricing (semester fee challans only)
// ------------------------------------------------------------
async function isChallanLocked(challanId) {
  const [sub, paidInst] = await Promise.all([
    prisma.lmsFeePaymentSubmission.count({ where: { challanId, status: { in: ['PENDING', 'APPROVED'] } } }),
    prisma.lmsFeeInstallment.count({ where: { challanId, status: 'PAID' } }),
  ]);
  return sub > 0 || paidInst > 0;
}

/**
 * Re-price one open semester challan from the base fee + active
 * concessions and (re)generate its instalments. Never touches PAID
 * challans or challans with money already submitted / received.
 */
async function repriceChallan(challan, { base, concessions }) {
  if (challan.status === 'PAID') return { changed: false };
  if (await isChallanLocked(challan.id)) return { changed: false, locked: true };
  const { net, deductions } = computeNet(base, concessions, challan.semester);
  const lineItems = [{ label: 'Semester Fee (Admission fee structure)', amount: round(base) }, ...deductions.map((d) => ({ label: d.label, amount: d.amount }))];
  const status = net <= 0 ? 'WAIVED' : 'UNPAID';
  const updated = await prisma.lmsFeeChallan.update({
    where: { id: challan.id },
    data: { lineItems: JSON.stringify(lineItems), totalAmount: net, status },
  });
  await prisma.lmsFeeInstallment.deleteMany({ where: { challanId: challan.id, status: 'UNPAID' } });
  const plan = activeInstallmentPlan(concessions, challan.semester);
  if (plan && net > 0) {
    const rows = splitInstallments(net, plan.installments, plan.firstDueDate || challan.dueDate || today());
    await prisma.lmsFeeInstallment.createMany({
      data: rows.map((r) => ({ ...r, concessionId: plan.id, challanId: challan.id, studentId: challan.studentId })),
    });
  }
  return { changed: true, challan: updated, net };
}

/** Re-price every open semester challan of a student. */
async function repriceStudent(studentId, pos) {
  const baseFee = await resolveBaseFee(studentId, pos);
  if (!baseFee) return { repriced: 0 };
  const concessions = await prisma.lmsFeeConcession.findMany({ where: { studentId }, orderBy: { grantedAt: 'asc' } });
  const challans = await prisma.lmsFeeChallan.findMany({
    where: { studentId, feeType: 'SEMESTER', sourceAnnouncementId: { not: null }, status: { in: ['UNPAID', 'OVERDUE', 'WAIVED'] } },
  });
  let repriced = 0;
  for (const c of challans) {
    const r = await repriceChallan(c, { base: baseFee.amount, concessions });
    if (r.changed) repriced += 1;
  }
  return { repriced };
}

// ------------------------------------------------------------
// DUES for one student — next amount to pay + defaulter flag
// ------------------------------------------------------------
async function studentDues(studentId) {
  const challans = await prisma.lmsFeeChallan.findMany({
    where: { studentId, status: { in: ['UNPAID', 'OVERDUE'] } }, orderBy: { createdAt: 'asc' },
  });
  const insts = challans.length ? await prisma.lmsFeeInstallment.findMany({
    where: { challanId: { in: challans.map((c) => c.id) } }, orderBy: [{ challanId: 'asc' }, { seq: 'asc' }],
  }) : [];
  const t = today();
  let outstanding = 0; let overdueAmount = 0; let next = null;
  for (const c of challans) {
    const mine = insts.filter((i) => i.challanId === c.id);
    if (mine.length) {
      for (const i of mine.filter((x) => x.status === 'UNPAID')) {
        outstanding += i.amount;
        if (i.dueDate && i.dueDate < t) overdueAmount += i.amount;
        if (!next) next = { challanId: c.id, installmentId: i.id, seq: i.seq, of: mine.length, amount: i.amount, dueDate: i.dueDate, title: c.title };
      }
    } else {
      outstanding += c.totalAmount;
      if (c.dueDate && c.dueDate < t) overdueAmount += c.totalAmount;
      if (!next) next = { challanId: c.id, installmentId: null, amount: c.totalAmount, dueDate: c.dueDate, title: c.title };
    }
  }
  return { outstanding, overdueAmount, isDefaulter: overdueAmount > 0, next };
}

/** The exact amount a payment submission for `challan` must equal. */
async function expectedPayment(challan) {
  const next = await prisma.lmsFeeInstallment.findFirst({ where: { challanId: challan.id, status: 'UNPAID' }, orderBy: { seq: 'asc' } });
  return next ? { amount: next.amount, installment: next } : { amount: challan.totalAmount, installment: null };
}

// ------------------------------------------------------------
// BLOCK STATE + realtime pushes
// ------------------------------------------------------------
async function activeBlock(studentId) {
  return prisma.lmsStudentBlock.findFirst({ where: { studentId, unblockedAt: null }, orderBy: { blockedAt: 'desc' } });
}
function pushBlockState(studentId, blocked, extra = {}) {
  try { realtime.emitTo([studentId], 'fee:block', { blocked, message: blocked ? BLOCK_MESSAGE : null, ...extra }); } catch (_) { /* non-blocking */ }
}
function pushFeeUpdate(studentId, data = {}) {
  try { realtime.emitTo([studentId], 'fee:updated', data); } catch (_) { /* non-blocking */ }
}

const fmtPKR = (n) => `PKR ${round(n).toLocaleString('en-PK')}`;
function fmtDate(d) {
  if (!d) return 'the deadline';
  try { return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch { return String(d); }
}
function dueNotice(amount, dueDate) {
  return `You must submit ${fmtPKR(amount)} before ${fmtDate(dueDate)}.`;
}

module.exports = {
  BLOCK_MESSAGE, METHODS, METHOD_LABEL,
  resolveBaseFee, computeNet, activeInstallmentPlan, splitInstallments, addMonths,
  repriceChallan, repriceStudent, isChallanLocked,
  studentDues, expectedPayment, activeBlock, pushBlockState, pushFeeUpdate,
  fmtPKR, fmtDate, dueNotice, today,
};
