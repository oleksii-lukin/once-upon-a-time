-- Update existing ending cards to have category='ending' instead of null
UPDATE "public"."cards"
SET category = 'ending'
WHERE type = 'ending' AND category IS NULL;
