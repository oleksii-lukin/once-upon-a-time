import { tutorialStorytellingMachine } from './actors/modes/tutorialStorytelling'
import { simpleStorytellingMachine } from './actors/modes/simpleStorytelling'
import { fullStorytellingMachine } from './actors/modes/fullStorytelling'
import { soloStorytellingMachine } from './actors/modes/soloStorytelling'

// 1. Tutorial Mode: 1 card, no interrupts/objections
export { tutorialStorytellingMachine }

// 2. Simple Mode: Multiple cards, no interrupts
export { simpleStorytellingMachine }

// 3. Full Mode: Full rules
export { fullStorytellingMachine }

// 4. Solo Mode: Multiple cards, no interrupts, optimized for single player
export { soloStorytellingMachine }
