'use server'

import { generateAIResponse } from '@/lib/ai/utils'
import { getCardGenerationSystemPrompt, getCardGenerationUserPrompt, type CardFieldType } from '@/lib/ai/prompts'

export async function generateCardFieldAction(
  deckName: string,
  fieldType: CardFieldType,
  type: 'story' | 'ending',
  category: string | null,
  cardName?: string
) {
  try {
    const systemPrompt = getCardGenerationSystemPrompt(deckName, fieldType)
    const userPrompt = getCardGenerationUserPrompt(type, category, fieldType, cardName)

    const prompt = `${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`

    const response = await generateAIResponse(prompt)

    // Clean potential markdown formatting
    let content = response.text.trim()
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }

    // Defensive repair for Python-style triple quotes (common hallucination)
    // We replace triple-quoted content with properly escaped JSON strings
    if (content.includes('"""')) {
      content = content.replace(/"""([\s\S]*?)"""/g, (_, p1) => {
        return JSON.stringify(p1)
      })
    }

    // Defensive repair for missing commas between properties
    content = content.replace(/"\s*\n+\s*"(en|ru|ua)":/g, '",\n  "$1":')

    let data
    try {
      data = JSON.parse(content)
    } catch (parseError) {
      // If parsing fails, try one more aggressive cleanup: remove unescaped newlines in values
      try {
        const cleanedContent = content.replace(/":\s*"([\s\S]*?)"(?=\s*[,}])/, (match, p1) => {
          return `": ${JSON.stringify(p1.replace(/\\n/g, '\n'))}`
        })
        data = JSON.parse(cleanedContent)
      } catch (secondError) {
        console.error('AI JSON Parse Error:', parseError)
        console.error('Attempted to parse:', content)
        throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`)
      }
    }

    // Handle nested object hallucinations (e.g., {"en": {"usage_examples": [...]}})
    const processField = (val: any): string => {
      if (typeof val === 'string') {
        // Check if the string itself is a JSON object
        if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
          try {
            const nested = JSON.parse(val)
            return processField(nested)
          } catch {
            return val
          }
        }
        return val
      }
      if (Array.isArray(val)) {
        return val.join('\n')
      }
      if (typeof val === 'object' && val !== null) {
        // Try to find a logical text value in the object
        const values = Object.values(val)
        if (values.length > 0) return processField(values[0])
      }
      return String(val)
    }

    if (fieldType === 'all') {
      if (!data.en || !data.ru || !data.ua) {
        throw new Error('Invalid translation data in AI response')
      }

      return {
        success: true,
        data: {
          en: {
            name: processField(data.en.name),
            description: processField(data.en.description),
            usage_examples: processField(data.en.usage_examples),
          },
          ru: {
            name: processField(data.ru.name),
            description: processField(data.ru.description),
            usage_examples: processField(data.ru.usage_examples),
          },
          ua: {
            name: processField(data.ua.name),
            description: processField(data.ua.description),
            usage_examples: processField(data.ua.usage_examples),
          }
        }
      }
    }

    if (!data.en || !data.ru || !data.ua) {
      throw new Error('Invalid translation data in AI response')
    }

    return {
      success: true,
      data: {
        en: processField(data.en),
        ru: processField(data.ru),
        ua: processField(data.ua)
      }
    }
  } catch (error) {
    console.error(`Error generating card ${fieldType}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to generate ${fieldType}`
    }
  }
}

// Backward compatibility or legacy wrapper
export async function generateCardNameAction(
  deckName: string,
  type: 'story' | 'ending',
  category: string | null
) {
  return generateCardFieldAction(deckName, 'name', type, category)
}
