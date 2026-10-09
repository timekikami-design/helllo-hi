-- Section 2 — additive columns on the LMS-only TeacherMarksPin table.
ALTER TABLE "TeacherMarksPin" ADD COLUMN "isTemporary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeacherMarksPin" ADD COLUMN "resetAt" DATETIME;
ALTER TABLE "TeacherMarksPin" ADD COLUMN "resetById" INTEGER;
