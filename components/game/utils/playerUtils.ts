import { type Player } from '@/types/model'

/**
 * Filters out spectators and sorts players by turn_order (primary) or joined_at (fallback)
 */
export const getSortedPlayers = (players: Player[]): Player[] => {
  return players
    .filter((p: Player) => p.role !== 'spectator')
    .sort((a: Player, b: Player) => {
      if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
        return a.turn_order - b.turn_order
      }
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })
}

/**
 * Calculates the next player ID based on current player and sorted players list
 */
export const getNextPlayerId = (players: Player[], currentPlayerId: string | null): string | null => {
  if (!currentPlayerId) return null

  const sortedPlayers = getSortedPlayers(players)

  // For solo mode, keep the same player
  if (sortedPlayers.length === 1) {
    return currentPlayerId
  }

  const currentIndex = sortedPlayers.findIndex((p: Player) => p.id === currentPlayerId)
  if (currentIndex === -1) {
    return currentPlayerId
  }

  const nextIndex = (currentIndex + 1) % sortedPlayers.length
  return sortedPlayers[nextIndex].id
}

/**
 * Gets the next player object based on current player and sorted players list
 */
export const getNextPlayer = (players: Player[], currentPlayerId: string | null): Player | null => {
  const nextPlayerId = getNextPlayerId(players, currentPlayerId)
  if (!nextPlayerId) return null

  return players.find(p => p.id === nextPlayerId) || null
}
