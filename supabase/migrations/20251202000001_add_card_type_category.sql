-- Add type and category columns to cards table
ALTER TABLE "public"."cards" ADD COLUMN "type" text NOT NULL DEFAULT 'story';
ALTER TABLE "public"."cards" ADD COLUMN "category" text;

-- Add check constraint for card type
ALTER TABLE "public"."cards" ADD CONSTRAINT "cards_type_check" 
  CHECK (type IN ('story', 'ending'));

-- Add check constraint for card category (only for story cards)
ALTER TABLE "public"."cards" ADD CONSTRAINT "cards_category_check" 
  CHECK (
    (type = 'ending' AND category IS NULL) OR 
    (type = 'story' AND category IN ('protagonist', 'antagonist', 'setting', 'object', 'catalyst', 'trait'))
  );
