-- Convert topPicks from TEXT to JSONB for native JSON storage
ALTER TABLE "wishlists" ALTER COLUMN "topPicks" TYPE JSONB USING "topPicks"::jsonb;
