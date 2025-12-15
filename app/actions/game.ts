'use server'

import { createClient } from '@/utils/supabase/server'

export async function initializeGame(lobbyId: string) {
  const supabase = await createClient()

  // Get lobby with deck info
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', lobbyId)
    .single()

  if (lobbyError || !lobby) {
    console.error('Error fetching lobby:', lobbyError)
    return { error: 'Lobby not found' }
  }

  // Determine which decks to use
  let deckIds: string[] = []
  if (lobby.settings && typeof lobby.settings === 'object' && (lobby.settings as any).selectedDecks) {
    deckIds = (lobby.settings as any).selectedDecks
  }

  // Fallback to lobby.deck_id if no settings or empty selectedDecks
  if (deckIds.length === 0 && lobby.deck_id) {
    deckIds = [lobby.deck_id]
  }

  if (deckIds.length === 0) {
    return { error: 'No decks selected' }
  }

  // Get all players in the lobby
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .neq('role', 'spectator')

  if (playersError || !playersData || playersData.length === 0) {
    console.error('Error fetching players:', playersError)
    return { error: 'No players found' }
  }

  // Shuffle players for random turn order
  const players = [...playersData].sort(() => Math.random() - 0.5)

  // Assign turn order to players
  for (let i = 0; i < players.length; i++) {
    const { error: updateError } = await supabase
      .from('players')
      .update({ turn_order: i })
      .eq('id', players[i].id)

    if (updateError) {
      console.error(`Error updating turn order for player ${players[i].id}:`, updateError)
      // Continue best effort
    }
  }

  // Get all cards from the selected decks
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('deck_id', deckIds)

  if (cardsError || !cards || cards.length === 0) {
    console.error('Error fetching cards:', cardsError)
    return { error: 'No cards found in selected decks' }
  }

  // Create game session
  const { data: gameSession, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      lobby_id: lobbyId,
      deck_id: deckIds[0], // Use first selected deck as primary
      current_turn_player_id: players[0].id, // First player in shuffled order starts
      storyteller_id: players[0].id, // First player is storyteller
    })
    .select()
    .single()

  if (sessionError || !gameSession) {
    console.error('Error creating game session:', sessionError)
    return { error: 'Failed to create game session' }
  }

  // Separate cards into Endings and Story Cards
  // Seed data uses type='ending' and category=NULL for ending cards
  const endingCards = cards.filter(c => c.type === 'ending')
  const storyCards = cards.filter(c => c.type !== 'ending')

  if (endingCards.length < players.length) {
    console.error('Not enough ending cards for players')
    return { error: 'Not enough ending cards' }
  }

  // Shuffle both piles
  const shuffledEndings = [...endingCards].sort(() => Math.random() - 0.5)
  const shuffledStory = [...storyCards].sort(() => Math.random() - 0.5)

  // Deal cards to players
  const storyCardsPerPlayer = 5
  const playerHands: any[] = []
  const drawPile: any[] = []

  let storyIndex = 0

  // Deal cards to each player
  for (let i = 0; i < players.length; i++) {
    // 1. Deal 1 Ending Card
    playerHands.push({
      game_session_id: gameSession.id,
      player_id: players[i].id,
      card_id: shuffledEndings[i].id,
      position: 999, // Special position or high number to sort last? Or we handle sorting in UI.
    })

    // 2. Deal Story Cards
    for (let j = 0; j < storyCardsPerPlayer; j++) {
      if (storyIndex < shuffledStory.length) {
        playerHands.push({
          game_session_id: gameSession.id,
          player_id: players[i].id,
          card_id: shuffledStory[storyIndex].id,
          position: j,
        })
        storyIndex++
      }
    }
  }

  // Remaining Story Cards go to draw pile
  while (storyIndex < shuffledStory.length) {
    drawPile.push({
      game_session_id: gameSession.id,
      card_id: shuffledStory[storyIndex].id,
      position: storyIndex - (players.length * storyCardsPerPlayer),
    })
    storyIndex++
  }

  // Insert player hands
  if (playerHands.length > 0) {
    const { error: handsError } = await supabase
      .from('player_hands')
      .insert(playerHands)

    if (handsError) {
      console.error('Error dealing cards to players:', handsError)
      return { error: 'Failed to deal cards' }
    }
  }

  // Insert draw pile
  if (drawPile.length > 0) {
    const { error: pileError } = await supabase
      .from('draw_pile')
      .insert(drawPile)

    if (pileError) {
      console.error('Error creating draw pile:', pileError)
      return { error: 'Failed to create draw pile' }
    }
  }

  return { success: true, gameSessionId: gameSession.id }
}
