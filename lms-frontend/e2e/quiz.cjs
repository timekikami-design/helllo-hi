// Browser check for the student quiz runner: navigator, answered state,
// timer, submit confirmation and real submission.
//   node e2e/quiz.cjs
// Creates a throw-away quiz (teacher1 → offering 1), takes it as ADCS-001,
// then deletes the quiz and its attempt directly via Prisma.
const path = require('path');
const { chromium, openAs, API, realErrors, counter } = require('./lib.cjs');
const { lmsLogin } = require('../../backend/scripts/qa/lmsLogin.js');

const call = async (token, method, url, body) => {
  const r = await fetch(API + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};

(async () => {
  const { ok, done } = counter();
  const t = (await lmsLogin(API, 'teacher1')).token;
  const quiz = (await call(t, 'POST', '/lms/academic/teacher/offerings/1/quizzes', { title: 'QA Runner Quiz', description: 'qa', durationMin: 10 })).quiz;
  ok(!!quiz?.id, `teacher created quiz ${quiz?.id}`);
  await call(t, 'POST', `/lms/academic/teacher/quizzes/${quiz.id}/questions`, { text: 'QA: 2 + 2 = ?', type: 'MCQ', options: ['3', '4', '5'], correctAnswer: '1', marks: 1 });
  await call(t, 'POST', `/lms/academic/teacher/quizzes/${quiz.id}/questions`, { text: 'QA: the sky is blue', type: 'TRUEFALSE', options: ['True', 'False'], correctAnswer: '0', marks: 1 });
  await call(t, 'PUT', `/lms/academic/teacher/quizzes/${quiz.id}/publish`, { isPublished: true });

  const browser = await chromium.launch();
  try {
    const { page, errors } = await openAs(browser, 'ADCS-001', '/student/quizzes');
    await page.getByText('QA Runner Quiz', { exact: true }).first().waitFor();
    const row = page.locator('li', { hasText: 'QA Runner Quiz' });
    await row.getByRole('button', { name: /Start/ }).click();
    const dlg = page.getByRole('dialog', { name: /Quiz: QA Runner Quiz/ });
    await dlg.waitFor();
    ok(true, 'runner opened as a dialog');
    const timer = await dlg.getByLabel(/Time remaining/).textContent();
    ok(/^\s*(09|10):\d\d\s*$/.test(timer.replace(/[^\d:]/g, '')) || /0?9:\d\d|10:00/.test(timer), `timer shows ~10 min (${timer.trim()})`);
    ok(await dlg.getByRole('button', { name: 'Question 1, not answered' }).count() === 1, 'navigator shows Q1 not answered');
    await dlg.getByLabel('4').check();
    ok(await dlg.getByRole('button', { name: /Question 1, answered/ }).count() === 1, 'navigator marks Q1 answered');
    await dlg.getByRole('button', { name: /Flag for review/ }).click();
    ok(await dlg.getByRole('button', { name: /Question 1, answered, flagged/ }).count() === 1, 'flag reflected in navigator');
    await dlg.getByRole('button', { name: /^Next/ }).click();
    ok(await dlg.getByText('QA: the sky is blue').isVisible(), 'Next moves to Q2');
    await dlg.getByRole('button', { name: 'Submit quiz' }).click();
    const confirm = page.getByRole('dialog', { name: 'Submit this quiz?' });
    await confirm.waitFor();
    ok(/1 unanswered question/.test(await confirm.textContent()), 'confirm warns about 1 unanswered');
    await confirm.getByRole('button', { name: 'Keep working' }).click();
    await page.getByRole('dialog', { name: 'Submit this quiz?' }).waitFor({ state: 'detached' });
    await dlg.getByLabel('True').check();
    await dlg.getByRole('button', { name: 'Submit quiz' }).click();
    await confirm.waitFor();
    ok(!/unanswered/.test(await confirm.textContent()), 'confirm shows no unanswered after answering all');
    await confirm.getByRole('button', { name: 'Submit quiz' }).click();
    await dlg.waitFor({ state: 'detached' });
    await page.getByText(/scored 2\/2/i).first().waitFor({ timeout: 20000 });
    ok(true, 'real submission auto-graded 2/2 (toast)');
    ok(await row.getByRole('button', { name: /Result/ }).count() === 1, 'row now offers Result');
    const errs = realErrors(errors);
    ok(errs.length === 0, `no console errors ${errs.join(' | ')}`);
  } catch (e) {
    ok(false, `exception ${e.message}`);
  } finally {
    await browser.close();
    // Cleanup the throw-away quiz from the dev DB.
    process.chdir(path.join(__dirname, '..', '..', 'backend'));
    const { PrismaClient } = require(path.join(process.cwd(), 'node_modules', '@prisma/client'));
    const prisma = new PrismaClient();
    try {
      const m = prisma;
      const attempts = await m.quizAttempt.findMany({ where: { quizId: quiz.id } }).catch(() => []);
      if (m.quizAnswer) await m.quizAnswer.deleteMany({ where: { attemptId: { in: attempts.map((a) => a.id) } } }).catch(() => {});
      await m.quizAttempt.deleteMany({ where: { quizId: quiz.id } }).catch(() => {});
      await m.quizQuestion.deleteMany({ where: { quizId: quiz.id } }).catch(() => {});
      await m.quiz.delete({ where: { id: quiz.id } }).then(() => console.log('cleanup: quiz removed')).catch((e) => console.log('cleanup failed', e.message));
    } finally { await prisma.$disconnect(); }
    done();
  }
})();
