-- S7.2 / S9 — additive, LMS-only tables. No existing table is altered.
CREATE TABLE IF NOT EXISTS "LmsFeePaymentSubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "challanId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paidOn" TEXT NOT NULL,
    "screenshotPath" TEXT NOT NULL,
    "screenshotName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "LmsFeePaymentSubmission_challanId_idx" ON "LmsFeePaymentSubmission"("challanId");
CREATE INDEX IF NOT EXISTS "LmsFeePaymentSubmission_studentId_idx" ON "LmsFeePaymentSubmission"("studentId");
CREATE INDEX IF NOT EXISTS "LmsFeePaymentSubmission_status_idx" ON "LmsFeePaymentSubmission"("status");

CREATE TABLE IF NOT EXISTS "LmsFeeConcession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "percent" REAL,
    "amount" REAL,
    "installments" INTEGER,
    "firstDueDate" TEXT,
    "semester" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" TEXT,
    "revokedAt" DATETIME,
    "revokeReason" TEXT
);
CREATE INDEX IF NOT EXISTS "LmsFeeConcession_studentId_idx" ON "LmsFeeConcession"("studentId");
CREATE INDEX IF NOT EXISTS "LmsFeeConcession_kind_idx" ON "LmsFeeConcession"("kind");
CREATE INDEX IF NOT EXISTS "LmsFeeConcession_isActive_idx" ON "LmsFeeConcession"("isActive");

CREATE TABLE IF NOT EXISTS "LmsFeeInstallment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "concessionId" INTEGER NOT NULL,
    "challanId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LmsFeeInstallment_challanId_idx" ON "LmsFeeInstallment"("challanId");
CREATE INDEX IF NOT EXISTS "LmsFeeInstallment_studentId_idx" ON "LmsFeeInstallment"("studentId");
CREATE INDEX IF NOT EXISTS "LmsFeeInstallment_concessionId_idx" ON "LmsFeeInstallment"("concessionId");
