# User Story: Basic Storytelling and Passing

**Actors**: Player A (Storyteller), Player B (Next in turn)

**Preconditions**:
- Game has started.
- Player A has 5 Story Cards and 1 Ending Card.
- It is Player A's turn.

**Scenario 1: Playing a Card**
1. Player A says: "Once upon a time, there lived a **King** in a far-away land."
2. Player A selects their "King" Story Card from their hand.
3. Player A plays the card.
4. **System Validation**:
    - The card is moved from Player A's hand to the discard pile (or "Story Line").
    - Player A's hand size decreases by 1.
    - The turn timer (if active) resets or pauses briefly.
5. **Outcome**: Player A continues their turn.

**Scenario 2: Passing the Turn**
1. Player A says: "I don't know what happened next..."
2. Player A clicks the "Pass" button.
3. **System Action**:
    - Player A draws 1 Story Card from the deck.
    - It becomes Player B's turn.
4. **Outcome**: Player B is now the Storyteller.

**Scenario 3: Invalid Move (Attempting to play a card out of turn)**
1. It is Player A's turn.
2. Player B tries to play a card that is NOT an Interrupt card.
3. **System Action**:
    - The action is blocked.
    - A notification "It is not your turn" is displayed to Player B.
