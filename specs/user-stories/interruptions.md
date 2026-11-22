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
    - **Auto-validated**: keyword matching needs speech-to-text, which does not exist yet — an interrupt succeeds immediately. The machine keeps a VALID/INVALID arbitration as the extension point for a future group vote.
    - Only in modes with interrupts (`full`/`main`); other modes hide the button and ignore the event.
4. **Outcome**:
    - Player A draws 1 Story Card as a penalty (best-effort — a failed draw does not block the turn pass).
    - Player B becomes the new Storyteller.
    - **Known gap (backlog)**: the classic rule plays Player B's matching card to the Story Line as part of the interruption; the machine currently only transfers the turn — Player B keeps the card in hand.

**Scenario 2: Incorrect Interruption (Challenge)**
1. Player A says something unrelated to "Forest".
2. Player B plays "Forest" claiming an interruption.
3. **Outcome (Manual/Vote based)**:
    - Players vote "Invalid Interruption".
    - Player B takes back their card.
    - Player B draws 1 Story Card penalty.
    - Player A continues as Storyteller.
