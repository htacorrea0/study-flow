-- CreateEnum
CREATE TYPE "StudyDepth" AS ENUM ('BASIC', 'INTERMEDIATE', 'INTENSE');

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "depth" "StudyDepth" NOT NULL DEFAULT 'INTERMEDIATE';
