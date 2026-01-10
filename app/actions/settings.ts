'use server'

import { updateGeneralSettings, updateGameplaySettings, updateAISettings } from '@/lib/settings'

export async function saveGeneralSettings(settings: Record<string, unknown>) {
  try {
    console.log('Attempting to save general settings:', settings)
    const result = await updateGeneralSettings(settings)
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
    await updateGameplaySettings(settings)
    return { success: true }
  }
  catch (error) {
    console.error('Failed to save gameplay settings:', error)
    return { success: false, error: 'Failed to save gameplay settings' }
  }
}

export async function saveAISettings(settings: Record<string, unknown>) {
  try {
    await updateAISettings(settings)
    return { success: true }
  }
  catch (error) {
    console.error('Failed to save AI settings:', error)
    return { success: false, error: 'Failed to save AI settings' }
  }
}
