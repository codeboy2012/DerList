-- Enforce that a product's category record belongs to the product's own
-- collection at the database level.
--
-- This migration is additive: it adds a unique key and replaces the existing
-- single-column foreign key with a composite one. It deliberately aborts
-- without changing anything if existing rows already violate the invariant, so
-- no user data is rewritten or deleted. Resolve the reported rows (or leave
-- this migration unapplied) before retrying.

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*)
  INTO invalid_count
  FROM "wishlist_items" AS i
  JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
  WHERE c."wishlistId" <> i."wishlistId";

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce wishlist category integrity: % product(s) reference a category from another collection. No data was changed.',
      invalid_count;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_wishlistCategoryId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_categories_id_wishlistId_key" ON "wishlist_categories"("id", "wishlistId");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistCategoryId_wishlistId_fkey" FOREIGN KEY ("wishlistCategoryId", "wishlistId") REFERENCES "wishlist_categories"("id", "wishlistId") ON DELETE NO ACTION ON UPDATE NO ACTION;
