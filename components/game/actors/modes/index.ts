import { setup } from 'xstate'

/**
 * Shared context interface for all storytelling mode machines.
 *
 * This interface defines the common state that all storytelling machines maintain
 * during gameplay. It tracks card play limits, interaction capabilities, and
 * the current state of the storytelling session.
 *
 * ## Usage
 * All storytelling machines (tutorial, simple, full, solo) use this context
 * interface but configure the properties differently based on their specific
 * rule sets and capabilities.
 *
 * ## Properties
 * @property cardsPlayedThisTurn - Counter for cards played in current turn (0-based)
 * @property maxCardsPerTurn - Maximum cards allowed per turn (null = unlimited)
 * @property canInterrupt - Whether other players can interrupt the storyteller
 * @property canObject - Whether players can object to played cards
 * @property lastPlayedCardId - ID of most recently played card for objection handling
 *
 * ## Configuration by Mode
 * - **Tutorial**: maxCardsPerTurn=1, canInterrupt=false, canObject=false
 * - **Simple**: maxCardsPerTurn=null, canInterrupt=false, canObject=false
 * - **Full**: maxCardsPerTurn=null, canInterrupt=true, canObject=true
 * - **Solo**: maxCardsPerTurn=null, canInterrupt=false, canObject=false
 */
export interface StorytellingContext {
  /** Number of cards played in the current turn (starts at 0) */
  cardsPlayedThisTurn: number
  /** Maximum cards allowed per turn (null = unlimited) */
  maxCardsPerTurn: number | null
  /** Whether players can interrupt the current storyteller */
  canInterrupt: boolean
  /** Whether players can object to played cards */
  canObject: boolean
  /** ID of the last card played in this storytelling session (null if none played) */
  lastPlayedCardId: string | null
}

/**
 * Union type of all possible events that can occur during storytelling modes.
 *
 * This comprehensive event type covers all interactions that can happen across
 * different storytelling modes, from basic card play to complex multiplayer
 * interactions like interruptions and objections.
 *
 * ## Event Categories
 *
 * ### Core Gameplay Events
 * - `PLAY_CARD`: Player initiates playing a card
 * - `PLAY_CARD_ACK`: Confirmation that card was successfully played to database
 * - `PASS`: Player ends their storytelling turn
 *
 * ### Multiplayer Interaction Events
 * - `INTERRUPT`: Another player interrupts the current storyteller
 * - `OBJECT`: A player objects to a recently played card
 *
 * ### Validation Events
 * - `CONFIRM`: Manual confirmation of a played card
 * - `VALID`: Validation result indicating an action was valid
 * - `INVALID`: Validation result indicating an action was invalid
 *
 * ## Event Data
 * Events include relevant IDs for tracking players, cards, and game state:
 * - Card events include `cardId` for the card being played
 * - Acknowledgment events include `playedCardId` for database record reference
 * - Player interaction events include `player_id` for the acting player
 * - Objection events include `played_card_id` for the card being objected to
 *
 * ## Usage in State Machines
 * Different storytelling modes handle different subsets of these events:
 * - Tutorial/Simple modes only handle core gameplay events
 * - Full mode handles all events including multiplayer interactions
 * - Solo mode handles core events but optimizes for single-player flow
 *
 * @example
 * ```typescript
 * // Playing a card
 * { type: 'PLAY_CARD', cardId: 'card-123' }
 *
 * // Acknowledging card play
 * { type: 'PLAY_CARD_ACK', playedCardId: 'played-456' }
 *
 * // Player interruption
 * { type: 'INTERRUPT', player_id: 'player-789', card_id: 'interrupt-card-012' }
 *
 * // Card objection
 * { type: 'OBJECT', player_id: 'player-345', played_card_id: 'played-678' }
 * ```
 */
export type StorytellingEvent
  = | { type: 'PLAY_CARD', cardId: string }
    | { type: 'PLAY_CARD_ACK', playedCardId: string }
    | { type: 'PASS' }
    | { type: 'INTERRUPT', player_id: string, card_id: string }
    | { type: 'OBJECT', player_id: string, played_card_id: string }
    | { type: 'CONFIRM' }
    | { type: 'VALID' }
    | { type: 'INVALID' }

/**
 * Shared XState setup configuration for all storytelling machines.
 *
 * This setup provides consistent typing across all storytelling mode implementations
 * by establishing the common context and event types. It ensures type safety and
 * consistency when creating different storytelling machine variants.
 *
 * ## Purpose
 * - **Type Safety**: Ensures all storytelling machines use consistent types
 * - **Code Reuse**: Provides a single source of truth for storytelling types
 * - **Maintainability**: Changes to types automatically propagate to all machines
 * - **Developer Experience**: Enables IDE autocompletion and type checking
 *
 * ## Usage
 * All storytelling machines should use this setup as their base configuration:
 *
 * ```typescript
 * export const myStorytellingMachine = storytellingSetup.createMachine({
 *   id: 'myStorytelling',
 *   initial: 'narrating',
 *   context: {
 *     // Initialize context properties
 *   },
 *   states: {
 *     // Define machine states
 *   }
 * })
 * ```
 *
 * ## Type Integration
 * The setup automatically provides:
 * - Context typing for all state machine contexts
 * - Event typing for all state machine events
 * - Type checking for actions, guards, and services
 * - IDE support for autocompletion and error detection
 *
 * @see {@link StorytellingContext} for context interface details
 * @see {@link StorytellingEvent} for event type definitions
 */
export const storytellingSetup = setup({
  types: {
    context: {} as StorytellingContext,
    events: {} as StorytellingEvent,
  },
})
