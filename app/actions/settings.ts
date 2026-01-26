'use server'

import { updateGeneralSettings, updateGameplaySettings, updateAISettings } from '@/lib/settings'
import { testAIConnection } from '@/lib/ai/utils'
import type { AIProvider } from '@/lib/ai/config'

export async function saveGeneralSettings(settings: Record<string, unknown>) {
  try {
    console.log('Attempting to save general settings:', settings)
    // Convert all values to strings for database storage
    const stringSettings: Record<string, string> = {}
    Object.entries(settings).forEach(([key, value]) => {
      stringSettings[key] = typeof value === 'string' ? value : JSON.stringify(value)
    })
    const result = await updateGeneralSettings(stringSettings)
    console.log('Successfully saved general settings:', result)
    return { success: true }
  }
  catch (error) {
    console.error('Failed to save general settings:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save general settings' }
  }
}

export async function saveGameplaySettings(settings: Record<string, unknown>) {
  try {
    // Convert all values to strings for database storage
    const stringSettings: Record<string, string> = {}
    Object.entries(settings).forEach(([key, value]) => {
      stringSettings[key] = typeof value === 'string' ? value : JSON.stringify(value)
    })
    await updateGameplaySettings(stringSettings)
    return { success: true }
  }
  catch (error) {
    console.error('Failed to save gameplay settings:', error)
    return { success: false, error: 'Failed to save gameplay settings' }
  }
}

export async function saveAISettings(settings: Record<string, unknown>) {
  try {
    // Convert all values to strings for database storage
    const stringSettings: Record<string, string> = {}
    Object.entries(settings).forEach(([key, value]) => {
      stringSettings[key] = typeof value === 'string' ? value : JSON.stringify(value)
    })
    await updateAISettings(stringSettings)
    return { success: true }
  }
  catch (error) {
    console.error('Failed to save AI settings:', error)
    return { success: false, error: 'Failed to save AI settings' }
  }
}

export async function testAIConfig(provider: AIProvider) {
  try {
    return await testAIConnection(provider)
  }
  catch (error) {
    console.error('Failed to test AI connection:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to test AI connection' }
  }
}

export async function fetchAvailableModels(url: string, apiKey?: string) {
  try {
    const response = await fetch(`${url}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()
    // Standard OpenAI models response has a 'data' array with objects containing 'id'
    if (data && Array.isArray(data.data)) {
      return {
        success: true,
        models: data.data.map((m: { id: string }) => m.id),
      }
    }

    return { success: false, error: 'Invalid response format from provider' }
  }
  catch (error) {
    console.error('Failed to fetch AI models:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    }
  }
}
