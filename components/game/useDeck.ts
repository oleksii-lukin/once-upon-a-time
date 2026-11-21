'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type Deck } from '@/types/model'

/**
 * Fetches the lobby's deck (background, card images, layout) once.
 * Returns null while loading or when the lobby has no deck.
 */
export function useDeck(deckId: string | undefined | null): Deck | null {
  const [deck, setDeck] = useState<Deck | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!deckId) return
    let cancelled = false

    const fetchDeck = async () => {
      const { data } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single()
      if (!cancelled && data) setDeck(data as unknown as Deck)
    }
    fetchDeck()

    return () => {
      cancelled = true
    }
  }, [deckId, supabase])

  return deck
}
