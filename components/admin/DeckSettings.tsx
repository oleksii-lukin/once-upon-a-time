'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import ImageUpload from './ImageUpload'
import { Button } from '@/components/ui/button'
import { getTranslation } from '@/app/i18n/client'
import { Loader2 } from 'lucide-react'
import SaveButton from '@/components/common/SaveButton'

type Deck = Database['public']['Tables']['decks']['Row'] & {
  bg_image_url?: string | null
  card_back_image_url?: string | null
  category_images?: Record<string, string> | null
}

interface DeckSettingsProps {
  deck: Deck
  lng: string
  onDeckUpdate?: (updatedDeck: Partial<Deck>) => void
}

export default function DeckSettings({ deck, lng, onDeckUpdate }: DeckSettingsProps) {
  const { getToken } = useAuth()
  const { t } = getTranslation(lng, 'common')

  const [deckSettings, setDeckSettings] = useState({
    name: deck.name,
    bg_image_url: deck.bg_image_url || '',
    card_back_image_url: deck.card_back_image_url || '',
    category_images: (deck.category_images as Record<string, string>) || {},
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSettingsSaved, setIsSettingsSaved] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [isActive, setIsActive] = useState(deck.is_active)

  // Define categories for filter checkboxes
  const categories = [
    { id: 'ending', label: t('game.ending_card_label') },
    { id: 'protagonist', label: t('admin.deckEditor.categories.protagonist') },
    { id: 'antagonist', label: t('admin.deckEditor.categories.antagonist') },
    { id: 'setting', label: t('admin.deckEditor.categories.setting') },
    { id: 'object', label: t('admin.deckEditor.categories.object') },
    { id: 'catalyst', label: t('admin.deckEditor.categories.catalyst') },
    { id: 'trait', label: t('admin.deckEditor.categories.trait') },
  ]

  const handleToggleActive = async () => {
    setIsTogglingActive(true)

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      setIsTogglingActive(false)
      return
    }
    const supabase = createClient(token)

    const newActiveStatus = !isActive

    const { error } = await supabase
      .from('decks')
      .update({ is_active: newActiveStatus })
      .eq('id', deck.id)

    setIsTogglingActive(false)

    if (error) {
      alert(`Failed to ${newActiveStatus ? 'activate' : 'deactivate'} deck: ${error.message}`)
    }
    else {
      setIsActive(newActiveStatus)
      onDeckUpdate?.({ is_active: newActiveStatus })
    }
  }

  const handleSaveDeckSettings = async () => {
    setIsSavingSettings(true)
    setIsSettingsSaved(false)

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      setIsSavingSettings(false)
      return
    }
    const supabase = createClient(token)

    const { error } = await supabase
      .from('decks')
      .update({
        name: deckSettings.name,
        bg_image_url: deckSettings.bg_image_url || null,
        card_back_image_url: deckSettings.card_back_image_url || null,
        category_images: deckSettings.category_images,
      })
      .eq('id', deck.id)

    setIsSavingSettings(false)

    if (error) {
      alert(`Failed to update deck: ${error.message}`)
    }
    else {
      setIsSettingsSaved(true)
      setTimeout(() => setIsSettingsSaved(false), 2000)
      onDeckUpdate?.({
        name: deckSettings.name,
        bg_image_url: deckSettings.bg_image_url,
        card_back_image_url: deckSettings.card_back_image_url,
        category_images: deckSettings.category_images,
      })
    }
  }

  const updateCategoryImage = (catId: string, url: string) => {
    const newSettings = {
      ...deckSettings,
      category_images: {
        ...deckSettings.category_images,
        [catId]: url,
      },
    }
    setDeckSettings(newSettings)
  }

  return (
    <div className="flex-1 bg-card p-6 rounded-xl border border-border overflow-y-auto h-full shadow-sm">
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-card z-10 py-2 border-b border-border/50">
        <h3 className="text-lg font-bold">{t('deck_settings')}</h3>
        <div className="flex gap-2 items-center">
          <Button
            variant={isActive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggleActive}
            disabled={isTogglingActive}
            className="mr-2"
          >
            {isTogglingActive
              ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isActive ? t('deactivating') : t('activating')}
                  </>
                )
              : isActive
                ? t('deactivate_deck')
                : t('activate_deck')}
          </Button>
          <SaveButton
            onClick={handleSaveDeckSettings}
            disabled={isSavingSettings}
            isSaving={isSavingSettings}
            isSaved={isSettingsSaved}
            saveText={t('save_settings')}
            savingText={t('saving')}
            savedText={t('saved')}
            size="sm"
          />
        </div>
      </div>

      <div className="space-y-8 max-w-5xl">
        {/* Deck Name */}
        <label className="block max-w-xl">
          <span className="text-muted-foreground text-sm font-medium block mb-1">{t('deck_name')}</span>
          <input
            type="text"
            value={deckSettings.name}
            onChange={e => setDeckSettings({ ...deckSettings, name: e.target.value })}
            className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </label>

        {/* Main Images */}
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <span className="text-muted-foreground text-sm font-medium block mb-2">{t('deck_background')}</span>
            <div className="text-xs text-muted-foreground mb-2">{t('deck_background_description')}</div>
            <ImageUpload
              value={deckSettings.bg_image_url}
              onChange={url => setDeckSettings({ ...deckSettings, bg_image_url: url })}
              label={t('upload_background')}
            />
          </div>
          <div className="flex flex-col items-start md:items-end">
            <div className="text-left md:text-right">
              <span className="text-muted-foreground text-sm font-medium block mb-2">{t('card_foreground_border')}</span>
              <div className="text-xs text-muted-foreground mb-2">{t('card_foreground_description')}</div>
            </div>
            <ImageUpload
              value={deckSettings.card_back_image_url}
              onChange={url => setDeckSettings({ ...deckSettings, card_back_image_url: url })}
              label={t('upload_border')}
            />
          </div>
        </div>

        {/* Category Images */}
        <div>
          <h4 className="font-medium text-base mb-4 pt-4 border-t border-border">{t('category_images')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="p-3 rounded border border-border bg-muted/20">
                <span className="text-sm font-medium block mb-2 text-center">{cat.label}</span>
                <ImageUpload
                  value={deckSettings.category_images?.[cat.id] || ''}
                  onChange={url => updateCategoryImage(cat.id, url)}
                  label=" "
                  className="mx-auto"
                  objectFit="contain"
                  sizingMode="fillWidth"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
