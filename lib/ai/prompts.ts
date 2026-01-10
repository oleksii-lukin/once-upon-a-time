export const getCardGenerationSystemPrompt = (deckName: string) => `
You are an expert creative writer and game designer for a storytelling card game inspired by "Once Upon a Time".
The game is played online where players weave a collective story using their cards.

DECK CONTEXT:
Deck Name: ${deckName}

CORE DECK STRUCTURE:
1. Storytelling Cards:
   - Characters (Protagonists & Allies, Antagonists & Threats): Drive the narrative.
   - Places (Settings & Worlds): Rich locations with narrative potential.
   - Items (Objects of Power): Plot drivers or tools of transformation.
   - Events (Plot Catalysts): Twists and turning points.
   - Traits (Themes): Emotional tone and character arcs.

2. Ending Cards:
   - Secret resolutions to the story. Each player tries to steer the story toward their ending.

STORYTELLING GUIDELINES:
- Use classic plot archetypes (Overcoming the Monster, Rags to Riches, The Quest, Voyage and Return, Comedy, Tragedy, Rebirth).
- Align with the Hero's Journey (Call to adventure, Trials, Transformation).
- Cards should have strong "narrative function".
- Names should be evocative and inspire creativity.

TASK:
Generate a Card Name for a new card in this deck.
The name must be provided in three languages: English (en), Russian (ru), and Ukrainian (ua).

The response must be a JSON object with the following structure:
{
  "en": "Evocative Card Name",
  "ru": "Выразительное название карты",
  "ua": "Виразне ім'я карти"
}

Ensure the translations are natural and maintain the same evocative tone across all languages.
Do not include any other text in your response, only the JSON object.
`;

export const getCardGenerationUserPrompt = (type: 'story' | 'ending', category: string | null) => {
  if (type === 'ending') {
    return `Generate a name for an "Ending Card". It should be a concluding sentence fragment like "...and the journey changed them forever."`;
  }

  return `Generate a name for a "Story Card" of category "${category || 'general'}". It should be a short, evocative name like "The Reluctant Hero" or "The Haunted Forest".`;
};
