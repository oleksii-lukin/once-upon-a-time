-- Enable pg_jsonschema extension
create extension if not exists "pg_jsonschema" with schema "extensions";

-- Add JSON schema validation for card_layout column
alter table "public"."decks" 
    add constraint "decks_card_layout_check" 
    check (
        card_layout is null or 
        extensions.jsonb_matches_schema(
            '{
                "type": "object",
                "properties": {
                    "name": {
                        "type": "object",
                        "properties": {
                            "top": { "type": "number", "minimum": 0, "maximum": 100 },
                            "left": { "type": "number", "minimum": 0, "maximum": 100 },
                            "width": { "type": "number", "minimum": 0, "maximum": 100 },
                            "height": { "type": "number", "minimum": 0, "maximum": 100 },
                            "preserveRatio": { "type": "boolean" }
                        },
                        "required": ["top", "left", "width", "height"]
                    },
                    "image": {
                        "type": "object",
                        "properties": {
                            "top": { "type": "number", "minimum": 0, "maximum": 100 },
                            "left": { "type": "number", "minimum": 0, "maximum": 100 },
                            "width": { "type": "number", "minimum": 0, "maximum": 100 },
                            "height": { "type": "number", "minimum": 0, "maximum": 100 },
                            "preserveRatio": { "type": "boolean" }
                        },
                        "required": ["top", "left", "width", "height"]
                    },
                    "icon": {
                        "type": "object",
                        "properties": {
                            "top": { "type": "number", "minimum": 0, "maximum": 100 },
                            "left": { "type": "number", "minimum": 0, "maximum": 100 },
                            "width": { "type": "number", "minimum": 0, "maximum": 100 },
                            "height": { "type": "number", "minimum": 0, "maximum": 100 },
                            "preserveRatio": { "type": "boolean" }
                        },
                        "required": ["top", "left", "width", "height"]
                    }
                },
                "required": ["name", "image", "icon"]
            }'::json,
            card_layout
        )
    );
