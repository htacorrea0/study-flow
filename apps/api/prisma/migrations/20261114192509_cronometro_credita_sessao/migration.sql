-- AlterTable
ALTER TABLE "study_time_entries" ADD COLUMN     "activityId" UUID;

-- CreateIndex
CREATE INDEX "study_time_entries_activityId_idx" ON "study_time_entries"("activityId");

-- AddForeignKey
ALTER TABLE "study_time_entries" ADD CONSTRAINT "study_time_entries_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "study_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
