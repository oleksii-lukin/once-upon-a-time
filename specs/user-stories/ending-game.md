# User Story: Ending the Game

**Actors**: Player A (Storyteller)

**Preconditions**:
- Player A has 0 Story Cards left in hand.
- Player A has 1 Ending Card: "And they lived happily ever after."

**Scenario 1: Successful Win**
1. Player A concludes the story: "...and the prince and princess were married. **And they lived happily ever after.**"
2. Player A plays their Ending Card.
3. **System Action**:
    - Game state changes to "Finished".
    - Player A is declared the Winner.
    - Summary screen is shown.

**Scenario 2: Premature Ending Attempt**
1. Player A has 1 Story Card left.
2. Player A tries to play their Ending Card.
3. **System Validation**:
    - Action blocked.
    - Error message: "You must play all Story Cards before playing the Ending Card."
