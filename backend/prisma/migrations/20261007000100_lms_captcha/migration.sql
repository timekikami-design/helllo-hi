-- Section 1 — additive, LMS-only captcha table.
CREATE TABLE IF NOT EXISTS "LmsCaptchaChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LmsCaptchaChallenge_expiresAt_idx" ON "LmsCaptchaChallenge"("expiresAt");
