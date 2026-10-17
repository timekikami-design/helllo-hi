-- Section 12 — additive, LMS-only table. No existing table is altered.
CREATE TABLE IF NOT EXISTS "LmsDepartmentCoordinator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departmentId" INTEGER NOT NULL,
    "lmsUserId" TEXT NOT NULL,
    "assignedById" INTEGER,
    "previousRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LmsDepartmentCoordinator_departmentId_lmsUserId_key" ON "LmsDepartmentCoordinator"("departmentId", "lmsUserId");
CREATE INDEX IF NOT EXISTS "LmsDepartmentCoordinator_departmentId_idx" ON "LmsDepartmentCoordinator"("departmentId");
CREATE INDEX IF NOT EXISTS "LmsDepartmentCoordinator_lmsUserId_idx" ON "LmsDepartmentCoordinator"("lmsUserId");
