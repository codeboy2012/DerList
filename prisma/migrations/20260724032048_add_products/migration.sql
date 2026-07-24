-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('IMPORTED', 'MANUAL');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canonicalUrl" TEXT,
    "normalizedUrl" TEXT,
    "domain" TEXT,
    "retailer" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "sku" TEXT,
    "mpn" TEXT,
    "gtin" TEXT,
    "image" TEXT,
    "gallery" TEXT,
    "currentPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "inStock" BOOLEAN,
    "availability" TEXT,
    "specifications" TEXT,
    "attributes" TEXT,
    "source" "ProductSource" NOT NULL DEFAULT 'IMPORTED',
    "lastFetchedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_canonicalUrl_key" ON "products"("canonicalUrl");

-- CreateIndex
CREATE INDEX "products_domain_idx" ON "products"("domain");

-- CreateIndex
CREATE INDEX "products_canonicalUrl_idx" ON "products"("canonicalUrl");

-- CreateIndex
CREATE INDEX "products_normalizedUrl_idx" ON "products"("normalizedUrl");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "wishlist_items_productId_idx" ON "wishlist_items"("productId");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
