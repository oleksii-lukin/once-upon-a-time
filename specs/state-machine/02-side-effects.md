# %% user
What about side-effects or some utility functions? If I'm using supabase as a primary source of state, which has possibility for failure and sync-up time, how we can inject those problems into our state machine?

# %% assistant
Great question — this is where **XState really shines** because it treats side‑effects (like talking to Supabase) as **services** or **actions** that can succeed, fail, or timeout, and those outcomes become part of the machine’s transitions. Let’s break it down.

---

## ⚡ Side‑Effects in XState

In XState, side‑effects are modeled as:

- **Actions** → fire‑and‑forget (e.g., log, update local cache).
- **Services (invocations)** → async tasks that can succeed or fail (e.g., Supabase query).
- **Guards** → pure functions that decide if a transition is allowed.

For Supabase, you’ll mostly use **services**.

---

## 🏗️ Example: Supabase Integration

Suppose you want to **sync the storyteller’s turn** with Supabase:

```javascript
import { createMachine, assign } from "xstate";
import { supabase } from "./supabaseClient";

const gameMachine = createMachine({
  id: "onceUponATime",
  initial: "setup",
  context: {
    error: null,
    gameState: null
  },
  states: {
    setup: {
      invoke: {
        id: "loadGame",
        src: async () => {
          const { data, error } = await supabase.from("games").select("*").single();
          if (error) throw error;
          return data;
        },
        onDone: {
          target: "storytelling",
          actions: assign({ gameState: (_, event) => event.data })
        },
        onError: {
          target: "error",
          actions: assign({ error: (_, event) => event.data })
        }
      }
    },
    storytelling: {
      on: {
        SAVE_TURN: "syncing"
      }
    },
    syncing: {
      invoke: {
        id: "saveTurn",
        src: async (context, event) => {
          const { error } = await supabase
            .from("turns")
            .insert({ ...event.turn });
          if (error) throw error;
        },
        onDone: "storytelling",
        onError: {
          target: "error",
          actions: assign({ error: (_, event) => event.data })
        }
      }
    },
    error: {
      on: {
        RETRY: "setup"
      }
    }
  }
});
```

---

## 🧩 Utility Functions

You’ll want small helpers for:

- **Supabase wrappers**:  
  ```js
  async function fetchGame(id) { ... }
  async function saveTurn(turn) { ... }
  ```
  Keep them pure and return `{data, error}` so the machine can branch.

- **Guards**:  
  - `canPlayEndingCard(context)` → check if hand is empty.  
  - `isValidInterruption(context, event)` → keyword match.

- **Actions**:  
  - `assignPenaltyCard` → update context.  
  - `logError` → console or telemetry.

---

## 🕰️ Handling Sync‑Up Time

Supabase calls aren’t instant, so model them explicitly:

- **Loading state** → `setup` invokes `loadGame`.  
- **Saving state** → `syncing` invokes `saveTurn`.  
- **Error state** → `error` with retry transitions.  
- **Timeouts** → add a `timeout` event if Supabase is slow.

```js
syncing: {
  invoke: {
    src: "saveTurn",
    onDone: "storytelling",
    onError: "error"
  },
  after: {
    5000: { target: "error", actions: assign({ error: () => "Timeout" }) }
  }
}
```

---

## 🧠 Conceptual Model

Think of it like this:

- **Game rules** → deterministic state machine.  
- **Supabase sync** → nondeterministic side‑effects (success/failure/timeout).  
- **Machine context** → holds local truth, reconciled with Supabase when possible.  

That way, your game logic is **never blocked** by Supabase; it just reacts to whether persistence succeeded or failed.

---

👉 John, since you’re a systems architect, you might prefer a **dual‑layer model**:  
- **Core machine** (pure rules, always deterministic).  
- **Persistence machine** (handles Supabase sync, retries, exponential backoff).  

Then compose them. Would you like me to sketch that **two‑machine orchestration pattern** so you can keep game logic pure and isolate Supabase concerns?
