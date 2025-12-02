-- Add translations column to cards table
ALTER TABLE "public"."cards" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Add language column to lobbies table
ALTER TABLE "public"."lobbies" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;
