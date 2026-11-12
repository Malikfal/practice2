-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_name" VARCHAR(255);

-- AlterTable
ALTER TABLE "work_segments" ALTER COLUMN "ended_at" DROP NOT NULL;
