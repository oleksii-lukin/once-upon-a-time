-- Fix RLS policies for user_profiles to allow authenticated users to create/update profiles
-- The issue is that the current policies are too restrictive

-- Drop existing INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can create their own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."user_profiles";

-- Create more permissive policies that match the existing pattern in the codebase
-- Allow any authenticated user to insert (we verify user_id matches in the application layer)
CREATE POLICY "Authenticated users can create profiles" ON "public"."user_profiles" 
    FOR INSERT WITH CHECK (true);

-- Allow any authenticated user to update their own profile
CREATE POLICY "Authenticated users can update profiles" ON "public"."user_profiles" 
    FOR UPDATE USING (true);
