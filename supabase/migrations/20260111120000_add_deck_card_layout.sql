-- Add card_layout column to decks table
ALTER TABLE decks 
ADD COLUMN IF NOT EXISTS card_layout JSONB DEFAULT '{
  "name": { "top": 7, "left": 12, "width": 76, "height": 12 },
  "image": { "top": 30, "left": 14, "width": 72, "height": 55 },
  "icon": { "top": 3.5, "left": 3.5, "width": 12, "height": 12 }
}'::jsonb;
