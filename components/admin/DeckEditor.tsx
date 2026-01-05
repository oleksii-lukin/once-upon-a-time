'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@clerk/nextjs'
import { Database } from '@/supabase/types'
import ImageUpload from './ImageUpload'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { getTranslation } from '@/app/i18n/client'
import { Check, Loader2 } from 'lucide-react'


type Deck = Database['public']['Tables']['decks']['Row'] & {
  bg_image_url?: string | null
  card_back_image_url?: string | null
  category_images?: Record<string, string> | null
}

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'cards' | 'settings') || 'cards'

  const setActiveTab = (tab: 'cards' | 'settings') => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [activeLang, setActiveLang] = useState<LangCode>('en')
  const { t } = getTranslation(lng, 'common')

  const [deckSettings, setDeckSettings] = useState({
    name: deck.name,
    bg_image_url: deck.bg_image_url || '',
    card_back_image_url: deck.card_back_image_url || '',
    category_images: (deck.category_images as Record<string, string>) || {}
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSettingsSaved, setIsSettingsSaved] = useState(false)

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

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']))

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
    } else {
      newCategories.add(categoryId)
    }

    // If nothing selected, revert to All
    if (newCategories.size === 0) {
      newCategories.add('all')
    }

    setSelectedCategories(newCategories)
  }

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesCategory = false
    if (selectedCategories.has('all')) {
      matchesCategory = true
    } else {
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
    // console.log('handleSave called', { formData, selectedCard })
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

    // console.log('Sending card data:', cardData)

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
        // console.log('Update success:', data)
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
        // console.log('Create success:', data)
        await fetchCards()
        handleCardSelect(null) // Clear form after add
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.deckEditor.delete_confirmation'))) return;

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
        category_images: deckSettings.category_images
      })
      .eq('id', deck.id)

    setIsSavingSettings(false)

    if (error) {
      alert(`Failed to update deck: ${error.message}`)
    } else {
      setIsSettingsSaved(true)
      setTimeout(() => setIsSettingsSaved(false), 2000)
    }
  }

  const updateCategoryImage = (catId: string, url: string) => {
    setDeckSettings(prev => ({
      ...prev,
      category_images: {
        ...prev.category_images,
        [catId]: url
      }
    }))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Row with Tabs */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <h2 className="text-xl font-bold">{deckSettings.name}</h2>

        <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === 'cards'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {t('cards') || "Cards"}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === 'settings'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {t('settings') || "Settings"}
          </button>
        </div>

        <span className={`px-2 py-1 rounded text-xs ml-auto ${deck.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          {deck.is_active ? t('active') : t('inactive')}
        </span>
      </div>

      {activeTab === 'cards' && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
          {/* Left Column: Card List */}
          <div className="w-full md:w-1/3 flex flex-col gap-4 min-h-0 h-full">
            <div className="flex flex-col gap-3 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {selectedCard ? (
                  <>
                    <span className="text-muted-foreground font-normal text-base">{t('edit_card')}:</span>
                    <span className="truncate max-w-[200px]">{selectedCard.name}</span>
                  </>
                ) : t('add_new_card')}
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
                <Button
                  onClick={handleSave}
                  disabled={!formData.name}
                  size="sm"
                >
                  {selectedCard ? t('update_card') : t('add_card')}
                </Button>
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
                    {t('card_name')} ({activeLang.toUpperCase()})
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
                    {t('description')} ({activeLang.toUpperCase()})
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
                    {t('usage_examples')} ({activeLang.toUpperCase()})
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
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 bg-card p-6 rounded-xl border border-border overflow-y-auto h-full shadow-sm">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-card z-10 py-2 border-b border-border/50">
            <h3 className="text-lg font-bold">{t('deck_settings') || "Deck Settings"}</h3>
            <Button
              onClick={handleSaveDeckSettings}
              size="sm"
              disabled={isSavingSettings}
              className="min-w-[140px]"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('saving') || "Saving..."}
                </>
              ) : isSettingsSaved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t('saved') || "Saved"}
                </>
              ) : (
                t('save_settings') || "Save Settings"
              )}
            </Button>
          </div>

          <div className="space-y-8 max-w-5xl">
            {/* Deck Name */}
            <label className="block max-w-xl">
              <span className="text-muted-foreground text-sm font-medium block mb-1">{t('deck_name') || "Deck Name"}</span>
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
                <span className="text-muted-foreground text-sm font-medium block mb-2">{t('deck_background') || "Deck Background"}</span>
                <div className="text-xs text-muted-foreground mb-2">Used for game board background</div>
                <ImageUpload
                  value={deckSettings.bg_image_url}
                  onChange={url => setDeckSettings({ ...deckSettings, bg_image_url: url })}
                  label={t('upload_background') || "Upload Background"}
                />
              </div>
              <div className="flex flex-col items-start md:items-end">
                <div className="text-left md:text-right">
                  <span className="text-muted-foreground text-sm font-medium block mb-2">{t('card_foreground_border') || "Card Foreground"}</span>
                  <div className="text-xs text-muted-foreground mb-2">Used as card border/frame</div>
                </div>
                <ImageUpload
                  value={deckSettings.card_back_image_url}
                  onChange={url => setDeckSettings({ ...deckSettings, card_back_image_url: url })}
                  label={t('upload_border') || "Upload Border"}
                />
              </div>
            </div>

            {/* Category Images */}
            <div>
              <h4 className="font-medium text-base mb-4 pt-4 border-t border-border">{t('category_images') || "Category Images"}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.filter(c => c.id !== 'all').map(cat => (
                  <div key={cat.id} className="p-3 rounded border border-border bg-muted/20">
                    <span className="text-sm font-medium block mb-2 text-center">{cat.label}</span>
                    <ImageUpload
                      value={deckSettings.category_images?.[cat.id] || ''}
                      onChange={url => updateCategoryImage(cat.id, url)}
                      label=" "
                      className="mx-auto"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
