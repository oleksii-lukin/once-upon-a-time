-- Update database constraint to allow 'ending' as category value
ALTER TABLE "public"."cards" DROP CONSTRAINT IF EXISTS "cards_category_check";

ALTER TABLE "public"."cards" ADD CONSTRAINT "cards_category_check"
  CHECK (
    category IN ('protagonist', 'antagonist', 'setting', 'object', 'catalyst', 'trait', 'ending')
  );
