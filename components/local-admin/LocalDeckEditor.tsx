'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getTranslation } from '@/app/i18n/client'
import { LocalDeckInfo } from '@/lib/file-system-handler'
import { ApiDeckResponse } from '@/app/api/image-editor/decks/route'
import LocalCardsEditor from './LocalCardsEditor'

interface LocalDeckEditorProps {
  lng: string
}

export default function LocalDeckEditor({ lng }: LocalDeckEditorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedDeckName = searchParams.get('deck')
  const activeTab = (searchParams.get('tab') as 'cards' | 'settings') || 'cards'
  const { t } = getTranslation(lng, 'common')

  const [deckList, setDeckList] = useState<LocalDeckInfo[]>([])
  const [selectedDeck, setSelectedDeck] = useState<LocalDeckInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load available decks from file system
  const loadDecksFromFileSystem = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/image-editor/decks')
      if (!response.ok) {
        throw new Error(`Failed to load decks: ${response.statusText}`)
      }

      const data = await response.json()
      const decks: LocalDeckInfo[] = data.decks.map((deck: ApiDeckResponse) => ({
        ...deck,
        lastModified: new Date(deck.lastModified),
        deckImages: [], // Will be populated when needed
      }))
      setDeckList(decks)
    }
    catch (err) {
      console.error('Error loading decks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load decks')
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // Handle deck selection from URL
  useEffect(() => {
    if (selectedDeckName && deckList.length > 0) {
      const deck = deckList.find(d => d.name === selectedDeckName)
      if (deck) {
        setSelectedDeck(deck)
      }
      else {
        // Deck not found, clear URL parameter
        const params = new URLSearchParams(searchParams)
        params.delete('deck')
        router.replace(`${pathname}?${params.toString()}`)
      }
    }
  }, [selectedDeckName, deckList, searchParams, router, pathname])

  useEffect(() => {
    loadDecksFromFileSystem()
  }, [loadDecksFromFileSystem])

  const setActiveTab = (tab: 'cards' | 'settings') => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleDeckSelect = (deck: LocalDeckInfo) => {
    setSelectedDeck(deck)
    const params = new URLSearchParams(searchParams)
    params.set('deck', deck.name)
    params.set('tab', 'cards') // Always start with cards view
    // Clear any card selection when switching decks
    params.delete('card')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleBackToDeckList = () => {
    setSelectedDeck(null)
    const params = new URLSearchParams(searchParams)
    params.delete('deck')
    params.delete('tab')
    params.delete('card')
    router.replace(`${pathname}?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {t('loading')}
            ...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadDecksFromFileSystem}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  // Show deck list if no deck is selected
  if (!selectedDeck) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">{t('select_deck')}</h2>
          <p className="text-muted-foreground">
            {t('select_deck_description')}
          </p>
        </div>

        {deckList.length === 0
          ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">{t('no_decks_found')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('check_specs_decks_directory')}
                  </p>
                </div>
              </div>
            )
          : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deckList.map(deck => (
                  <div
                    key={deck.name}
                    onClick={() => handleDeckSelect(deck)}
                    className="p-6 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2">{deck.name}</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        {t('cards')}
                        :
                        {' '}
                        {deck.cardCount}
                      </p>
                      <p>
                        {t('categories')}
                        :
                        {' '}
                        {deck.categories.join(', ')}
                      </p>
                      <p>
                        {t('deck_images')}
                        :
                        {' '}
                        {deck.deckImages.length}
                      </p>
                      <p className="text-xs">
                        {t('last_modified')}
                        :
                        {deck.lastModified.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    )
  }

  // Show deck editor when a deck is selected
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Row with Back Button and Tabs */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={handleBackToDeckList}
          className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50 transition-colors"
        >
          ←
          {' '}
          {t('back_to_decks')}
        </button>

        <h2 className="text-xl font-bold">{selectedDeck.name}</h2>

        <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === 'cards'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('cards')}
          </button>
          {/* Skip settings tab for now as per task requirements */}
        </div>

        <span className="px-2 py-1 rounded text-xs ml-auto bg-green-100 text-green-700">
          {t('local_file_system')}
        </span>
      </div>

      {/* Only show cards editor for now, skip settings */}
      {activeTab === 'cards' && (
        <LocalCardsEditor
          deckName={selectedDeck.name}
          deckPath={selectedDeck.path}
          lng={lng}
        />
      )}
    </div>
  )
}
