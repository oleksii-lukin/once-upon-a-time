# Default Deck Migration - Summary

## Files Created

### 1. Migration: Add Card Type and Category
**Location:** `/supabase/migrations/20251202000001_add_card_type_category.sql`

This migration adds two new columns to the `cards` table:
- `type`: Distinguishes between 'story' cards and 'ending' cards
- `category`: For story cards, specifies the archetype (protagonist, antagonist, setting, object, catalyst, trait)

**Constraints:**
- Type must be either 'story' or 'ending'
- Ending cards have NULL category
- Story cards must have a category from the allowed list

### 2. Seed File: Default Deck Data
**Location:** `/supabase/seed.sql`

This is the main seed file that Supabase will use to populate the database with initial data. It includes:

#### Default Deck
- **ID:** `00000000-0000-0000-0000-000000000001` (fixed UUID for consistency)
- **Name:** "Once Upon a Time - Default Deck"
- **Created by:** "system"
- **Active:** true

#### Card Breakdown (210 total cards)

| Category | Count | Type | Description |
|----------|-------|------|-------------|
| Protagonists & Allies | 30 | story | Heroes, mentors, companions |
| Antagonists & Threats | 30 | story | Villains, monsters, dark forces |
| Settings & Worlds | 30 | story | Locations and environments |
| Objects of Power | 30 | story | Magical items and artifacts |
| Plot Catalysts | 40 | story | Events and turning points |
| Traits & Themes | 30 | story | Emotional and thematic elements |
| Endings | 20 | ending | Story conclusions |

### 3. Documentation Copy
**Location:** `/specs/decks/default-deck-seed.sql`

An identical copy of the seed file placed in the specs folder for easy reference and documentation.

## Card Structure

Each card includes:
- **name**: The card title (e.g., "The Reluctant Hero")
- **description**: A rich, evocative description of what the card represents
- **type**: Either 'story' or 'ending'
- **category**: For story cards, one of: protagonist, antagonist, setting, object, catalyst, trait
- **usage_examples**: Guidance on when and how to play the card in storytelling
- **deck_id**: References the default deck
- **image_url**: Left NULL (to be filled later with actual images)
- **translations**: Will use the existing JSONB column for i18n support

## How to Use

### Running the Migration
```bash
# Apply the migration to add type and category columns
supabase db reset  # This will run all migrations including the new one
```

### Seeding the Database
In Supabase, the `seed.sql` file is automatically run after migrations when you:
```bash
supabase db reset
```

Or you can run it manually:
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql
```

## Design Principles

The cards follow storytelling archetypes from:
1. **The 7 Basic Plots** (Christopher Booker)
2. **The Hero's Journey** (Joseph Campbell)
3. **Character Archetypes** (Jung/Campbell)

This ensures:
- **Narrative cohesion**: Cards naturally support classic story arcs
- **Player creativity**: Rich prompts inspire diverse storytelling
- **Interrupt mechanics**: Keywords are intuitive triggers for gameplay
- **Replayability**: Archetypal cards allow infinite combinations

## Next Steps

1. **Generate card images**: Use AI image generation for each card
2. **Add translations**: Populate the `translations` JSONB field for EN, RU, UA
3. **Test gameplay**: Ensure card combinations create compelling stories
4. **Create additional decks**: Sci-fi, noir, mythic, etc.
