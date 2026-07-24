-- AlterTable
ALTER TABLE "products" ADD COLUMN     "avgConfidence" INTEGER,
ADD COLUMN     "lastExtractionMethod" TEXT,
ADD COLUMN     "refreshCount" INTEGER NOT NULL DEFAULT 0;
