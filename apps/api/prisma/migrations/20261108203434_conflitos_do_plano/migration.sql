-- AlterTable
ALTER TABLE "study_plans" ADD COLUMN     "conflicts" JSONB NOT NULL DEFAULT '[]';
