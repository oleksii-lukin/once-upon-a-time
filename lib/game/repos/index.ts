/**
 * Barrel for the game repository layer.
 *
 * Server actions import from here; tests mock this module as a unit.
 * Each repo function receives the Supabase client as its first argument.
 */
export { type GameClient } from './client'
export { handRepo } from './handRepo'
export { playedCardsRepo } from './playedCardsRepo'
export { drawPileRepo } from './drawPileRepo'
export { sessionRepo } from './sessionRepo'
export { lobbyRepo } from './lobbyRepo'
export { playersRepo } from './playersRepo'
