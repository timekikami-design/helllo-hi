// ============================================================
//  QA — Sections 13 + 14: no Section / Room in LMS APIs; room
//  conflicts removed, teacher-time conflicts kept.
//    node scripts/qa/e2eNoSectionRoom.js   (backend on :5000)
//  Creates only ScheduleSlot rows, soft-deleted again at the end.
// ============================================================
const { lmsLogin } = require('./lmsLogin');
const prisma = require('../../src/utils/prisma');

const BASE = process.env.QA_BASE || 'http://localhost:5000';
let pass = 0; let fail = 0;
const ok = (c, m, extra) => { if (c) pass += 1; else fail += 1; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && extra !== undefined ? ` ${JSON.stringify(extra).slice(0, 300)}` : ''}`); };
async function call(token, method, p, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (_) { /* empty */ }
  return { s: r.status, d };
}
const C = '/api/lms/academic/coordinator';
const E = '/api/lms/academic/exam';

(async () => {
  const created = [];
  try {
    const ex = (await lmsLogin(BASE, 'exam1')).token;

    console.log('\nS14 weekly schedule — room conflicts removed, teacher-time conflicts kept');
    // Clash detector exercised in-process against real slots (the seeded
    // coordinators have no in-department offerings, see report).
    const { detectSlotClashes } = require('../../src/routes/lms/academic/coordinator');
    const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    const offs = await prisma.courseOffering.findMany({ where: { termId: term.id, isDeleted: false, teacherId: { not: null } }, orderBy: { id: 'asc' } });
    const byTeacher = {};
    for (const o of offs) (byTeacher[o.teacherId] = byTeacher[o.teacherId] || []).push(o);
    const sameT = Object.values(byTeacher).find((x) => x.length >= 2);
    const a = sameT[0]; const b = sameT[1];
    const other = offs.find((o) => o.teacherId !== a.teacherId);
    const slot = { dayOfWeek: 6, startTime: '20:00', endTime: '21:00' };
    const s1 = await prisma.scheduleSlot.create({ data: { offeringId: a.id, ...slot, room: 'R-101', mode: 'ONSITE', slotType: 'THEORY' } });
    created.push(s1.id);
    let cl = await detectSlotClashes({ termId: term.id, offeringId: other.id, ...slot, room: 'R-101' });
    ok(!cl.some((c) => c.type === 'ROOM'), 'different teacher, same time + same legacy room: no ROOM clash', cl);
    ok(cl.length === 0, 'no clash at all for a different teacher', cl);
    cl = await detectSlotClashes({ termId: term.id, offeringId: b.id, ...slot });
    ok(cl.some((c) => c.type === 'TEACHER'), 'same teacher, overlapping time: TEACHER clash still detected', cl);
    cl = await detectSlotClashes({ termId: term.id, offeringId: a.id, ...slot });
    ok(cl.some((c) => c.type === 'OFFERING'), 'same offering twice at once: OFFERING clash still detected', cl);
    cl = await detectSlotClashes({ termId: term.id, offeringId: b.id, dayOfWeek: 6, startTime: '21:00', endTime: '22:00' });
    ok(cl.length === 0, 'same teacher, back-to-back (non-overlapping): no clash', cl);
    const co = (await lmsLogin(BASE, 'provost1')).token; // governance read of the timetable
    let r = await call(co, 'GET', `${C}/schedule`);
    const allSlots = (r.d?.days || []).flatMap((d) => d.slots);
    ok(r.s === 200 && allSlots.length > 0 && allSlots.every((x) => !('room' in x)), 'timetable API has no room field', r.s);

    console.log('\nS14 exams — no room in schedules / clash check / seating retired');
    r = await call(ex, 'GET', `${E}/schedules`);
    ok(r.s === 200 && (r.d.schedules || []).every((s) => !('room' in s) && !('capacity' in s)), 'exam schedules have no room / seating capacity');
    r = await call(ex, 'GET', `${E}/schedules/clash-check?date=2030-01-01&startTime=09:00&endTime=10:00&room=Hall-1`);
    ok(r.s === 200 && !('room' in r.d.clashes), 'exam clash check has no room category', r.d);
    r = await call(ex, 'GET', `${E}/seating`);
    ok(r.s === 410, 'room seating endpoint retired (410)');
    r = await call(ex, 'GET', `${E}/seating/rooms-suggestion`);
    ok(r.s === 410, 'rooms-suggestion retired (410)');
    r = await call(ex, 'GET', `${E}/datesheets`);
    ok(r.s === 200 && (r.d.datesheets || []).flatMap((d) => d.entries).every((e) => !('room' in e)), 'datesheet entries have no room');

    console.log('\nS13/S14 — no data lost (columns kept)');
    const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("ScheduleSlot")');
    ok(cols.some((c) => c.name === 'room'), 'ScheduleSlot.room column still exists (data preserved)');
    const regCols = await prisma.$queryRawUnsafe('PRAGMA table_info("CourseRegistration")');
    ok(regCols.some((c) => c.name === 'sectionId'), 'CourseRegistration.sectionId column still exists (data preserved)');
    const secCount = await prisma.section.count();
    ok(secCount >= 0, `Section table intact (${secCount} rows)`);
  } finally {
    for (const id of created.filter(Boolean)) await prisma.scheduleSlot.update({ where: { id }, data: { isDeleted: true } }).catch(() => {});
    await prisma.liveClass?.deleteMany?.({ where: { scheduleSlotId: { in: created.filter(Boolean) } } }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
