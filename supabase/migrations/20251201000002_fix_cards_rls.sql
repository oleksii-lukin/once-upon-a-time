-- Add missing RLS policies for cards table

-- Allow INSERT for deck creators
CREATE POLICY "Deck creators can create cards" 
ON public.cards 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.created_by = (auth.jwt() ->> 'sub')
  )
);

-- Allow SELECT for all users (cards are viewable by everyone)
CREATE POLICY "Anyone can view cards" 
ON public.cards 
FOR SELECT 
USING (true);

-- Allow DELETE for deck creators
CREATE POLICY "Deck creators can delete cards" 
ON public.cards 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.created_by = (auth.jwt() ->> 'sub')
  )
);
