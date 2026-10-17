-- S10/S11 — additive, LMS-only tables. No existing table is altered.
CREATE TABLE IF NOT EXISTS "LmsStudentStanding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" TEXT NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "probations" INTEGER NOT NULL DEFAULT 0,
    "noReadmission" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "LmsStudentStanding_studentId_key" ON "LmsStudentStanding"("studentId");
CREATE INDEX IF NOT EXISTS "LmsStudentStanding_status_idx" ON "LmsStudentStanding"("status");

CREATE TABLE IF NOT EXISTS "LmsPromotionRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" TEXT NOT NULL,
    "fromSemester" INTEGER NOT NULL,
    "toSemester" INTEGER,
    "outcome" TEXT NOT NULL,
    "gpa" REAL NOT NULL,
    "cgpa" REAL NOT NULL,
    "passedCh" INTEGER NOT NULL,
    "failedCourses" TEXT NOT NULL DEFAULT '[]',
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "decidedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LmsPromotionRecord_studentId_idx" ON "LmsPromotionRecord"("studentId");
CREATE INDEX IF NOT EXISTS "LmsPromotionRecord_fromSemester_idx" ON "LmsPromotionRecord"("fromSemester");

CREATE TABLE IF NOT EXISTS "LmsSpecialExamCandidate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" TEXT NOT NULL,
    "courseId" INTEGER NOT NULL,
    "offeringId" INTEGER,
    "semester" INTEGER NOT NULL,
    "percent" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MARKED',
    "examOfferingId" INTEGER,
    "markedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "LmsSpecialExamCandidate_studentId_courseId_semester_key" ON "LmsSpecialExamCandidate"("studentId", "courseId", "semester");
CREATE INDEX IF NOT EXISTS "LmsSpecialExamCandidate_studentId_idx" ON "LmsSpecialExamCandidate"("studentId");
CREATE INDEX IF NOT EXISTS "LmsSpecialExamCandidate_status_idx" ON "LmsSpecialExamCandidate"("status");
