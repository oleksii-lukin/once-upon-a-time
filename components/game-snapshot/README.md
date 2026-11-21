# Game Machine Snapshot

This is a minimal snapshot of the game machine architecture for testing and experimentation purposes.

## Structure

This snapshot includes one example of each feature type:

- **1 Actor**: `playCardActor` - handles playing a card
- **1 Guard**: `canPlayCard` - checks if a card can be played
- **1 Action**: `assignNextPlayer` - assigns the next player
- **Minimal Context**: Only essential state (2-3 parameters)
- **Minimal Events**: Only the core events needed
- **Simple State Machine**: Basic idle -> active flow

## Purpose

Use this for:
- Understanding the architecture
- Testing new patterns
- Experimenting with changes
- Learning the state machine structure

## Files

```
game-snapshot/
├── gameMachine.ts          # Main state machine
├── gameTypes.ts            # Type definitions
├── actors/
│   └── playCardActor.ts    # Example actor
├── guards/
│   └── playGuards.ts       # Example guard
├── actions/
│   └── playerActions.ts    # Example action
└── README.md               # This file
```
