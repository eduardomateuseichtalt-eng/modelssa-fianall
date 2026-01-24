-- CreateEnum
CREATE TYPE "ShotType" AS ENUM ('VIDEO', 'IMAGE');

-- DropIndex
DROP INDEX "Shot_modelId_videoUrl_key";

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "type" "ShotType" NOT NULL DEFAULT 'VIDEO',
ALTER COLUMN "videoUrl" DROP NOT NULL;
