-- Registro manual de tempo estudado pela aba Timer/Cronômetro.

-- CreateEnum
CREATE TYPE "StudyTimeSource" AS ENUM ('TIMER', 'STOPWATCH');

-- CreateTable
CREATE TABLE "study_time_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subjectId" UUID,
    "source" "StudyTimeSource" NOT NULL,
    "seconds" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_time_entries_userId_recordedAt_idx" ON "study_time_entries"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "study_time_entries_subjectId_idx" ON "study_time_entries"("subjectId");

-- AddForeignKey
ALTER TABLE "study_time_entries" ADD CONSTRAINT "study_time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_time_entries" ADD CONSTRAINT "study_time_entries_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
