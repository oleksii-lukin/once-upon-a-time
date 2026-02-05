-- Ensure all cards have a category (defaulting story cards to protagonist if missing)
UPDATE "public"."cards"
SET category = 'protagonist'
WHERE type = 'story' AND category IS NULL;

-- Ensure all ending cards have ending category
UPDATE "public"."cards"
SET category = 'ending'
WHERE type = 'ending' AND category IS NULL;

-- Make category column NOT NULL
ALTER TABLE "public"."cards" ALTER COLUMN "category" SET NOT NULL;
