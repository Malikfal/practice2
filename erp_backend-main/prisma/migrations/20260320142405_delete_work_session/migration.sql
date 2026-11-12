/*
  Warnings:

  - You are about to drop the column `work_session_id` on the `work_segments` table. All the data in the column will be lost.
  - You are about to drop the `work_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "work_segments" DROP CONSTRAINT "work_segments_work_session_id_fkey";

-- DropForeignKey
ALTER TABLE "work_sessions" DROP CONSTRAINT "work_sessions_user_id_fkey";

-- DropIndex
DROP INDEX "work_segments_work_session_id_started_at_idx";

-- AlterTable
ALTER TABLE "work_segments" DROP COLUMN "work_session_id";

-- DropTable
DROP TABLE "work_sessions";
