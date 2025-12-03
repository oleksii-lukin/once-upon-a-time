-- Update policies to allow editing system decks (created_by = 'system')

-- Decks UPDATE
DROP POLICY IF EXISTS "Creators can update their decks" ON "public"."decks";
CREATE POLICY "Creators and System can update decks" ON "public"."decks" FOR UPDATE USING (
  ("auth"."jwt"() ->> 'sub'::"text") = "created_by"
  OR "created_by" = 'system'
);

-- Cards INSERT
DROP POLICY IF EXISTS "Deck creators can create cards" ON "public"."cards";
CREATE POLICY "Deck creators and System can create cards" ON "public"."cards" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."decks"
    WHERE "decks"."id" = "cards"."deck_id"
    AND (
      "decks"."created_by" = ("auth"."jwt"() ->> 'sub'::"text")
      OR "decks"."created_by" = 'system'
    )
  )
);

-- Cards UPDATE
DROP POLICY IF EXISTS "Creators can update cards" ON "public"."cards";
CREATE POLICY "Creators and System can update cards" ON "public"."cards" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "public"."decks"
    WHERE "decks"."id" = "cards"."deck_id"
    AND (
      "decks"."created_by" = ("auth"."jwt"() ->> 'sub'::"text")
      OR "decks"."created_by" = 'system'
    )
  )
);

-- Cards DELETE
DROP POLICY IF EXISTS "Deck creators can delete cards" ON "public"."cards";
CREATE POLICY "Deck creators and System can delete cards" ON "public"."cards" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "public"."decks"
    WHERE "decks"."id" = "cards"."deck_id"
    AND (
      "decks"."created_by" = ("auth"."jwt"() ->> 'sub'::"text")
      OR "decks"."created_by" = 'system'
    )
  )
);
