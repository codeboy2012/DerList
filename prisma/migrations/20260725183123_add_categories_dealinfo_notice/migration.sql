-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN     "category" TEXT,
ADD COLUMN     "dealInfo" TEXT,
ADD COLUMN     "originalPrice" DECIMAL(10,2),
ADD COLUMN     "wishlistCategoryId" TEXT;

-- AlterTable
ALTER TABLE "wishlists" ADD COLUMN     "notice" TEXT;

-- CreateTable
CREATE TABLE "wishlist_categories" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "externalLink" TEXT,
    "externalLinkLabel" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,

    CONSTRAINT "wishlist_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlist_categories_wishlistId_idx" ON "wishlist_categories"("wishlistId");

-- CreateIndex
CREATE INDEX "wishlist_categories_wishlistId_sortOrder_idx" ON "wishlist_categories"("wishlistId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_categories_wishlistId_name_key" ON "wishlist_categories"("wishlistId", "name");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlistId_category_idx" ON "wishlist_items"("wishlistId", "category");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistCategoryId_fkey" FOREIGN KEY ("wishlistCategoryId") REFERENCES "wishlist_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_categories" ADD CONSTRAINT "wishlist_categories_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
