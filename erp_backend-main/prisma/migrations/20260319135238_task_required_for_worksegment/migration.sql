/*
  Warnings:

  - Made the column `task_id` on table `work_segments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "work_segments" DROP CONSTRAINT "work_segments_task_id_fkey";

-- AlterTable
ALTER TABLE "work_segments" ALTER COLUMN "task_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
