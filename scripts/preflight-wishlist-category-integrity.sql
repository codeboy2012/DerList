-- ============================================================================
-- DerList — read-only preflight for migration
--   20261119120000_enforce_wishlist_category_integrity
--
-- Run this against the production database BEFORE `prisma migrate deploy`.
-- Every statement is read-only and the transaction is declared READ ONLY and
-- rolled back, so the script cannot change rows, schema or sequences.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/preflight-wishlist-category-integrity.sql
--
-- Expected clean result on a database that has NOT yet applied the migration:
--
--   wishlist_items_total ................ informational
--   wishlist_categories_total ........... informational
--   items_with_category ................. informational
--   invalid_cross_collection_category ... 0
--   orphaned_category_reference ......... 0
--   duplicate_category_composite_key .... 0
--   categories_with_null_collection ..... 0
--   categories_with_missing_collection .. 0
--   migration_index_already_present ..... 0
--   composite_fk_already_present ........ 0
--   legacy_fk_present ................... 1
--   blocking_violations_total ........... 0   <-- the number that matters
--
-- A nonzero `blocking_violations_total` means the migration would raise an
-- exception and leave all data unchanged. Resolve or report the listed rows;
-- never edit the migration or this script to force it through.
--
-- `migration_index_already_present` / `composite_fk_already_present` being 1
-- means the migration is already applied. `legacy_fk_present` being 0 before
-- the first run means the expected single-column foreign key is missing and
-- the migration's DROP CONSTRAINT step would fail.
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

SELECT check_name, observed, expected, blocking, meaning
FROM (
  SELECT
    1 AS ord,
    'wishlist_items_total' AS check_name,
    count(*)::text AS observed,
    'informational' AS expected,
    false AS blocking,
    'Rows in wishlist_items' AS meaning
  FROM "wishlist_items"

  UNION ALL

  SELECT
    2,
    'wishlist_categories_total',
    count(*)::text,
    'informational',
    false,
    'Rows in wishlist_categories'
  FROM "wishlist_categories"

  UNION ALL

  SELECT
    3,
    'items_with_category',
    count(*)::text,
    'informational',
    false,
    'Products with wishlistCategoryId set'
  FROM "wishlist_items"
  WHERE "wishlistCategoryId" IS NOT NULL

  UNION ALL

  -- Exactly the predicate used by the migration's guard.
  SELECT
    4,
    'invalid_cross_collection_category',
    count(*)::text,
    '0 (blocking)',
    true,
    'Products whose category record belongs to a different collection'
  FROM "wishlist_items" AS i
  JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
  WHERE c."wishlistId" <> i."wishlistId"

  UNION ALL

  SELECT
    5,
    'orphaned_category_reference',
    count(*)::text,
    '0 (blocking)',
    true,
    'Products pointing at a category id that does not exist'
  FROM "wishlist_items" AS i
  LEFT JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
  WHERE i."wishlistCategoryId" IS NOT NULL AND c."id" IS NULL

  UNION ALL

  SELECT
    6,
    'duplicate_category_composite_key',
    count(*)::text,
    '0 (blocking)',
    true,
    'Duplicate (id, wishlistId) pairs that would break the new unique index'
  FROM (
    SELECT "id", "wishlistId"
    FROM "wishlist_categories"
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) AS duplicates

  UNION ALL

  SELECT
    7,
    'categories_with_null_collection',
    count(*)::text,
    '0 (blocking)',
    true,
    'Category rows without a collection (wishlistId is NOT NULL in the schema)'
  FROM "wishlist_categories"
  WHERE "wishlistId" IS NULL

  UNION ALL

  SELECT
    8,
    'categories_with_missing_collection',
    count(*)::text,
    '0 (blocking)',
    true,
    'Category rows whose collection no longer exists'
  FROM "wishlist_categories" AS c
  LEFT JOIN "wishlists" AS w ON w."id" = c."wishlistId"
  WHERE w."id" IS NULL

  UNION ALL

  SELECT
    9,
    'migration_index_already_present',
    count(*)::text,
    '0 before the first run',
    false,
    'Whether wishlist_categories_id_wishlistId_key already exists'
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND indexname = 'wishlist_categories_id_wishlistId_key'

  UNION ALL

  SELECT
    10,
    'composite_fk_already_present',
    count(*)::text,
    '0 before the first run',
    false,
    'Whether the composite category foreign key is already installed'
  FROM pg_constraint
  WHERE conname = 'wishlist_items_wishlistCategoryId_wishlistId_fkey'

  UNION ALL

  SELECT
    11,
    'legacy_fk_present',
    count(*)::text,
    '1 before the first run',
    false,
    'Whether the single-column category foreign key still exists'
  FROM pg_constraint
  WHERE conname = 'wishlist_items_wishlistCategoryId_fkey'

  UNION ALL

  SELECT
    12,
    'blocking_violations_total',
    (
      SELECT count(*)::text
      FROM (
        SELECT 1
        FROM "wishlist_items" AS i
        JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
        WHERE c."wishlistId" <> i."wishlistId"
        UNION ALL
        SELECT 1
        FROM "wishlist_items" AS i
        LEFT JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
        WHERE i."wishlistCategoryId" IS NOT NULL AND c."id" IS NULL
        UNION ALL
        SELECT 1
        FROM (
          SELECT "id", "wishlistId"
          FROM "wishlist_categories"
          GROUP BY 1, 2
          HAVING count(*) > 1
        ) AS duplicates
        UNION ALL
        SELECT 1
        FROM "wishlist_categories"
        WHERE "wishlistId" IS NULL
        UNION ALL
        SELECT 1
        FROM "wishlist_categories" AS c
        LEFT JOIN "wishlists" AS w ON w."id" = c."wishlistId"
        WHERE w."id" IS NULL
      ) AS violations
    ),
    '0 (blocking)',
    true,
    'Sum of every blocking check; nonzero means stop before deploying'
) AS checks
ORDER BY ord;

-- Optional detail for a nonzero invalid_cross_collection_category count.
-- Only identifiers are shown, never product titles or notes.
SELECT
  i."id" AS item_id,
  i."wishlistId" AS item_wishlist_id,
  i."wishlistCategoryId" AS category_id,
  c."wishlistId" AS category_wishlist_id
FROM "wishlist_items" AS i
JOIN "wishlist_categories" AS c ON c."id" = i."wishlistCategoryId"
WHERE c."wishlistId" <> i."wishlistId"
ORDER BY i."wishlistId", i."id"
LIMIT 50;

ROLLBACK;
