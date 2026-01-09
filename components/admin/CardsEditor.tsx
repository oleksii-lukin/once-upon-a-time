'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import ImageUpload from './ImageUpload'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { getTranslation } from '@/app/i18n/client'
import SaveButton from '@/components/common/SaveButton'

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

interface CardsEditorProps {
  deckId: string
  lng: string
}

export default function CardsEditor({ deckId, lng }: CardsEditorProps) {
  const { getToken } = useAuth()
  const { t } = getTranslation(lng, 'common')

  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [activeLang, setActiveLang] = useState<LangCode>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']))

  // Card Form Data
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
  const [isSavingCard, setIsSavingCard] = useState(false)
  const [isCardSaved, setIsCardSaved] = useState(false)

  // Define categories for filter checkboxes
  const categories = [
    { id: 'all', label: t('admin.deckEditor.filter_all') },
    { id: 'ending', label: t('game.ending_card_label') },
    { id: 'protagonist', label: t('admin.deckEditor.categories.protagonist') },
    { id: 'antagonist', label: t('admin.deckEditor.categories.antagonist') },
    { id: 'setting', label: t('admin.deckEditor.categories.setting') },
    { id: 'object', label: t('admin.deckEditor.categories.object') },
    { id: 'catalyst', label: t('admin.deckEditor.categories.catalyst') },
    { id: 'trait', label: t('admin.deckEditor.categories.trait') },
  ]

  const fetchCards = useCallback(async () => {
    const token = await getToken({ template: 'supabase' })
    if (!token) return
    const supabase = createClient(token)
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('type', { ascending: true })
      .order('category', { ascending: true })
      .order('name', { ascending: true })
    if (data) setCards(data as unknown as Card[])
  }, [deckId, getToken])

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

  const toggleCategory = (categoryId: string) => {
    const newCategories = new Set(selectedCategories)

    if (categoryId === 'all') {
      // If clicking "All", clear others and select only All
      return setSelectedCategories(new Set(['all']))
    }

    // If clicking a specific category
    if (newCategories.has('all')) {
      newCategories.delete('all')
    }

    if (newCategories.has(categoryId)) {
      newCategories.delete(categoryId)
    }
    else {
      newCategories.add(categoryId)
    }

    // If nothing selected, revert to All
    if (newCategories.size === 0) {
      newCategories.add('all')
    }

    setSelectedCategories(newCategories)
  }

  const filteredCards = cards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesCategory = false
    if (selectedCategories.has('all')) {
      matchesCategory = true
    }
    else {
      const cardTypeOrCategory = card.type === 'ending' ? 'ending' : (card.category || 'protagonist')
      matchesCategory = selectedCategories.has(cardTypeOrCategory)
    }

    return matchesSearch && matchesCategory
  })

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
    if (!formData.name) {
      console.log('Name is missing')
      return
    }

    setIsSavingCard(true)
    setIsCardSaved(false)

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      alert('Authentication required. Please sign in again.')
      setIsSavingCard(false)
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

    if (selectedCard) {
      const { error } = await supabase
        .from('cards')
        .update(cardData)
        .eq('id', selectedCard.id)
        .select()

      setIsSavingCard(false)

      if (error) {
        console.error('Error updating card:', error)
        alert(`Failed to update card: ${error.message}`)
      }
      else {
        await fetchCards()
        setIsCardSaved(true)
        setTimeout(() => setIsCardSaved(false), 2000)
      }
    }
    else {
      const { error } = await supabase
        .from('cards')
        .insert({
          deck_id: deckId,
          ...cardData,
        })
        .select()

      setIsSavingCard(false)

      if (error) {
        console.error('Error creating card:', error)
        alert(`Failed to create card: ${error.message}`)
      }
      else {
        await fetchCards()
        setIsCardSaved(true)
        setTimeout(() => setIsCardSaved(false), 2000)
        handleCardSelect(null) // Clear form after add
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.deckEditor.delete_confirmation'))) return

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
    <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
      {/* Left Column: Card List */}
      <div className="w-full md:w-1/3 flex flex-col gap-4 min-h-0 h-full">
        <div className="flex flex-col gap-3 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('admin.deckEditor.search_cards_placeholder')}
            className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`px-2 py-1 rounded border transition-colors ${selectedCategories.has(cat.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow className="bg-muted/40 text-left">
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('name')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {filteredCards.map(card => (
                <TableRow
                  key={card.id}
                  className={`transition-colors cursor-pointer ${selectedCard?.id === card.id ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
                  onClick={() => handleCardSelect(card)}
                >
                  <TableCell className="px-4 py-3 text-sm text-foreground font-medium">
                    <div className="flex justify-between items-center">
                      <span>{card.name}</span>
                      <span className="text-[10px] uppercase opacity-50 border border-border px-1 rounded ml-2">
                        {card.type === 'ending'
                          ? 'END'
                          : (card.category || 'STY').substring(0, 3)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCards.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-center text-muted-foreground">
                    {searchQuery || selectedCategories.size > 0 ? t('no_search_results') : t('no_cards_yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden">
          <Button onClick={() => handleCardSelect(null)} className="w-full">{t('add_new_card')}</Button>
        </div>
      </div>

      {/* Right Column: Editor */}
      <div className="flex-1 bg-card p-6 rounded-xl border border-border overflow-y-auto h-full shadow-sm">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-card z-10 py-2 border-b border-border/50">
          <h3 className="text-foreground text-lg font-bold flex items-center gap-2">
            {selectedCard
              ? (
                  <>
                    <span className="text-muted-foreground font-normal text-base">
                      {t('edit_card')}
                      :
                    </span>
                    <span className="truncate max-w-[200px]">{selectedCard.name}</span>
                  </>
                )
              : t('add_new_card')}
          </h3>
          <div className="flex gap-2 items-center">
            {selectedCard && (
              <>
                <Button
                  variant="destructive"
                  className="mr-2 border-r border-border pr-3"
                  size="sm"
                  onClick={() => handleDelete(selectedCard.id)}
                >
                  {t('admin.deckEditor.delete_card')}
                </Button>
                <div className="h-6 w-px bg-border mx-1"></div>
                <Button
                  variant="ghost"
                  onClick={() => handleCardSelect(null)}
                  size="sm"
                >
                  {t('cancel_edit')}
                </Button>
              </>
            )}
            <SaveButton
              onClick={handleSave}
              disabled={!formData.name}
              isSaving={isSavingCard}
              isSaved={isCardSaved}
              saveText={selectedCard ? t('update_card') : t('add_card')}
              size="sm"
            />
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium block mb-1">
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
                className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder={t('admin.deckEditor.placeholders.cardNameExample')}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-muted-foreground text-sm font-medium block mb-1">{t('type')}</span>
                <select
                  value={formData.type}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      type: (e.target.value === 'ending' ? 'ending' : 'story'),
                    })}
                  className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="story">{t('admin.deckEditor.type.story')}</option>
                  <option value="ending">{t('game.ending_card_label')}</option>
                </select>
              </label>
              {formData.type === 'story' && (
                <label className="block">
                  <span className="text-muted-foreground text-sm font-medium block mb-1">{t('category')}</span>
                  <select
                    value={formData.category || 'protagonist'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        category: (e.target.value as FormData['category']),
                      })}
                    className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
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
              <span className="text-muted-foreground text-sm font-medium block">{t('card_image')}</span>
              <ImageUpload
                value={formData.image_url}
                onChange={url => setFormData({ ...formData, image_url: url })}
              />
              <label className="block pt-2">
                <span className="text-muted-foreground text-xs block mb-1">{t('or_paste_url')}</span>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full rounded-md bg-background border border-border p-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder={t('url_placeholder')}
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium block mb-1">
                {t('description')}
                {' '}
                (
                {activeLang.toUpperCase()}
                )
              </span>
              <textarea
                value={getValue('description')}
                onChange={e => updateField('description', e.target.value)}
                className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none min-h-[120px]"
                placeholder={t('admin.deckEditor.placeholders.cardDescription')}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-sm font-medium block mb-1">
                {t('usage_examples')}
                {' '}
                (
                {activeLang.toUpperCase()}
                )
              </span>
              <textarea
                value={getValue('usage_examples')}
                onChange={e => updateField('usage_examples', e.target.value)}
                className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none min-h-[120px]"
                placeholder={t('admin.deckEditor.placeholders.usageExamples')}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
