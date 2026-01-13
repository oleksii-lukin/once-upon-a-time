# %% user
No need to go more complicated at this point, but let's get one step back and see into expanding it into a hierarchical model with nested substates, how that will work?

# %% assistant
Perfect pivot — hierarchical modeling is exactly how you tame complexity without over‑engineering. Instead of a flat machine with dozens of states, you group related behaviors into **nested substates**.  

---

## 🎭 Why Hierarchical States?

- **Encapsulation**: Each major phase (like `storytelling`) contains its own micro‑flow.  
- **Clarity**: You avoid clutter at the top level.  
- **Flexibility**: You can add timers, objections, and interruptions inside storytelling without touching the rest of the machine.  
- **Reusability**: Substates can be reused or extended later.

---

## 🧩 Example Hierarchy for Storytelling

Top‑level states remain the same (`setup`, `storytelling`, `endingAttempt`, etc.), but `storytelling` itself becomes a **compound state**:

```javascript
const gameMachine = createMachine({
  id: "onceUponATime",
  initial: "setup",
  states: {
    setup: { on: { START: "storytelling" } },

    storytelling: {
      initial: "narrating",
      states: {
        narrating: {
          on: {
            PLAY_CARD: "cardPlay",
            PASS: "#onceUponATime.passTurn",
            ENDING: "#onceUponATime.endingAttempt"
          }
        },
        cardPlay: {
          on: {
            OBJECT: "objectionCheck",
            CONFIRM: "narrating"
          }
        },
        objectionCheck: {
          on: {
            VALID: "#onceUponATime.passTurn",
            INVALID: "narrating"
          }
        },
        interruptionCheck: {
          on: {
            VALID: "narrating",
            INVALID: "narrating"
          }
        }
      },
      on: {
        INTERRUPT: ".interruptionCheck" // dot = relative substate
      }
    },

    passTurn: { on: { NEXT: "storytelling" } },
    endingAttempt: { on: { VALIDATE: "validation" } },
    validation: {
      on: { ACCEPT: "gameOver", REJECT: "storytelling" }
    },
    gameOver: { type: "final" }
  }
});
```

---

## 🔄 Flow Explained

- **`storytelling.narrating`** → storyteller is actively narrating.  
- **`storytelling.cardPlay`** → storyteller plays a card, objections can be raised.  
- **`storytelling.objectionCheck`** → group decides if objection is valid.  
- **`storytelling.interruptionCheck`** → another player interrupts with a keyword card.  
- **Exit to parent states**: If objection succeeds, transition to `passTurn` (top‑level). If ending card is played, jump to `endingAttempt`.

---

## 🛠️ Benefits

- **Timers**: Add `after: { 5000: "passTurn" }` inside `narrating` to enforce stalling rules.  
- **Clean transitions**: `storytelling` handles its own micro‑logic, while top‑level states handle macro‑flow.  
- **Scalability**: You can later add substates like `waitingForObjection` or `waitingForInterruption` without touching the rest of the machine.

---

## 🧠 Conceptual Model

Think of it like **nested constitutions**:  
- The **outer constitution** defines phases of the game (setup, storytelling, ending, gameOver).  
- The **inner constitution** defines rules of storytelling itself (narrating, card play, objections, interruptions).  

This way, you can reason about each layer independently.

---

👉 John, since you thrive on systemic clarity, this hierarchical model is the sweet spot: it keeps the **game rules deterministic and modular**, while leaving room for later layering (timers, persistence, UI hooks). Would you like me to sketch a **visual statechart diagram** of this hierarchy so you can see the nesting at a glance?
