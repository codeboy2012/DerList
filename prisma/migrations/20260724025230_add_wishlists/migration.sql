-- CreateEnum
CREATE TYPE "WishlistVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "WishlistMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "WishlistVisibility" NOT NULL DEFAULT 'PRIVATE',
    "icon" TEXT,
    "color" TEXT,
    "slug" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WishlistMemberRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "wishlist_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "image" TEXT,
    "brand" TEXT,
    "retailer" TEXT,
    "currentPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priority" "ItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlists_ownerId_idx" ON "wishlists"("ownerId");

-- CreateIndex
CREATE INDEX "wishlists_visibility_idx" ON "wishlists"("visibility");

-- CreateIndex
CREATE INDEX "wishlists_ownerId_archived_idx" ON "wishlists"("ownerId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_ownerId_slug_key" ON "wishlists"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "wishlist_members_userId_idx" ON "wishlist_members"("userId");

-- CreateIndex
CREATE INDEX "wishlist_members_wishlistId_idx" ON "wishlist_members"("wishlistId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_members_wishlistId_userId_key" ON "wishlist_members"("wishlistId", "userId");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlistId_idx" ON "wishlist_items"("wishlistId");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlistId_position_idx" ON "wishlist_items"("wishlistId", "position");

-- CreateIndex
CREATE INDEX "wishlist_items_purchased_idx" ON "wishlist_items"("purchased");

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_members" ADD CONSTRAINT "wishlist_members_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_members" ADD CONSTRAINT "wishlist_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
