-- Create app_settings table for persisting application configuration
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "category" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add unique constraint on key to prevent duplicate settings
ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_unique" UNIQUE ("key");

-- Add primary key
ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");

-- Insert default general settings
INSERT INTO "public"."app_settings" ("key", "value", "category") VALUES
('app_name', '"Once Upon a Time"', 'general'),
('maintenance_mode', 'false', 'general'),
('allow_interrupts', 'true', 'gameplay'),
('timer_per_turn', '60', 'gameplay')
ON CONFLICT ("key") DO NOTHING;

-- Insert default AI settings
INSERT INTO "public"."app_settings" ("key", "value", "category") VALUES
('ai_enabled', 'true', 'ai'),
('ai_default_provider', '"lm-studio"', 'ai'),
('ai_stream_responses', 'true', 'ai'),
('ai_max_tokens', '1000', 'ai'),
('ai_temperature', '0.7', 'ai'),
('lm_studio_url', '"http://localhost:1234/v1"', 'ai'),
('lm_studio_model', '"auto"', 'ai'),
('lm_studio_api_key', 'null', 'ai'),
('openai_api_key', 'null', 'ai'),
('openai_model', '"gpt-4o-mini"', 'ai'),
('openai_base_url', '"https://api.openai.com/v1"', 'ai'),
('gemini_api_key', 'null', 'ai'),
('gemini_model', '"gemini-1.5-flash"', 'ai'),
('anthropic_api_key', 'null', 'ai'),
('anthropic_model', '"claude-3-5-haiku-20241022"', 'ai')
ON CONFLICT ("key") DO NOTHING;

-- Enable RLS
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all settings" ON "public"."app_settings" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "public"."user_profiles"
        WHERE "user_profiles"."user_id" = ("auth"."jwt"() ->> 'sub'::"text")
        AND "user_profiles"."is_admin" = true
    )
);

CREATE POLICY "Admins can update all settings" ON "public"."app_settings" FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "public"."user_profiles"
        WHERE "user_profiles"."user_id" = ("auth"."jwt"() ->> 'sub'::"text")
        AND "user_profiles"."is_admin" = true
    )
);

CREATE POLICY "Admins can insert settings" ON "public"."app_settings" FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."user_profiles"
        WHERE "user_profiles"."user_id" = ("auth"."jwt"() ->> 'sub'::"text")
        AND "user_profiles"."is_admin" = true
    )
);

-- Grant permissions
GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";
