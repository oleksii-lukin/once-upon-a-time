export type CardFieldType = 'name' | 'description' | 'usage_examples' | 'all'

export const getCardGenerationSystemPrompt = (deckName: string, fieldType: CardFieldType) => {
  const fieldDescriptions = {
    name: 'a short, evocative name for the card.',
    description: 'a rich, narrative description of the card\'s role or essence in the story. It should be 1-2 sentences long.',
    usage_examples: 'exactly three short, distinct story fragments or plot points where this card could be used. Each example should be a single sentence.',
    all: 'all fields (name, description, and usage_examples) for the card.',
  }

  const jsonStructure = fieldType === 'all'
    ? `{
  "en": { "name": "...", "description": "...", "usage_examples": "..." },
  "ru": { "name": "...", "description": "...", "usage_examples": "..." },
  "ua": { "name": "...", "description": "...", "usage_examples": "..." }
}`
    : `{
  "en": "Value in English",
  "ru": "Значение на русском",
  "ua": "Значення українською"
}`

  return `
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
- Language should be evocative and inspire creativity.

TASK:
Generate the **${fieldType}** field for a new card in this deck.
The ${fieldType} is defined as: ${fieldDescriptions[fieldType]}

The response must be a **strictly valid JSON object** with the following structure:
${jsonStructure}

IMPORTANT RULES:
1. **Plain Text Only**: The values for "name", "description", and "usage_examples" MUST BE PLAIN STRING TEXT.
   - DO NOT nest JSON objects or arrays inside these strings.
   - DO NOT use Python-style triple quotes (\"\"\"). Use standard double quotes for JSON strings.
   - For "usage_examples", provide the three examples as a single string, separated by newlines or bullet points.
2. **Valid JSON**: ALWAYS include commas between properties. Ensure all internal double quotes are escaped (\\\").
3. **No Preamble**: Do not include any other text, explanations, or code block markers other than the JSON itself.
4. **Natural Flow**: Ensure the translations are natural and maintain the evocative tone.
`
}

export const getCardGenerationUserPrompt = (
  type: 'story' | 'ending',
  category: string | null,
  fieldType: CardFieldType,
  cardName?: string,
  excludedNames?: string[],
) => {
  const context = cardName ? ` for a card named "${cardName}"` : ''
  const cardType = type === 'ending' ? 'Ending Card' : `Story Card (Category: ${category || 'general'})`

  let prompt = ''

  if (fieldType === 'all') {
    prompt = `Generate all fields for a new "${cardType}". Ensure the name, description, and usage examples form a cohesive narrative whole.`
  }
  else if (fieldType === 'name') {
    if (type === 'ending') {
      prompt = `Generate a name for an "${cardType}". It should be a concluding sentence fragment like "...and the journey changed them forever."`
    }
    else {
      prompt = `Generate a name for a "${cardType}". It should be a short, evocative name like "The Reluctant Hero" or "The Haunted Forest".`
    }
  }
  else if (fieldType === 'description') {
    prompt = `Generate a description for the "${cardType}"${context}. Focus on its narrative role and atmospheric feel.`
  }
  else if (fieldType === 'usage_examples') {
    prompt = `Generate usage examples for the "${cardType}"${context}. Provide three distinct ways this card could advance or twist a story.`
  }

  if (excludedNames && excludedNames.length > 0) {
    prompt += `\n\nDo not use these values: ${JSON.stringify(excludedNames)}`
  }

  return prompt
}
