# User Story: Interruptions

**Actors**: Player A (Storyteller), Player B (Interactor)

**Preconditions**:
- Player A is telling a story.
- Player A mentions a keyword (e.g., "Forest").
- Player B has a "Forest" card in hand.

**Scenario 1: Successful Interruption**
1. Player A says: "The hero walked into the dark **Forest**."
2. Player B quickly selects their "Forest" card and clicks "Interrupt".
3. **System Validation**:
    - The system pauses Player A's turn.
    - The system verifies Player B played "Forest".
    - (Optional) Group vote or timed challenge window? *For now, assume auto-success if keyword matches.*
4. **Outcome**:
    - Player A draws 1 Story Card as a penalty.
    - Player B's card is played to the Story Line.
    - Player B becomes the new Storyteller.

**Scenario 2: Incorrect Interruption (Challenge)**
1. Player A says something unrelated to "Forest".
2. Player B plays "Forest" claiming an interruption.
3. **Outcome (Manual/Vote based)**:
    - Players vote "Invalid Interruption".
    - Player B takes back their card.
    - Player B draws 1 Story Card penalty.
    - Player A continues as Storyteller.
