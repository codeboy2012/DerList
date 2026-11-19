-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "wishlist_items_wishlistId_archived_idx" ON "wishlist_items"("wishlistId", "archived");
