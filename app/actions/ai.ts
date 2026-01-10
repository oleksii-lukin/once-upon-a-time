'use server'

import { generateAIResponse } from '@/lib/ai/utils'
import { getCardGenerationSystemPrompt, getCardGenerationUserPrompt, type CardFieldType } from '@/lib/ai/prompts'

export async function generateCardFieldAction(
  deckName: string,
  fieldType: CardFieldType,
  type: 'story' | 'ending',
  category: string | null,
  cardName?: string,
  excludedNames?: string[],
) {
  try {
    const systemPrompt = getCardGenerationSystemPrompt(deckName, fieldType)
    const userPrompt = getCardGenerationUserPrompt(type, category, fieldType, cardName, excludedNames)

    const prompt = `${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`

    console.log('Prompt:', prompt)

    const response = await generateAIResponse(prompt)

    // Clean potential markdown formatting and reasoning tokens
    let content = response.text.trim()

    // 1. If there's a markdown block, extract it first as it's the most likely intention
    // These blocks often follow or are mixed with reasoning tokens
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/)
    const anyBlockMatch = content.match(/```\n?([\s\S]*?)\n?```/)

    if (jsonMatch) {
      content = jsonMatch[1].trim()
    }
    else if (anyBlockMatch) {
      content = anyBlockMatch[1].trim()
    }
    else {
      // 2. No markdown blocks found, clean up think tags
      // Remove closed reasoning tokens (e.g. <think>...</think>)
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      // Handle unclosed tags if the response was cut off or malformed
      if (content.includes('<think>')) {
        content = content.replace(/<think>/g, '').trim()
      }
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
    }
    catch (parseError) {
      // If parsing fails, try one more aggressive cleanup: remove unescaped newlines in values
      try {
        const cleanedContent = content.replace(/":\s*"([\s\S]*?)"(?=\s*[,}])/, (match, p1) => {
          return `": ${JSON.stringify(p1.replace(/\\n/g, '\n'))}`
        })
        data = JSON.parse(cleanedContent)
      }
      catch (secondError) {
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
          }
          catch {
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
          },
        },
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
        ua: processField(data.ua),
      },
    }
  }
  catch (error) {
    console.error(`Error generating card ${fieldType}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to generate ${fieldType}`,
    }
  }
}

// Backward compatibility or legacy wrapper
export async function generateCardNameAction(
  deckName: string,
  type: 'story' | 'ending',
  category: string | null,
  excludedNames?: string[],
) {
  return generateCardFieldAction(deckName, 'name', type, category, undefined, excludedNames)
}
