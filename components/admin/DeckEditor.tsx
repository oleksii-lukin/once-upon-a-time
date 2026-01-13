'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getTranslation } from '@/app/i18n/client'
import { Deck } from '@/types/deck'
import DeckSettings from './DeckSettings'
import CardsEditor from './CardsEditor'

export default function DeckEditor({ deck, lng }: { deck: Deck, lng: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'cards' | 'settings') || 'cards'
  const { t } = getTranslation(lng, 'common')

  const [deckName, setDeckName] = useState(deck.name)
  const [isActive, setIsActive] = useState(deck.is_active)

  const setActiveTab = (tab: 'cards' | 'settings') => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleDeckUpdate = (updatedDeck: Partial<Deck>) => {
    if (updatedDeck.name) setDeckName(updatedDeck.name)
    if (updatedDeck.is_active !== undefined) setIsActive(updatedDeck.is_active)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Row with Tabs */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <h2 className="text-xl font-bold">{deckName}</h2>

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
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === 'settings'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('settings')}
          </button>
        </div>

        <span className={`px-2 py-1 rounded text-xs ml-auto ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          {isActive ? t('active') : t('inactive')}
        </span>
      </div>

      {activeTab === 'cards' && (
        <CardsEditor deckId={deck.id} deckName={deckName} lng={lng} />
      )}

      {activeTab === 'settings' && (
        <DeckSettings deck={deck} lng={lng} onDeckUpdate={handleDeckUpdate} />
      )}
    </div>
  )
}
