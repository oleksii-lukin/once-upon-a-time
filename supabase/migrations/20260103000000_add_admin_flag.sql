-- Add is_admin column to user_profiles
ALTER TABLE "public"."user_profiles" ADD COLUMN "is_admin" BOOLEAN DEFAULT FALSE NOT NULL;

-- Update RLS policies to allow admins to see all profiles (already select: true)
-- For now, we trust the Clerk JWT for admin actions, but having the flag in DB is good for internal queries.
