// ============================================================
//  QA — Sections 7, 8, 9 (Provost fees) end-to-end API test.
//  Run with the backend on :5000:  node scripts/qa/e2eFees.js
//  Uses only LMS accounts; reads (never writes) Admission fee data.
//  Cleans up every LMS row it creates.
// ============================================================
const path = require('path');
const fs = require('fs');
const os = require('os');
const { lmsLogin } = require('./lmsLogin');
const prisma = require('../../src/utils/prisma');

const BASE = process.env.QA_BASE || 'http://localhost:5000';
let pass = 0; let fail = 0;
const ok = (c, m, extra) => { if (c) pass += 1; else fail += 1; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && extra ? ` ${JSON.stringify(extra).slice(0, 300)}` : ''}`); };
const uid = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).userId;

async function call(token, method, p, body, isForm) {
  const headers = { Authorization: `Bearer ${token}` };
  if (!isForm && body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + p, { method, headers, body: isForm ? body : (body ? JSON.stringify(body) : undefined) });
  let d = null; try { d = await r.json(); } catch (_) { /* binary */ }
  return { s: r.status, d };
}

// 1x1 PNG
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
function form(fields, file) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
  if (file) f.append('screenshot', new Blob([file.buf], { type: file.type }), file.name);
  return f;
}

(async () => {
  const pv = (await lmsLogin(BASE, 'provost1')).token;
  const st = (await lmsLogin(BASE, 'ADCS-001')).token;
  const st2 = (await lmsLogin(BASE, 'ADCS-002')).token;
  const sid = uid(st); const sid2 = uid(st2);
  const P = '/api/lms/academic/provost';
  const S = '/api/lms/academic/student';
  const created = { ann: [], subs: [], conc: [] };
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);

  try {
    // Admission base fee (read-only)
    const prog = await prisma.program.findFirst({ where: { code: 'ADCS' } });
    const cp = await prisma.cycleProgram.findFirst({ where: { programId: prog.id }, orderBy: { admissionCycleId: 'desc' } });
    const fsRow = await prisma.feeStructure.findFirst({ where: { programId: prog.id }, orderBy: { cycleId: 'desc' } });
    const BASEFEE = fsRow?.totalAmount || cp?.totalFee || prog.fee;
    const admissionSnapshot = JSON.stringify(await prisma.cycleProgram.findMany()) + JSON.stringify(await prisma.feeStructure.findMany());
    console.log(`Admission base fee for ADCS = PKR ${BASEFEE}`);

    console.log('\nS7.1 Announcement (server-derived amount)');
    const opts = await call(pv, 'GET', `${P}/finance/filter-options`);
    const sem = opts.d.semesters.includes(1) ? 1 : opts.d.semesters[0];
    let r = await call(pv, 'POST', `${P}/finance/announcements`, { feeType: 'SEMESTER', title: 'QA Semester Fee', amount: 1, dueDate: future, scope: 'PROGRAM', program: 'ADCS' });
    ok(r.s === 400 && /cannot be entered/.test(r.d.error), 'Provost cannot set/edit a semester fee amount (400)', r.d);
    r = await call(pv, 'POST', `${P}/finance/announcements`, { feeType: 'SEMESTER', title: 'QA Semester Fee', scope: 'PROGRAM', program: 'ADCS' });
    ok(r.s === 400, 'deadline is required', r.d);
    r = await call(pv, 'POST', `${P}/finance/announcements`, { feeType: 'SEMESTER', title: 'QA Semester Fee', dueDate: past, scope: 'PROGRAM', program: 'ADCS' });
    ok(r.s === 400, 'past deadline rejected', r.d);
    r = await call(pv, 'POST', `${P}/finance/announcements`, {
      feeType: 'SEMESTER', title: 'QA Semester Fee', description: 'QA desc', dueDate: future, scope: 'SEMESTER', program: 'ADCS', semester: sem,
    });
    ok(r.s === 201 && r.d.challansCreated > 0, `semester/program-scoped announcement billed ${r.d.challansCreated} student(s)`, r.d);
    created.ann.push(r.d.announcement?.id);
    const fees = await call(st, 'GET', `${S}/fees`);
    const ch = fees.d.challans.find((c) => c.title === 'QA Semester Fee');
    ok(ch && ch.totalAmount === BASEFEE, `student challan amount = Admission fee (PKR ${ch?.totalAmount})`, ch);
    ok(ch && ch.notice === `You must submit PKR ${BASEFEE.toLocaleString('en-PK')} before ${new Date(`${future}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`, `notice: "${ch?.notice}"`);
    const n = await call(st, 'GET', `${S}/notifications`);
    ok(n.d.notifications.some((x) => x.title === 'New Semester Fee' && /You must submit PKR/.test(x.message)), 'student notified with "You must submit PKR X before …"');
    r = await call(pv, 'POST', `${P}/finance/announcements`, { feeType: 'SEMESTER', title: 'QA Semester Fee dup', dueDate: future, scope: 'SEMESTER', program: 'ADCS', semester: sem });
    ok(r.s === 201 && r.d.challansCreated === 0, 'no double billing of the same semester');
    created.ann.push(r.d.announcement?.id);

    console.log('\nS7.2 Payment proof');
    r = await call(st, 'POST', `${S}/fees/${ch.id}/pay`, {});
    ok(r.s === 410, 'one-click Pay Now (no proof) retired → 410');
    const good = { method: 'JAZZCASH', amount: BASEFEE, transactionId: 'QA-TXN-0001', paidOn: today };
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form({ ...good, amount: BASEFEE - 1 }, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 400 && /exactly/.test(r.d.error), 'wrong amount rejected', r.d);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good), true);
    ok(r.s === 400 && /screenshot/i.test(r.d.error), 'screenshot required', r.d);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good, { buf: Buffer.from('MZ not an image'), type: 'image/png', name: 'x.png' }), true);
    ok(r.s === 400 && /valid PNG/.test(r.d.error), 'fake image (bad magic bytes) rejected', r.d);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good, { buf: Buffer.from('%PDF-1.4'), type: 'application/pdf', name: 'x.pdf' }), true);
    ok(r.s === 400, 'non-image type rejected', r.d);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good, { buf: Buffer.concat([PNG, Buffer.alloc(2.1 * 1024 * 1024)]), type: 'image/png', name: 'big.png' }), true);
    ok(r.s === 400 && /MB/.test(r.d.error), 'screenshot > 2 MB rejected', r.d);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form({ ...good, method: 'CASH' }, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 400, 'invalid method rejected');
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 201 && r.d.submission.status === 'PENDING', 'valid submission → PENDING', r.d);
    const sub1 = r.d.submission?.id; created.subs.push(sub1);
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form(good, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 409, 'second submission while pending blocked');
    let f2 = await call(st, 'GET', `${S}/fees`);
    ok(f2.d.challans.find((c) => c.id === ch.id)?.submission?.status === 'PENDING', 'student sees Pending');
    r = await call(pv, 'GET', `${P}/finance/submissions?status=PENDING`);
    ok(r.d.items.some((x) => x.id === sub1 && x.transactionId === 'QA-TXN-0001'), 'Provost sees the submission');
    const shot = await fetch(`${BASE}${P}/finance/submissions/${sub1}/screenshot`, { headers: { Authorization: `Bearer ${pv}` } });
    ok(shot.status === 200 && (shot.headers.get('content-type') || '').startsWith('image/'), 'Provost can view screenshot');
    const shotOther = await fetch(`${BASE}${S}/fees/submissions/${sub1}/screenshot`, { headers: { Authorization: `Bearer ${st2}` } });
    ok(shotOther.status === 404, "another student cannot view this screenshot");
    r = await call(pv, 'PUT', `${P}/finance/submissions/${sub1}/decide`, { action: 'reject' });
    ok(r.s === 400, 'reject without reason refused');
    r = await call(pv, 'PUT', `${P}/finance/submissions/${sub1}/decide`, { action: 'reject', reason: 'Transaction ID not found in JazzCash statement' });
    ok(r.s === 200, 'reject with reason');
    f2 = await call(st, 'GET', `${S}/fees`);
    const afterRej = f2.d.challans.find((c) => c.id === ch.id);
    ok(afterRej.submission.status === 'REJECTED' && /not found/.test(afterRej.submission.rejectionReason) && afterRej.canSubmit, 'student sees Rejected + reason and can resubmit');

    console.log('\nS8 Defaulters + block');
    r = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=ADCS-001`);
    ok(r.d.items.some((x) => x.studentId === sid) && r.d.items.every((x) => /ADCS-001/i.test(`${x.roll} ${x.username}`)), 'search by roll/username');
    const me = r.d.items.find((x) => x.studentId === sid);
    if (me.cnic) { const s2 = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=${encodeURIComponent(me.cnic.replace(/-/g, '').slice(0, 9))}`); ok(s2.d.items.some((x) => x.studentId === sid), 'search by CNIC digits'); }
    if (me.phone) { const s3 = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=${encodeURIComponent(me.phone.slice(-6))}`); ok(s3.d.items.some((x) => x.studentId === sid), 'search by phone'); }
    if (me.email) { const s4 = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=${encodeURIComponent(me.email)}`); ok(s4.d.items.some((x) => x.studentId === sid), 'search by email'); }
    if (me.name) { const s5 = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=${encodeURIComponent(me.name.split(' ')[0])}&program=ADCS&semester=${me.semester}`); ok(s5.d.items.some((x) => x.studentId === sid), 'search by name combined with program+semester filters'); }
    const s6 = await call(pv, 'GET', `${P}/finance/defaulters?include=all&q=ADCS-001&department=__none__`);
    ok(s6.d.items.length === 0, 'department filter narrows results');
    // make it overdue → defaulter
    await prisma.lmsFeeChallan.update({ where: { id: ch.id }, data: { dueDate: past } });
    r = await call(pv, 'GET', `${P}/finance/defaulters`);
    ok(r.d.items.some((x) => x.studentId === sid && x.isDefaulter && x.overdue === BASEFEE), 'overdue student listed as defaulter');
    r = await call(pv, 'POST', `${P}/finance/students/bulk-block`, { studentIds: [sid, sid2], reason: 'QA fee not submitted' });
    ok(r.s === 201 && r.d.blockedCount === 2, 'bulk block 2 students');
    for (const pth of ['/api/lms/academic/student/dashboard', '/api/lms/academic/student/courses', '/api/lms/academic/student/results', '/api/lms/student/profile', '/api/lms/academic/programs']) {
      const b = await call(st, 'GET', pth);
      ok(b.s === 403 && b.d.code === 'FEE_BLOCKED' && b.d.error === 'Your fee has not been submitted. Please submit your fee first.', `blocked: ${pth} → 403 FEE_BLOCKED`, b);
    }
    const allowedFees = await call(st, 'GET', `${S}/fees`);
    ok(allowedFees.s === 200 && allowedFees.d.blocked === true && allowedFees.d.blockMessage, 'Fee module still reachable while blocked');
    const fstat = await call(st, 'GET', `${S}/fee-status`);
    ok(fstat.s === 200 && fstat.d.blocked, '/fee-status reports block');
    const relog = await lmsLogin(BASE, 'ADCS-001');
    ok(!!relog.token, 'blocked student can still log in (to reach the Fee module)');
    const meR = await call(relog.token, 'GET', '/api/lms/auth/me');
    ok(meR.s === 200, '/auth/me works while blocked');
    // resubmit + approve → unblock in one action
    r = await call(st, 'POST', `${S}/fees/${ch.id}/submissions`, form({ ...good, transactionId: 'QA-TXN-0002' }, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 201, 'blocked student resubmits proof'); const sub2 = r.d.submission?.id; created.subs.push(sub2);
    r = await call(pv, 'PUT', `${P}/finance/submissions/${sub2}/decide`, { action: 'approve' });
    ok(r.s === 200 && r.d.challanStatus === 'PAID' && r.d.block.unblocked === true, 'approve → challan PAID and student unblocked in one action', r.d);
    const unb = await call(st, 'GET', '/api/lms/academic/student/dashboard');
    ok(unb.s === 200, 'student APIs work again after approval');
    r = await call(pv, 'PUT', `${P}/finance/submissions/${sub2}/decide`, { action: 'approve' });
    ok(r.s === 409, 'cannot decide twice');
    r = await call(pv, 'POST', `${P}/finance/students/bulk-unblock`, { studentIds: [sid2] });
    ok(r.s === 200 && r.d.restoredCount === 1, 'bulk unblock');
    r = await call(pv, 'POST', `${P}/finance/students/${sid2}/block`, { reason: 'QA single block' });
    ok(r.s === 201, 'single block');
    r = await call(pv, 'POST', `${P}/finance/students/${sid2}/unblock`, {});
    ok(r.s === 200, 'single unblock');

    console.log('\nS9 Concessions / scholarships / instalments');
    const ch2 = (await call(st2, 'GET', `${S}/fees`)).d.challans.find((c) => c.title === 'QA Semester Fee');
    ok(ch2 && ch2.totalAmount === BASEFEE, 'second student billed base fee');
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'CONCESSION', title: 'QA Need-based', percent: 20, amount: 100 });
    ok(r.s === 400, 'percent AND amount together rejected');
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'CONCESSION', title: 'QA Need-based', amount: BASEFEE + 1 });
    ok(r.s === 400, 'concession larger than the base fee rejected');
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'CONCESSION', title: 'QA Need-based', percent: 20 });
    ok(r.s === 201 && r.d.repriced === 1, '20% concession granted and challan re-priced'); created.conc.push(r.d.concession?.id);
    let c2 = (await call(st2, 'GET', `${S}/fees`)).d.challans.find((c) => c.id === ch2.id);
    ok(c2.totalAmount === Math.round(BASEFEE * 0.8), `net = ${c2.totalAmount} (base ${BASEFEE} unchanged in line items)`);
    ok(c2.lineItems[0].amount === BASEFEE && c2.lineItems.some((l) => l.amount < 0), 'base fee line + concession deduction line');
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'SCHOLARSHIP', title: 'QA Merit', amount: 5000 });
    ok(r.s === 201, 'scholarship granted'); created.conc.push(r.d.concession?.id);
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'INSTALLMENT', title: 'QA 3-month plan', installments: 3, firstDueDate: future });
    ok(r.s === 201, 'instalment plan granted'); created.conc.push(r.d.concession?.id);
    c2 = (await call(st2, 'GET', `${S}/fees`)).d.challans.find((c) => c.id === ch2.id);
    const net = Math.round(BASEFEE * 0.8) - 5000;
    ok(c2.totalAmount === net && c2.installments.length === 3 && c2.installments.reduce((a, i) => a + i.amount, 0) === net, `3 instalments summing to ${net}`);
    ok(c2.amountDue === c2.installments[0].amount && /You must submit PKR/.test(c2.notice), `notice shows first instalment: ${c2.notice}`);
    r = await call(pv, 'POST', `${P}/finance/concessions`, { studentId: sid2, kind: 'INSTALLMENT', title: 'QA dup', installments: 2, firstDueDate: future });
    ok(r.s === 409, 'second active instalment plan blocked');
    // pay instalment 1
    r = await call(st2, 'POST', `${S}/fees/${ch2.id}/submissions`, form({ method: 'EASYPAISA', amount: c2.installments[0].amount, transactionId: 'QA-TXN-0003', paidOn: today }, { buf: PNG, type: 'image/png', name: 'p.png' }), true);
    ok(r.s === 201, 'instalment 1 proof submitted'); created.subs.push(r.d.submission?.id);
    r = await call(pv, 'PUT', `${P}/finance/submissions/${r.d.submission.id}/decide`, { action: 'approve' });
    ok(r.s === 200 && r.d.challanStatus !== 'PAID', 'instalment 1 approved; challan still open');
    c2 = (await call(st2, 'GET', `${S}/fees`)).d.challans.find((c) => c.id === ch2.id);
    ok(c2.installments[0].status === 'PAID' && c2.amountDue === c2.installments[1].amount, 'next amount due = instalment 2');
    // revoke concession on a challan with money in flight → locked (no re-price)
    r = await call(pv, 'POST', `${P}/finance/concessions/${created.conc[0]}/revoke`, { reason: 'QA revoke test' });
    ok(r.s === 200 && r.d.repriced === 0, 'revoke recorded; challan with a paid instalment is not re-priced (no data loss)');
    r = await call(pv, 'GET', `${P}/finance/concessions?studentId=${sid2}`);
    const hist = r.d.items;
    ok(hist.length === 3 && hist.some((h) => !h.isActive && h.revokeReason === 'QA revoke test' && h.revokedBy) && hist.every((h) => h.grantedBy && h.grantedAt), 'history: who granted/revoked what and when');
    r = await call(pv, 'GET', `${P}/finance/students/${sid2}/fee-preview`);
    ok(r.s === 200 && r.d.baseFee.amount === BASEFEE, 'fee preview shows unchanged Admission base fee');
    r = await call(st, 'GET', `${P}/finance/concessions`);
    ok(r.s === 403, 'students cannot use Provost fee APIs');

    const admissionAfter = JSON.stringify(await prisma.cycleProgram.findMany()) + JSON.stringify(await prisma.feeStructure.findMany());
    ok(admissionAfter === admissionSnapshot, 'Admission fee tables unchanged (read-only)');
  } finally {
    // cleanup LMS rows created by this test
    const anns = created.ann.filter(Boolean);
    const challans = await prisma.lmsFeeChallan.findMany({ where: { sourceAnnouncementId: { in: anns } }, select: { id: true } });
    const cIds = challans.map((c) => c.id);
    const subs = await prisma.lmsFeePaymentSubmission.findMany({ where: { challanId: { in: cIds } } });
    for (const s of subs) { try { fs.unlinkSync(path.join(__dirname, '..', '..', 'uploads', 'lms-fee-proofs', s.screenshotPath)); } catch (_) { /* ignore */ } }
    await prisma.lmsFeePaymentSubmission.deleteMany({ where: { challanId: { in: cIds } } });
    await prisma.lmsFeeInstallment.deleteMany({ where: { challanId: { in: cIds } } });
    await prisma.lmsFeeChallan.deleteMany({ where: { id: { in: cIds } } });
    await prisma.lmsFeeAnnouncement.deleteMany({ where: { id: { in: anns } } });
    await prisma.lmsFeeConcession.deleteMany({ where: { title: { startsWith: 'QA' } } });
    await prisma.lmsStudentBlock.deleteMany({ where: { reason: { startsWith: 'QA' } } });
    void os;
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
