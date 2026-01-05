-- Add image columns to decks table
ALTER TABLE decks 
ADD COLUMN IF NOT EXISTS bg_image_url TEXT,
ADD COLUMN IF NOT EXISTS card_back_image_url TEXT,
ADD COLUMN IF NOT EXISTS category_images JSONB;
