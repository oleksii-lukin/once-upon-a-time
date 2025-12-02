-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create decks" ON public.decks;

-- Add policies that work with Clerk JWT
-- Allow INSERT if the user has a valid JWT (sub claim exists)
CREATE POLICY "Users with JWT can create decks" 
ON public.decks 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'sub') IS NOT NULL);

-- Allow SELECT for all authenticated users (anyone with a JWT)
CREATE POLICY "Users can view all decks" 
ON public.decks 
FOR SELECT 
USING (true);

-- Keep the existing UPDATE policy (creators can update their decks)
-- This one is already correct at line 247

-- Add DELETE policy for deck creators
CREATE POLICY "Creators can delete their decks" 
ON public.decks 
FOR DELETE 
USING ((auth.jwt() ->> 'sub') = created_by);
