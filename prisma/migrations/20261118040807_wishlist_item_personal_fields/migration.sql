-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN     "availability" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "targetPrice" DECIMAL(10,2);
