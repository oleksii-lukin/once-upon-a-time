'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@clerk/nextjs'
import { Database } from '@/supabase/types'
import ImageUpload from './ImageUpload'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { getTranslation } from '@/app/i18n/client'

type Deck = Database['public']['Tables']['decks']['Row']
type Card = Database['public']['Tables']['cards']['Row'] & {
  type: 'story' | 'ending'
  category: 'protagonist' | 'antagonist' | 'setting' | 'object' | 'catalyst' | 'trait' | null
  translations?: {
    [key: string]: {
      name: string
      description: string
      usage_examples: string
    }
  }
}

type LangCode = 'en' | 'ru' | 'ua'
type TranslationEntry = {
  name: string
  description: string
  usage_examples: string
}
type Translations = Record<Exclude<LangCode, 'en'>, TranslationEntry>
type FormField = 'name' | 'description' | 'usage_examples'
type FormData = {
  name: string
  description: string
  usage_examples: string
  image_url: string
  type: 'story' | 'ending'
  category: 'protagonist' | 'antagonist' | 'setting' | 'object' | 'catalyst' | 'trait' | null
  translations: Translations
}

export default function DeckEditor({ deck, lng }: { deck: Deck, lng: string }) {
  const { getToken } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [activeLang, setActiveLang] = useState<LangCode>('en')
  const { t } = getTranslation(lng, 'common')
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    usage_examples: '',
    image_url: '',
    type: 'story',
    category: 'protagonist',
    translations: {
      ru: { name: '', description: '', usage_examples: '' },
      ua: { name: '', description: '', usage_examples: '' },
    },
  })
  const [loading, setLoading] = useState(true)

  const fetchCards = useCallback(async () => {
    const token = await getToken({ template: 'supabase' })
    if (!token) return
    const supabase = createClient(token)
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deck.id)
      .order('type', { ascending: true })
      .order('category', { ascending: true })
      .order('name', { ascending: true })
    if (data) setCards(data as unknown as Card[])
    setLoading(false)
  }, [deck.id, getToken])

  useEffect(() => {
    let isCancelled = false

    const fetchData = async () => {
      await fetchCards()
      if (!isCancelled) {
        // State updates are handled inside fetchCards
      }
    }

    fetchData()

    return () => {
      isCancelled = true
    }
  }, [fetchCards])

  const handleCardSelect = (card: Card | null) => {
    setSelectedCard(card)
    setActiveLang('en')
    if (card) {
      setFormData({
        name: card.name,
        description: card.description || '',
        usage_examples: card.usage_examples || '',
        image_url: card.image_url || '',
        type: card.type || 'story',
        category: card.category || 'protagonist',
        translations: {
          ru: {
            name: card.translations?.ru?.name || '',
            description: card.translations?.ru?.description || '',
            usage_examples: card.translations?.ru?.usage_examples || '',
          },
          ua: {
            name: card.translations?.ua?.name || '',
            description: card.translations?.ua?.description || '',
            usage_examples: card.translations?.ua?.usage_examples || '',
          },
        },
      })
    }
    else {
      setFormData({
        name: '',
        description: '',
        usage_examples: '',
        image_url: '',
        type: 'story',
        category: 'protagonist',
        translations: {
          ru: { name: '', description: '', usage_examples: '' },
          ua: { name: '', description: '', usage_examples: '' },
        },
      })
    }
  }

  const handleSave = async () => {
    console.log('handleSave called', { formData, selectedCard })
    if (!formData.name) {
      console.log('Name is missing')
      return
    }

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      alert('Authentication required. Please sign in again.')
      return
    }
    const supabase = createClient(token)

    // Include 'en' in translations to match seed data structure
    const translationsToSave = {
      ...formData.translations,
      en: {
        name: formData.name,
        description: formData.description,
        usage_examples: formData.usage_examples,
      },
    }

    const cardData = {
      name: formData.name,
      description: formData.description,
      usage_examples: formData.usage_examples,
      image_url: formData.image_url || null, // Send null if empty
      type: formData.type,
      category: formData.type === 'story' ? formData.category : null,
      translations: translationsToSave,
    }

    console.log('Sending card data:', cardData)

    if (selectedCard) {
      const { error, data } = await supabase
        .from('cards')
        .update(cardData)
        .eq('id', selectedCard.id)
        .select()

      if (error) {
        console.error('Error updating card:', error)
        alert(`Failed to update card: ${error.message}`)
      }
      else {
        console.log('Update success:', data)
        await fetchCards()
        // Keep the form as is, but maybe show a success indicator?
      }
    }
    else {
      const { error, data } = await supabase
        .from('cards')
        .insert({
          deck_id: deck.id,
          ...cardData,
        })
        .select()

      if (error) {
        console.error('Error creating card:', error)
        alert(`Failed to create card: ${error.message}`)
      }
      else {
        console.log('Create success:', data)
        await fetchCards()
        handleCardSelect(null) // Clear form after add
      }
    }
  }

  const handleDelete = async (id: string) => {
    const token = await getToken({ template: 'supabase' })
    if (!token) {
      alert('Authentication required. Please sign in again.')
      return
    }
    const supabase = createClient(token)
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) {
      console.error('Error deleting card:', error)
      alert(`Failed to delete card: ${error.message}`)
    }
    else {
      fetchCards()
      if (selectedCard?.id === id) handleCardSelect(null)
    }
  }

  const updateField = (field: FormField, value: string) => {
    if (activeLang === 'en') {
      setFormData({ ...formData, [field]: value })
    }
    else {
      setFormData({
        ...formData,
        translations: {
          ...formData.translations,
          [activeLang]: {
            ...formData.translations[activeLang as Exclude<LangCode, 'en'>],
            [field]: value,
          },
        },
      })
    }
  }

  const getValue = (field: FormField): string => {
    if (activeLang === 'en') {
      return formData[field]
    }
    const lang = activeLang as Exclude<LangCode, 'en'>
    return formData.translations[lang]?.[field] || ''
  }

  return (
    <div className="h-full grid grid-rows-2 gap-8">
      <div className="flex flex-col gap-4 min-h-0">
        <h2 className="text-foreground text-xl font-bold">
          {t('cards')}
          {' '}
          (
          {cards.length}
          )
        </h2>
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 text-left">
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('type')}</TableHead>
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('name')}</TableHead>
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('description')}</TableHead>
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {cards.map(card => (
                <TableRow
                  key={card.id}
                  className={`transition-colors cursor-pointer ${selectedCard?.id === card.id ? 'bg-muted/50' : ''}`}
                  onClick={() => handleCardSelect(card)}
                >
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {card.type === 'ending'
                      ? t('game.ending_card_label')
                      : (
                          card.category
                            ? t(`admin.deckEditor.categories.${card.category}`)
                            : t('admin.deckEditor.type.story')
                        )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground font-medium">{card.name}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs">{card.description}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(card.id)
                      }}
                    >
                      {t('delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    {t('no_cards_yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-border overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-foreground text-lg font-bold">
            {selectedCard ? t('edit_card') : t('add_new_card')}
          </h3>
          {selectedCard && (
            <button
              onClick={() => handleCardSelect(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              {t('cancel_edit')}
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-6 border-b border-border pb-2">
          {(['en', 'ru', 'ua'] as LangCode[]).map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeLang === lang
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium">
                {t('card_name')}
                {' '}
                (
                {activeLang.toUpperCase()}
                )
              </span>
              <input
                type="text"
                value={getValue('name')}
                onChange={e => updateField('name', e.target.value)}
                className="mt-1 block w-full rounded-lg bg-background border-border text-foreground focus:ring-primary focus:border-primary"
                placeholder={t('admin.deckEditor.placeholders.cardNameExample')}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-muted-foreground text-sm font-medium">{t('type')}</span>
                <select
                  value={formData.type}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      type: (e.target.value === 'ending' ? 'ending' : 'story'),
                    })}
                  className="mt-1 block w-full rounded-lg bg-background border-border text-foreground focus:ring-primary focus:border-primary"
                >
                  <option value="story">{t('admin.deckEditor.type.story')}</option>
                  <option value="ending">{t('game.ending_card_label')}</option>
                </select>
              </label>
              {formData.type === 'story' && (
                <label className="block">
                  <span className="text-muted-foreground text-sm font-medium">{t('category')}</span>
                  <select
                    value={formData.category || 'protagonist'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        category: (e.target.value as FormData['category']),
                      })}
                    className="mt-1 block w-full rounded-lg bg-background border-border text-foreground focus:ring-primary focus:border-primary"
                  >
                    <option value="protagonist">{t('admin.deckEditor.categories.protagonist')}</option>
                    <option value="antagonist">{t('admin.deckEditor.categories.antagonist')}</option>
                    <option value="setting">{t('admin.deckEditor.categories.setting')}</option>
                    <option value="object">{t('admin.deckEditor.categories.object')}</option>
                    <option value="catalyst">{t('admin.deckEditor.categories.catalyst')}</option>
                    <option value="trait">{t('admin.deckEditor.categories.trait')}</option>
                  </select>
                </label>
              )}
            </div>
            <div className="space-y-2">
              <span className="text-muted-foreground text-sm font-medium">{t('card_image')}</span>
              <ImageUpload
                value={formData.image_url}
                onChange={url => setFormData({ ...formData, image_url: url })}
              />
              <label className="block">
                <span className="text-muted-foreground text-xs">{t('or_paste_url')}</span>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="mt-1 block w-full rounded-lg bg-background border-border text-foreground text-sm focus:ring-primary focus:border-primary"
                  placeholder={t('url_placeholder')}
                />
              </label>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium">
                {t('description')}
                {' '}
                (
                {activeLang.toUpperCase()}
                )
              </span>
              <textarea
                value={getValue('description')}
                onChange={e => updateField('description', e.target.value)}
                className="mt-1 block w-full rounded-lg bg-background border-border text-foreground focus:ring-primary focus:border-primary h-24"
                placeholder={t('admin.deckEditor.placeholders.cardDescription')}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium">
                {t('usage_examples')}
                {' '}
                (
                {activeLang.toUpperCase()}
                )
              </span>
              <textarea
                value={getValue('usage_examples')}
                onChange={e => updateField('usage_examples', e.target.value)}
                className="mt-1 block w-full rounded-lg bg-background border-border text-foreground focus:ring-primary focus:border-primary h-24"
                placeholder={t('admin.deckEditor.placeholders.usageExamples')}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!formData.name}
            className="px-6 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {selectedCard ? t('update_card') : t('add_card')}
          </button>
        </div>
      </div>
    </div>
  )
}
