# %% user
How would we connect our UI layer in React to that modular machine? With simple if check, or we could use some more complex patterns like Factory? Or would that be overcomplication at this point?

# %% assistant
You’re thinking along exactly the right axis: how much abstraction do we really need between the **UI layer** and the **state machine orchestration**. Let’s unpack the options.

---

## 🔗 Connecting React UI to XState Machines

### 1. **Simplest Approach: Conditional Check**
- At setup, you decide which storytelling machine to run based on `mode`.
- In React, you can just do:

```jsx
import { useMachine } from "@xstate/react";
import { tutorialStorytellingMachine, simpleStorytellingMachine, fullStorytellingMachine } from "./machines";

function Game({ mode }) {
  const machine =
    mode === "tutorial"
      ? tutorialStorytellingMachine
      : mode === "simple"
      ? simpleStorytellingMachine
      : fullStorytellingMachine;

  const [state, send] = useMachine(machine);

  return (
    <div>
      {state.matches("storytelling.narrating") && <NarrationUI send={send} />}
      {state.matches("storytelling.cardPlay") && <CardPlayUI send={send} />}
      {/* etc */}
    </div>
  );
}
```

✅ Pros: straightforward, easy to reason about.  
❌ Cons: logic for choosing machine is inline, not reusable.

---

### 2. **Factory Pattern**
- Encapsulate machine selection in a factory function:

```js
function storytellingFactory(mode) {
  switch (mode) {
    case "tutorial": return tutorialStorytellingMachine;
    case "simple": return simpleStorytellingMachine;
    case "full": return fullStorytellingMachine;
    default: throw new Error("Unknown mode");
  }
}
```

Then in React:

```jsx
const [state, send] = useMachine(storytellingFactory(mode));
```

✅ Pros: cleaner separation, easier to extend (new modes).  
❌ Cons: adds indirection, but not much benefit unless you expect many variants.

---

### 3. **Over‑Engineering Risk**
- If you only have 2–3 modes, a simple `if`/`switch` is fine.  
- Factory makes sense if:
  - You expect **many rule sets** (kids mode, competitive mode, etc.).  
  - You want to **inject dependencies** (e.g., Supabase persistence, analytics).  
  - You want to **unit test machine selection** separately.

---

## 🎭 UI Rendering Patterns

Regardless of how you select the machine, the **UI layer** usually connects via:

- `state.matches("storytelling.narrating")` → show narration controls.  
- `state.matches("storytelling.cardPlay")` → show card play UI.  
- `state.context` → render player hands, storyteller, etc.  
- `send("PLAY_CARD", { card })` → dispatch events from UI.

This keeps UI declarative: **render based on state, dispatch events to machine**.

---

## 🧠 Recommendation

At this stage:
- Stick with **simple conditional selection** (`if`/`switch`).  
- Keep machines modular so swapping them is trivial.  
- Introduce a **factory** only if you foresee >3–4 variants or need dependency injection.

---

👉 John, given your systems‑architecture mindset, you might enjoy starting simple but leaving the door open: design your machines modularly, and if you later want to add a factory or even a **registry of rule sets**, you won’t have to refactor the UI.  

Would you like me to sketch a **UI component tree** that maps cleanly to the hierarchical states (so you can see how `NarrationUI`, `ObjectionUI`, etc. plug into `state.matches`)?
