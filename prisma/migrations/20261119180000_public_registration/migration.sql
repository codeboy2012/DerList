-- DerList 0.14.0 — public registration
--
-- 1. Normalise email addresses and usernames to lowercase and add CHECK
--    constraints so every write stays normalised. Identity lookup is
--    case-insensitive; keeping the stored form normalised makes the existing
--    unique indexes enforce case-insensitive uniqueness.
-- 2. Add single-use email tokens for password recovery and email verification.
--
-- This migration fails closed: if two accounts already differ only by case it
-- raises an exception before changing any data, so an operator can resolve the
-- conflict deliberately.

CREATE TYPE "EmailTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

DO $$
DECLARE
  duplicate_emails integer;
  duplicate_usernames integer;
BEGIN
  SELECT count(*) INTO duplicate_emails
  FROM (
    SELECT lower("email")
    FROM "users"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_emails > 0 THEN
    RAISE EXCEPTION
      'Cannot normalise users.email: % account(s) share an email address case-insensitively. Resolve the duplicates and retry.',
      duplicate_emails;
  END IF;

  SELECT count(*) INTO duplicate_usernames
  FROM (
    SELECT lower("username")
    FROM "users"
    GROUP BY lower("username")
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_usernames > 0 THEN
    RAISE EXCEPTION
      'Cannot normalise users.username: % account(s) share a username case-insensitively. Resolve the duplicates and retry.',
      duplicate_usernames;
  END IF;
END
$$;

UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "users" SET "username" = lower("username") WHERE "username" <> lower("username");

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_lowercase_check" CHECK ("username" = lower("username"));

CREATE TABLE "email_tokens" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "type" "EmailTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),

  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_tokens_tokenHash_key" ON "email_tokens"("tokenHash");
CREATE INDEX "email_tokens_userId_type_idx" ON "email_tokens"("userId", "type");
CREATE INDEX "email_tokens_expiresAt_idx" ON "email_tokens"("expiresAt");

ALTER TABLE "email_tokens"
  ADD CONSTRAINT "email_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
