import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'

type Player = Database['public']['Tables']['players']['Row']
type GameSession = Database['public']['Tables']['game_sessions']['Row']
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string, played_by?: string }

export const useGameEngine = (
  gameSession: GameSession | null,
  currentPlayer: Player | undefined,
  players: Player[],
  fetchGameState: () => Promise<void>,
) => {
  const supabase = createClient()
  const [isDrawing, setIsDrawing] = useState(false)

  // Helper: Draw cards for a player
  const drawCards = useCallback(async (playerId: string, count: number = 1) => {
    if (!gameSession) return

    setIsDrawing(true)
    try {
      // 1. Get top cards from draw pile
      const { data: drawCards, error: drawError } = await supabase
        .from('draw_pile')
        .select('*')
        .eq('game_session_id', gameSession.id)
        .order('position', { ascending: true })
        .limit(count)

      if (drawError || !drawCards || drawCards.length === 0) {
        console.error('Error fetching from draw pile:', drawError)
        return
      }

      // 2. Add to player hand
      const cardsToAdd = drawCards.map((dc, index) => ({
        game_session_id: gameSession.id,
        player_id: playerId,
        card_id: dc.card_id,
        position: 999 + index, // Position will be fixed by subsequent reorders or just appended
      }))

      const { error: handError } = await supabase
        .from('player_hands')
        .insert(cardsToAdd)

      if (handError) {
        console.error('Error adding to hand:', handError)
        return
      }

      // 3. Remove from draw pile
      const { error: removeError } = await supabase
        .from('draw_pile')
        .delete()
        .in('id', drawCards.map(dc => dc.id))

      if (removeError) {
        console.error('Error removing from draw pile:', removeError)
      }
    }
    finally {
      setIsDrawing(false)
      fetchGameState()
    }
  }, [supabase, gameSession, fetchGameState])

  const playCard = async (card: CardData, currentHand: CardData[], playedCardsCount: number) => {
    if (!gameSession || !currentPlayer) return

    // 1. Remove from hand
    const { error: removeError } = await supabase
      .from('player_hands')
      .delete()
      .eq('game_session_id', gameSession.id)
      .eq('player_id', currentPlayer.id)
      .eq('card_id', card.id)

    if (removeError) {
      console.error('Error removing card from hand:', removeError)
      fetchGameState()
      return
    }

    // 2. Add to played cards
    const { error: playError } = await supabase
      .from('played_cards')
      .insert({
        game_session_id: gameSession.id,
        player_id: currentPlayer.id,
        card_id: card.id,
        position: playedCardsCount,
      })

    if (playError) {
      console.error('Error playing card:', playError)
      fetchGameState()
    }
  }

  const passTurn = async () => {
    if (!gameSession || !currentPlayer) return

    // 1. Draw a card (Penalty for passing)
    await drawCards(currentPlayer.id, 1)

    // 2. Find next player
    const sortedPlayers = [...players].sort((a, b) => {
      if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
        return a.turn_order - b.turn_order
      }
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })
    const currentIndex = sortedPlayers.findIndex(p => p.id === currentPlayer.id)
    if (currentIndex === -1) return

    const nextIndex = (currentIndex + 1) % sortedPlayers.length
    const nextPlayer = sortedPlayers[nextIndex]

    // 3. Update Turn
    const { error } = await supabase
      .from('game_sessions')
      .update({
        current_turn_player_id: nextPlayer.id,
        storyteller_id: nextPlayer.id,
      })
      .eq('id', gameSession.id)

    if (error) console.error('Error passing turn:', error)
  }

  const interrupt = async () => {
    if (!gameSession || !currentPlayer) return

    const currentStorytellerId = gameSession.storyteller_id

    // Cannot interrupt yourself
    if (currentStorytellerId === currentPlayer.id) return

    // 1. Previous storyteller draws a card
    if (currentStorytellerId) {
      await drawCards(currentStorytellerId, 1)
    }

    // 2. Update Turn to Interrupter (Current Player)
    const { error } = await supabase
      .from('game_sessions')
      .update({
        current_turn_player_id: currentPlayer.id,
        storyteller_id: currentPlayer.id,
      })
      .eq('id', gameSession.id)

    if (error) console.error('Error interrupting:', error)
  }

  const winGame = async (endingCardId: string) => {
    if (!gameSession || !currentPlayer) return

    // Logic to verify empty hand could be checked here or on backend,
    // but for now we trust the client state check before calling this.

    // Update Game Session with Winner
    // This triggers the subscription in GameView to show the win screen (if we had one separate, or updates lobby state via trigger)
    const { error } = await supabase
      .from('game_sessions')
      .update({
        winner_id: currentPlayer.id,
        status: 'COMPLETED',
      })
      .eq('id', gameSession.id)

    if (error) {
      console.error('Error finishing game:', error)
    }
    else {
      // Also update lobby to FINISHED to clean up listings
      await supabase
        .from('lobbies')
        .update({ status: 'FINISHED' })
        .eq('id', gameSession.lobby_id)
    }
  }

  return {
    playCard,
    passTurn,
    interrupt,
    winGame,
    isDrawing,
  }
}
