-- Add new AI settings for Groq and Together AI
INSERT INTO "public"."app_settings" ("key", "value", "category") VALUES
('groq_api_key', 'null', 'ai'),
('groq_model', '"llama-3.3-70b-versatile"', 'ai'),
('together_api_key', 'null', 'ai'),
('together_model', '"meta-llama/Llama-3.3-70B-Instruct-Turbo"', 'ai')
ON CONFLICT ("key") DO NOTHING;
