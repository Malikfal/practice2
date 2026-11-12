/*
  Warnings:

  - You are about to drop the column `duration_seconds` on the `work_segments` table. All the data in the column will be lost.
  - Added the required column `intermediate_ended_at` to the `work_segments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "work_segments" DROP COLUMN "duration_seconds",
ADD COLUMN     "intermediate_ended_at" TIMESTAMPTZ(3) NOT NULL;
