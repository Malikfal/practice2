-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_fkey";

-- DropIndex
DROP INDEX "tasks_user_id_idx";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" VARCHAR(255) NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "work_segments" ADD COLUMN     "user_id" UUID;

-- CreateTable
CREATE TABLE "migrations" (
    "id" SERIAL NOT NULL,
    "migration" VARCHAR(255) NOT NULL,
    "batch" INTEGER NOT NULL,

    CONSTRAINT "migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_users" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "task_users_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateIndex
CREATE INDEX "task_users_user_id_index" ON "task_users"("user_id");

-- CreateIndex
CREATE INDEX "work_segments_user_id_index" ON "work_segments"("user_id");

