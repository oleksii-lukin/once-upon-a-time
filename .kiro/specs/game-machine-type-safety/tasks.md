# Implementation Plan: Game Machine Type Safety

## Overview

This implementation plan converts the XState game machine from inline actor typing to a modular, type-safe architecture following XState v5's actor-first design. The plan focuses on creating proper TypeScript interfaces, organizing actors into separate files, and ensuring compile-time type safety.

## Tasks

- [x] 1. Create type definitions and directory structure
  - Create `game/types.ts` with all actor input interfaces
  - Create `game/actors/` directory structure
  - Create `game/actors/modes/` subdirectory for storytelling actors
  - _Requirements: 1.1, 1.3, 5.1_

- [ ]* 1.1 Write property test for actor interface completeness
  - **Property 1: Actor Interface Completeness**
  - **Validates: Requirements 1.1, 1.4**

- [ ] 2. Extract and modularize database actors
  - [x] 2.1 Extract playCardActor to separate file
    - Create `game/actors/playCardActor.ts` with proper typing
    - Import and use `PlayCardActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 2.2 Extract drawCardsActor to separate file
    - Create `game/actors/drawCardsActor.ts` with proper typing
    - Import and use `DrawCardsActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 2.3 Extract passTurnActor to separate file
    - Create `game/actors/passTurnActor.ts` with proper typing
    - Import and use `PassTurnActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 2.4 Extract confirmCardActor to separate file
    - Create `game/actors/confirmCardActor.ts` with proper typing
    - Import and use `ConfirmCardActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 2.5 Extract finalizeWinActor to separate file
    - Create `game/actors/finalizeWinActor.ts` with proper typing
    - Import and use `FinalizeWinActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 2.6 Extract objectActor to separate file
    - Create `game/actors/objectActor.ts` with proper typing
    - Import and use `ObjectActorInput` interface
    - _Requirements: 1.2, 2.1, 5.1_

- [ ]* 2.7 Write property test for type-safe actor invocations
  - **Property 2: Type-Safe Actor Invocations**
  - **Validates: Requirements 1.2, 2.1, 2.5**

- [ ]* 2.8 Write property test for database schema compatibility
  - **Property 3: Database Schema Compatibility**
  - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 3. Extract and modularize storytelling mode actors
  - [x] 3.1 Create shared storytelling types
    - Create `game/actors/modes/index.ts` with shared types
    - Define `StorytellingEvent` and `StorytellingContext` interfaces
    - _Requirements: 1.1, 5.1, 6.2_
  
  - [x] 3.2 Extract tutorialStorytellingMachine
    - Create `game/actors/modes/tutorialStorytelling.ts`
    - Import shared types from modes/index.ts
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 3.3 Extract simpleStorytellingMachine
    - Create `game/actors/modes/simpleStorytelling.ts`
    - Import shared types from modes/index.ts
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 3.4 Extract fullStorytellingMachine
    - Create `game/actors/modes/fullStorytelling.ts`
    - Import shared types from modes/index.ts
    - _Requirements: 1.2, 2.1, 5.1_
  
  - [x] 3.5 Extract soloStorytellingMachine
    - Create `game/actors/modes/soloStorytelling.ts`
    - Import shared types from modes/index.ts
    - _Requirements: 1.2, 2.1, 5.1_

- [ ]* 3.6 Write property test for actor behavior preservation
  - **Property 5: Actor Behavior Preservation**
  - **Validates: Requirements 2.4**

- [ ] 4. Update main game machine with modular imports
  - [x] 4.1 Update gameMachine.ts imports
    - Import all actors from their new modular locations
    - Import types from `game/types.ts`
    - Remove inline actor definitions
    - _Requirements: 2.1, 2.5, 5.5_
  
  - [x] 4.2 Update actor invocations with proper typing
    - Add explicit return type annotations for actor input functions
    - Ensure all actor invocations use typed interfaces
    - _Requirements: 2.1, 2.2, 6.1_

- [ ]* 4.3 Write property test for compilation success
  - **Property 4: Compilation Success**
  - **Validates: Requirements 2.2, 6.5, 7.4**

- [ ] 5. Add input validation and error handling
  - [x] 5.1 Add validation functions for actor inputs
    - Create validation functions for each actor input type
    - Implement descriptive error messages for invalid inputs
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 5.2 Update actors to use input validation
    - Add validation calls at the beginning of each actor
    - Ensure proper error handling for validation failures
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ]* 5.3 Write property test for input validation consistency
  - **Property 6: Input Validation Consistency**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 6. Add comprehensive documentation
  - [x] 6.1 Add JSDoc documentation to all interfaces
    - Document each interface property with purpose and constraints
    - Include examples and validation requirements
    - _Requirements: 5.3, 7.2, 7.3_
  
  - [x] 6.2 Add JSDoc documentation to all actors
    - Document actor purpose, inputs, outputs, and error conditions
    - Include usage examples and integration notes
    - _Requirements: 5.3, 7.1_

- [ ]* 6.3 Write property test for interface documentation completeness
  - **Property 8: Interface Documentation Completeness**
  - **Validates: Requirements 5.3**

- [ ] 7. Final integration and testing
  - [x] 7.1 Update all actor references throughout the codebase
    - Ensure all imports point to new modular actor locations
    - Update any remaining inline type references
    - _Requirements: 2.5, 5.5, 6.1_
  
  - [x] 7.2 Verify type system integration
    - Ensure compatibility between actor types and game context
    - Verify proper type flow from events to actors to context updates
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 7.3 Write property test for type system integration
  - **Property 7: Type System Integration**
  - **Validates: Requirements 6.1, 6.2, 6.4**

- [ ]* 7.4 Write property test for modular actor organization
  - **Property 9: Modular Actor Organization**
  - **Validates: Requirements 1.3, 5.1**

- [x] 8. Checkpoint - Ensure all tests pass and compilation succeeds
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compilation without errors
  - Confirm all actors maintain existing functionality

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The modular structure follows XState v5 actor-first design principles
- All type safety improvements maintain backward compatibility