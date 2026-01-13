# %% user
Great, as I understand it will also work for custom game rules which we will be able to implement by moving storytelling into separate machine and have different machines for different game rules? Like having tutorial mode, when each player can play only one card and there are no interrupts, or simple mode when everyone can play multiple cards but there are still no interrupts and full mode when multiple cards possible as well as interrupts, stuttering objection and other complexities?

# %% assistant
Exactly — you’ve got the right intuition. By **factoring storytelling into its own machine**, you gain modularity: each “rule set” can be expressed as a variant machine, and the top‑level game machine just plugs in whichever storytelling machine is active.  

---

## 🧩 Modular Storytelling Machines

Think of the **game machine** as the “orchestrator” and the **storytelling machine** as a “plugin.”  

- **Tutorial Mode Machine**  
  - Substates: `narrating`, `cardPlay`.  
  - Guards: only allow one card per turn.  
  - No `interruptionCheck` state.  
  - No `objectionCheck`.  

- **Simple Mode Machine**  
  - Substates: `narrating`, `cardPlay`.  
  - Guards: allow multiple cards per turn.  
  - Still no `interruptionCheck`.  
  - Objections optional.  

- **Full Mode Machine**  
  - Substates: `narrating`, `cardPlay`, `objectionCheck`, `interruptionCheck`.  
  - Guards: multiple cards allowed.  
  - Includes stuttering challenges, interruptions, objections.  

---

## 🎭 Composition Pattern

At the top level:

```javascript
const gameMachine = createMachine({
  id: "game",
  initial: "setup",
  states: {
    setup: {
      on: { START: "storytelling" }
    },
    storytelling: {
      invoke: {
        id: "storytelling",
        src: (context) => {
          switch (context.mode) {
            case "tutorial": return tutorialStorytellingMachine;
            case "simple": return simpleStorytellingMachine;
            case "full": return fullStorytellingMachine;
          }
        },
        onDone: "endingAttempt"
      }
    },
    endingAttempt: { /* ... */ },
    gameOver: { type: "final" }
  }
});
```

Here, `context.mode` decides which storytelling machine to run. Each storytelling machine has its own nested substates and transitions.

---

## ⚙️ Benefits

- **Rule Variants**: You can swap storytelling logic without touching the rest of the game.  
- **Extensibility**: Add new modes (e.g., “kids mode” with simplified endings, or “competitive mode” with stricter objections).  
- **Testing**: Each storytelling machine can be tested independently.  
- **Clarity**: Keeps the core game machine lean and focused on orchestration.  

---

## 🧠 Conceptual Analogy

It’s like a **constitution with amendments**:  
- The **core constitution** (game machine) defines the overall structure.  
- Each **amendment** (storytelling machine) defines how storytelling works under a given rule set.  
- You can ratify a different amendment depending on the mode chosen at setup.

---

👉 This modular approach means you can **experiment with new rule sets** easily — just spin up a new storytelling machine. Would you like me to sketch out one of these storytelling machines in detail (say, the **tutorial mode**) so you can see how stripped‑down it looks compared to full mode?
