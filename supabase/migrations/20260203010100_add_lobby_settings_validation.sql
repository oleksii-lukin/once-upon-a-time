-- Ensure all existing lobbies have valid settings structure before adding constraint
update "public"."lobbies"
set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{gameMode}',
    '"main"'
)
where settings->>'gameMode' is null;

-- Clamp numeric values to valid ranges
update "public"."lobbies"
set settings = jsonb_set(
    settings,
    '{timerPerTurnDuration}',
    (least(greatest((settings->>'timerPerTurnDuration')::numeric, 10), 120))::text::jsonb
)
where settings->'timerPerTurnDuration' is not null;

update "public"."lobbies"
set settings = jsonb_set(
    settings,
    '{pacingDelayDuration}',
    (least(greatest((settings->>'pacingDelayDuration')::numeric, 3), 30))::text::jsonb
)
where settings->'pacingDelayDuration' is not null;

-- Add JSON schema validation for lobbies.settings
alter table "public"."lobbies" 
    add constraint "lobbies_settings_check" 
    check (
        settings is null or 
        extensions.jsonb_matches_schema(
            '{
                "type": "object",
                "properties": {
                    "allowHotJoin": { "type": "boolean" },
                    "publicGame": { "type": "boolean" },
                    "allowSpectators": { "type": "boolean" },
                    "allowInterrupts": { "type": "boolean" },
                    "timerPerTurn": { "type": "boolean" },
                    "timerPerTurnDuration": { "type": "number", "minimum": 10, "maximum": 120 },
                    "happyEnding": { "type": "boolean" },
                    "enableVideoChat": { "type": "boolean" },
                    "enablePacingDelay": { "type": "boolean" },
                    "pacingDelayDuration": { "type": "number", "minimum": 3, "maximum": 30 },
                    "gameMode": { "type": "string", "enum": ["main", "fast", "tutorial", "solo", "simple", "full"] },
                    "selectedDecks": { "type": "array", "items": { "type": "string" } }
                }
            }'::json,
            settings
        )
    );
