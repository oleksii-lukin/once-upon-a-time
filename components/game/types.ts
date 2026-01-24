/**
 * Type definitions for XState game machine actors
 *
 * This file contains shared type definitions for the game machine,
 * providing type safety and centralized type definitions following
 * XState v5's modular design principles.
 */

import { type CardData } from '@/utils/gameUtils'

/**
 * Extended card interfaces for different contexts
 * These interfaces extend the base CardData with additional properties
 * from joined tables or computed values used in the UI components.
 */

/**
 * Card data as it appears in a player's hand
 * Includes properties from the player_hands table
 */
export interface HandCardData extends CardData {
  /** The hand record ID from player_hands table */
  hand_id: string
  /** The position of the card in the hand */
  position?: number
}

/**
 * Card data as it appears in the played cards area
 * Includes properties from the played_cards table
 */
export interface PlayedCardData extends CardData {
  /** The player ID who played this card */
  played_by: string
  /** The status of the played card (PENDING, CONFIRMED, REVERTED) */
  status: string
  /** The played card record ID from played_cards table */
  played_card_id: string
}
