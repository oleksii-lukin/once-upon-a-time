# Once Upon A Time - Game Rules

## 1. Objective
The goal of the game is to tell a story using the elements on your **Story Cards** and guide the plot toward your **Ending Card**. The first player to use all their Story Cards and successfully play their Ending Card wins the game.

## 2. Components
- **Story Cards**: These represent characters, places, objects, or attributes (e.g., "The King", "A Dark Forest", "Magic Sword", "Hidden").
- **Ending Cards**: These describe the conclusion of a fairy tale (e.g., "So they got married and lived happily ever after").

## 3. Setup
- The deck of Story Cards and Ending Cards are shuffled separately.
- Each player is dealt a hand of **Story Cards** (number depends on player count, typically 5-10).
- Each player is dealt **one Ending Card**.
- Randomly determine the starting **Storyteller**.

## 4. Gameplay Logic

### The Storyteller's Turn
The current player (Storyteller) begins or continues a story.
- **Playing Cards**: When the Storyteller mentions an element in their story that corresponds to a card in their hand, they may place that card on the table. **Card play is not instantaneous.** There is a brief window where other players can object if the card doesn't fit the story or if the Storyteller "stuttered" while playing it.
- **Drawing Cards**: If the Storyteller cannot continue the story, they must say "Pass". They draw one Story Card and their turn ends. Use is passed to the next player to the left.
- **Continuity & Stuttering**: The story must make sense. If the Storyteller hesitates for too long, repeats themselves (stutters), or rambles just to play cards, they may be challenged.

### Objections and Challenges
Other players can object to the current storyteller's actions:
1.  **Object to Card**: When a card is played, any player can click "Object/Disapprove". If the group agrees (or if the challenge is valid), the card is returned to the Storyteller's hand, they draw a penalty card from the deck, and their turn ends.
2.  **Challenge Stutter**: If the Storyteller is stuck or stuttering without playing a card, they can be challenged. A successful challenge ends their turn and makes them draw a penalty card.
3.  **Interruption**: A player can interrupt the Storyteller at any time by playing a card that matches a keyword the Storyteller just mentioned. This is a valid way to take control of the story.

### Passing the Turn
If the Storyteller passes, is interrupted correctly, or is successfully challenged:
- The player who interrupted/challenged becomes the new Storyteller (in some variations) or it passes to the next player.
- The previous Storyteller draws a penalty card (unless they passed voluntarily).

## 5. Winning the Game
- A player must first play all of their **Story Cards**.
- Once their hand is empty of Story Cards, they must steer the story to a logical conclusion that matches their **Ending Card**.
- **The game only finishes once the Ending Card is played AND the turn is finalized without objections.**
- If the ending doesn't make sense or is challenged by others, the Ending Card returns to the hand, they draw a new Ending Card and a Story Card, and play passes.

## 6. Digital Adaptation Specifics

### Enforcement table (actual behavior)

| Setting / mode | Enforced? | Behavior |
|---|---|---|
| `gameMode` main / fast / tutorial / solo | Yes | Via `MODE_CONFIG`: tutorial = 1 card/turn, no interrupt/objection; fast/solo = unlimited, no interrupt/objection; main = full |
| `enablePacingDelay` (3–30s) | Yes | Card stays `PENDING` for the window; objections possible inside it; off = instant confirm |
| `timerPerTurn` (10–120s) | Yes | Auto-pass on expiry (unit-tested); disabled at 0 |
| `allowInterrupts` | **No (dead flag)** | Interrupt gating comes from `MODE_CONFIG`, not this flag |
| `allowHotJoin` | **No (dead flag)** | Mid-game joiners are undefined behavior (see `spectating-and-joining.md`) |
| `publicGame`, `happyEnding` | **No (dead flags)** | UI toggles only |
| `allowSpectators` | Partially | Lobby list only; the game board always renders for visitors |

### Deck and draw semantics

- Draw pile: story cards not dealt to hands (5 per player at start). **No reshuffle** of played cards.
- Empty pile: a pass still passes the turn (draw 0); penalty/challenge draws are skipped; an exchange fails without consuming the turn (`deck-exhaustion.md`).
- Keyword matching for interruptions is not enforced — an interrupt is auto-validated (no STT yet).
