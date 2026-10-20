-- LMS 10-change update — additive only. No existing column is dropped/renamed.
ALTER TABLE "SchemeOfStudy" ADD COLUMN "batch" TEXT;

CREATE TABLE IF NOT EXISTS "LmsTeacherDepartment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lmsUserId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LmsTeacherDepartment_lmsUserId_department_key" ON "LmsTeacherDepartment"("lmsUserId", "department");
CREATE INDEX IF NOT EXISTS "LmsTeacherDepartment_lmsUserId_idx" ON "LmsTeacherDepartment"("lmsUserId");
CREATE INDEX IF NOT EXISTS "LmsTeacherDepartment_department_idx" ON "LmsTeacherDepartment"("department");

CREATE TABLE IF NOT EXISTS "LandingContent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LandingContent_key_key" ON "LandingContent"("key");
