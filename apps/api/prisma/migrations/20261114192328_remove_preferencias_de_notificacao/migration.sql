/*
  Warnings:

  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fkey";

-- DropTable
DROP TABLE "notification_preferences";
