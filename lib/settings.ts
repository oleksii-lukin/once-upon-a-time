import { createClient } from '@/utils/supabase/server'

export async function getSettings(category?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('app_settings')
    .select('*')

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching settings:', error)
    throw new Error('Failed to fetch settings')
  }

  // Convert array of settings to key-value object
  const settings: Record<string, unknown> = {}
  data.forEach((setting) => {
    settings[setting.key] = setting.value
  })

  return settings
}

export async function getSetting(key: string, category?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.single()

  if (error) {
    console.error('Error fetching setting:', error)
    throw new Error(`Failed to fetch setting: ${key}`)
  }

  return data.value
}

export async function updateSetting(key: string, value: string, category?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('app_settings')
    .update({
      value,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.select()

  if (error) {
    console.error('Error updating single setting:', error)
    throw new Error(`Failed to update setting: ${key}`)
  }

  return data
}

export async function updateMultipleSettings(
  settings: Record<string, { value: string }>,
  category?: string,
) {
  const supabase = await createClient()
  const results = []

  for (const [key, { value }] of Object.entries(settings)) {
    let query = supabase
      .from('app_settings')
      .update({
        value,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query.select()

    if (error) {
      console.error(`Error updating multiple setting ${key}:`, error)
      throw new Error(`Failed to update setting: ${key}`)
    }

    results.push(data)
  }

  return results
}

export async function getGeneralSettings() {
  return await getSettings('general')
}

export async function getGameplaySettings() {
  return await getSettings('gameplay')
}

export async function getAISettings() {
  return await getSettings('ai')
}

export async function updateGeneralSettings(settings: Record<string, string>) {
  const updates: Record<string, { value: string }> = {}

  Object.entries(settings).forEach(([key, value]) => {
    updates[key] = { value }
  })

  return await updateMultipleSettings(updates, 'general')
}

export async function updateGameplaySettings(settings: Record<string, string>) {
  const updates: Record<string, { value: string }> = {}

  Object.entries(settings).forEach(([key, value]) => {
    updates[key] = { value }
  })

  return await updateMultipleSettings(updates, 'gameplay')
}

export async function updateAISettings(settings: Record<string, string>) {
  const updates: Record<string, { value: string }> = {}

  Object.entries(settings).forEach(([key, value]) => {
    updates[key] = { value }
  })

  return await updateMultipleSettings(updates, 'ai')
}
