-- CreateTable
CREATE TABLE "SupabaseHealthCheck" (
    "id" SERIAL NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallStatus" TEXT NOT NULL DEFAULT 'not ok',
    "sessionStatus" TEXT NOT NULL DEFAULT 'not ok',
    "migrationStatus" TEXT NOT NULL DEFAULT 'not ok',
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "migrationErrors" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SupabaseHealthCheck_pkey" PRIMARY KEY ("id")
);
