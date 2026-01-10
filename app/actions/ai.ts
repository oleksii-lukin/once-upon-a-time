'use server'

import { generateAIResponse } from '@/lib/ai/utils'
import { getCardGenerationSystemPrompt, getCardGenerationUserPrompt } from '@/lib/ai/prompts'

export async function generateCardNameAction(
  deckName: string,
  type: 'story' | 'ending',
  category: string | null
) {
  try {
    const systemPrompt = getCardGenerationSystemPrompt(deckName)
    const userPrompt = getCardGenerationUserPrompt(type, category)

    const prompt = `${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`

    const response = await generateAIResponse(prompt)

    // Clean potential markdown formatting
    let content = response.text.trim()
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }

    const data = JSON.parse(content)

    if (!data.en || !data.ru || !data.ua) {
      throw new Error('Invalid translation data in AI response')
    }

    return {
      success: true,
      data: {
        en: data.en,
        ru: data.ru,
        ua: data.ua
      }
    }
  } catch (error) {
    console.error('Error generating card name:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate name'
    }
  }
}
