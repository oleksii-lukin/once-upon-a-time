-- Add JSON schema validation for decks.category_images column
-- It is a map of category_name -> image_url (string)
alter table "public"."decks" 
    add constraint "decks_category_images_check" 
    check (
        category_images is null or 
        extensions.jsonb_matches_schema(
            '{
                "type": "object",
                "patternProperties": {
                    "^.*$": { "type": "string" }
                }
            }'::json,
            category_images
        )
    );

-- Add JSON schema validation for cards.translations column
-- It is a map of lang_code -> { name, description, usage_examples }
alter table "public"."cards" 
    add constraint "cards_translations_check" 
    check (
        translations is null or 
        extensions.jsonb_matches_schema(
            '{
                "type": "object",
                "patternProperties": {
                    "^[a-z]{2}$": { 
                        "type": "object",
                        "properties": {
                            "name": { "type": "string" },
                            "description": { "type": "string" },
                            "usage_examples": { "type": "string" }
                        },
                        "required": ["name"]
                    }
                }
            }'::json,
            translations
        )
    );
