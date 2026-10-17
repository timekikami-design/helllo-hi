// QA helper — LMS login now requires the server-side captcha (Section 1).
// Fetches a challenge and solves the math question (test tooling only).
async function lmsLogin(BASE, username, password = 'Lms@1234') {
  const c = await (await fetch(`${BASE}/api/lms/auth/captcha`)).json();
  const m = String(c.question).match(/(\d+) ([+\-×]) (\d+)/);
  const a = +m[1]; const b = +m[3];
  const answer = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
  const r = await fetch(`${BASE}/api/lms/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaId: c.captchaId, captchaAnswer: String(answer) }),
  });
  return r.json();
}
module.exports = { lmsLogin };
