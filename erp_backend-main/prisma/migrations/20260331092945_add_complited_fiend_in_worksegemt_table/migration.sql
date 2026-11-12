/*
  Warnings:

  - You are about to drop the column `intermediate_ended_at` on the `work_segments` table. All the data in the column will be lost.
  - Made the column `ended_at` on table `work_segments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "work_segments" DROP COLUMN "intermediate_ended_at",
ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "ended_at" SET NOT NULL;
