# Rules Modification - Pacing Delay

## Overview
To improve the flow of digital storytelling, a **Pacing Delay** has been introduced. This addresses the issue of "card spamming" where a player might play cards faster than they can narrate, or faster than others can react with objections.

## Mechanics
- **Configuration**: The Game Host can enable or disable the pacing delay in the Lobby Settings.
- **Duration**: When enabled, the delay can be adjusted between **3 and 30 seconds** (defaulting to 5 seconds).
- **Effect**:
  - After a card is successfully played to the database, the game enters a `waiting` state.
  - During this state, the storyteller is encouraged to narrate the card's inclusion in the story.
  - Other players have a clear window to use the **Object / Disapprove** button.
  - If no objection is raised before the timer expires, the card is automatically confirmed.
  - If the delay is set to **Off**, the card transition is effectively instantaneous (0s delay).

## Mode Specifics
- **Full Mode**: Uses the configurable delay for its `pending` card state (replaces the hardcoded 5s).
- **Tutorial / Simple / Solo**: Now respect this delay configuration, providing a consistent experience across all rule variants.
