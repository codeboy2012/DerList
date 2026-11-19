-- ============================================================================
-- DerList — read-only preflight for migration
--   20261119180000_public_registration
--
-- Run this against the production database BEFORE `prisma migrate deploy`.
-- Every statement is read-only and the transaction is declared READ ONLY and
-- rolled back, so the script cannot change rows, schema or sequences.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/preflight-public-registration.sql
--
-- The migration:
--   1. lowercases every users.email and users.username,
--   2. adds CHECK constraints requiring both to stay lowercase, and
--   3. creates email_tokens for password recovery and email verification.
--
-- It fails closed and changes nothing if two accounts already differ only by
-- case. This preflight reports those conflicts first.
--
-- Expected clean result:
--
--   users_total ................................ informational
--   duplicate_emails_case_insensitive .......... 0
--   duplicate_usernames_case_insensitive ....... 0
--   emails_needing_normalisation ............... informational
--   usernames_needing_normalisation ............ informational
--   email_tokens_table_present ................. 0 before the migration
--   email_token_type_present ................... 0 before the migration
--   lowercase_email_constraint_present ......... 0 before the migration
--   lowercase_username_constraint_present ...... 0 before the migration
--   blocking_violations_total .................. 0   <-- the number that matters
--
-- A nonzero `blocking_violations_total` means the migration would raise an
-- exception and leave all data unchanged. Resolve the duplicate accounts
-- deliberately; never edit the migration or this script to force it through.
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

SELECT check_name, observed, expected, blocking, meaning
FROM (
  SELECT
    1 AS ord,
    'users_total' AS check_name,
    count(*)::text AS observed,
    'informational' AS expected,
    false AS blocking,
    'Rows in users' AS meaning
  FROM "users"

  UNION ALL

  SELECT
    2,
    'duplicate_emails_case_insensitive',
    count(*)::text,
    '0',
    true,
    'Email addresses shared by more than one account when compared case-insensitively'
  FROM (
    SELECT lower("email")
    FROM "users"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) AS duplicates

  UNION ALL

  SELECT
    3,
    'duplicate_usernames_case_insensitive',
    count(*)::text,
    '0',
    true,
    'Usernames shared by more than one account when compared case-insensitively'
  FROM (
    SELECT lower("username")
    FROM "users"
    GROUP BY lower("username")
    HAVING count(*) > 1
  ) AS duplicates

  UNION ALL

  SELECT
    4,
    'emails_needing_normalisation',
    count(*)::text,
    'informational',
    false,
    'Rows the migration lowercases in users.email'
  FROM "users"
  WHERE "email" <> lower("email")

  UNION ALL

  SELECT
    5,
    'usernames_needing_normalisation',
    count(*)::text,
    'informational',
    false,
    'Rows the migration lowercases in users.username'
  FROM "users"
  WHERE "username" <> lower("username")

  UNION ALL

  SELECT
    6,
    'email_tokens_table_present',
    (to_regclass('public.email_tokens') IS NOT NULL)::int::text,
    '0',
    false,
    '1 means the public-registration migration is already applied'
  FROM (SELECT 1) AS probe

  UNION ALL

  SELECT
    7,
    'email_token_type_present',
    (to_regtype('"EmailTokenType"') IS NOT NULL)::int::text,
    '0',
    false,
    '1 means the EmailTokenType enum is already applied'
  FROM (SELECT 1) AS probe

  UNION ALL

  SELECT
    8,
    'lowercase_email_constraint_present',
    count(*)::text,
    '0',
    false,
    '1 means users_email_lowercase_check is already applied'
  FROM pg_constraint
  WHERE conname = 'users_email_lowercase_check'

  UNION ALL

  SELECT
    9,
    'lowercase_username_constraint_present',
    count(*)::text,
    '0',
    false,
    '1 means users_username_lowercase_check is already applied'
  FROM pg_constraint
  WHERE conname = 'users_username_lowercase_check'
) AS checks
ORDER BY ord;

SELECT
  (SELECT count(*) FROM (
    SELECT lower("email")
    FROM "users"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) AS duplicate_emails)::int AS duplicate_email_groups,
  (SELECT count(*) FROM (
    SELECT lower("username")
    FROM "users"
    GROUP BY lower("username")
    HAVING count(*) > 1
  ) AS duplicate_usernames)::int AS duplicate_username_groups,
  (
    (SELECT count(*) FROM (
      SELECT lower("email")
      FROM "users"
      GROUP BY lower("email")
      HAVING count(*) > 1
    ) AS duplicate_emails)
    +
    (SELECT count(*) FROM (
      SELECT lower("username")
      FROM "users"
      GROUP BY lower("username")
      HAVING count(*) > 1
    ) AS duplicate_usernames)
  )::int AS blocking_violations_total;

ROLLBACK;
