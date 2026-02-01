# Implementation Plan: Local Image Editor Service

## Overview

This implementation creates local file system versions of the existing admin panel components, focusing on CardsEditor functionality. The approach involves copying and adapting DeckEditor and CardsEditor components while enhancing the existing ImageEditor to support both local and remote file operations.

## Tasks

- [x] 1. Set up environment configuration and API structure
  - Create environment variable `ENABLE_LOCAL_IMAGE_EDITOR` in `.env.local`
  - Set up API routes under `/api/image-editor/`
  - Create environment guard middleware for development-only access
  - _Requirements: 1.2, 1.3_

- [ ] 2. Implement file system handler and core utilities
  - [x] 2.1 Create file system handler for specs/decks/ operations
    - Implement path validation and security checks
    - Add functions for reading deck structure from file system
    - Include file serving capabilities for local images
    - _Requirements: 2.1, 2.5, 2.6, 5.5_
  
  - [ ]* 2.2 Write property test for file system path security
    - **Property 1: Environment-Controlled File System Access**
    - **Validates: Requirements 1.2, 1.3, 5.5, 8.5**
  
  - [x] 2.3 Implement local image serving API endpoints
    - Create `/api/image-editor/serve/` endpoint for local images
    - Add thumbnail generation endpoint
    - Include proper MIME type handling and caching headers
    - _Requirements: 4.5, 7.4_

- [ ] 3. Create local admin components by copying existing ones
  - [x] 3.1 Copy and adapt DeckEditor to LocalDeckEditor
    - Copy `components/admin/DeckEditor.tsx` to `components/local-admin/LocalDeckEditor.tsx`
    - Adapt to read from file system instead of database
    - Focus on cards view only, skip settings for now
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 3.2 Write property test for deck structure recognition
    - **Property 4: Deck Structure Recognition**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  
  - [x] 3.3 Copy and adapt CardsEditor to LocalCardsEditor
    - Copy `components/admin/CardsEditor.tsx` to `components/local-admin/LocalCardsEditor.tsx`
    - Adapt to work with local file paths instead of database IDs
    - Update image selection to use local file URLs
    - _Requirements: 4.4, 4.6_

- [ ] 4. Enhance existing ImageEditor component for local file support
  - [x] 4.1 Add new props to ImageEditor for local file operations
    - Add `isLocalFile`, `localPath`, `onLocalSave`, `enableLocalFeatures` props
    - Maintain backward compatibility with existing usage
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 4.2 Implement local file save functionality in ImageEditor
    - Add logic to detect local vs remote mode
    - Implement local file save using canvas blob data
    - Add "Save As" functionality for local files
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 4.3 Write property test for image editing tool correctness
    - **Property 5: Image Editing Tool Correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [ ]* 4.4 Write property test for undo/redo state management
    - **Property 6: Undo/Redo State Management**
    - **Validates: Requirements 3.6**

- [x] 5. Checkpoint - Ensure core functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement API endpoints for local file operations
  - [x] 6.1 Create deck management API endpoints
    - Implement `/api/image-editor/decks` to list local decks
    - Add `/api/image-editor/decks/:deckName` for deck details
    - Include `/api/image-editor/decks/:deckName/cards` for card listing
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [x] 6.2 Create image save and download API endpoints
    - Implement `/api/image-editor/save` for saving edited images
    - Add `/api/image-editor/save-as` for creating new files
    - Include `/api/image-editor/download/:path` for downloads
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 6.3 Write property test for file save operations integrity
    - **Property 7: File Save Operations Integrity**
    - **Validates: Requirements 2.5, 2.6, 5.1, 5.2**

- [ ] 7. Create the main image editor page
  - [x] 7.1 Create app/[lng]/image-editor/page.tsx
    - Set up the main page component with environment checks
    - Integrate LocalDeckEditor as the primary component
    - Add environment warning for non-development modes
    - _Requirements: 1.1, 1.4, 7.1, 7.2_
  
  - [x] 7.2 Wire LocalDeckEditor with LocalCardsEditor and enhanced ImageEditor
    - Connect component hierarchy: LocalDeckEditor → LocalCardsEditor → ImageEditor
    - Implement proper state management for selected deck/card/image
    - Add error handling and loading states
    - _Requirements: 4.2, 4.6_

- [ ] 8. Implement image quality and format handling
  - [x] 8.1 Add image format support and optimization
    - Implement PNG transparency preservation
    - Add JPEG quality settings and compression
    - Include file size optimization during save operations
    - _Requirements: 6.1, 6.2, 6.7, 6.8, 6.9_
  
  - [ ]* 8.2 Write property test for image quality and size optimization
    - **Property 8: Image Quality and Size Optimization**
    - **Validates: Requirements 5.4, 6.5, 6.7, 6.8, 6.9**
  
  - [ ]* 8.3 Write property test for image format support and preservation
    - **Property 3: Image Format Support and Preservation**
    - **Validates: Requirements 3.8, 6.1, 6.2, 6.3**

- [ ] 9. Add comprehensive error handling and validation
  - [x] 9.1 Implement error handling for file operations
    - Add descriptive error messages for file system failures
    - Include validation for corrupted or unsupported images
    - Implement graceful handling of network interruptions
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 9.2 Write property test for error handling and state preservation
    - **Property 9: Error Handling and State Preservation**
    - **Validates: Requirements 5.6, 8.1, 8.2, 8.3, 8.4**
  
  - [x] 9.3 Add security validation and logging
    - Implement path traversal attack prevention
    - Add comprehensive error logging for debugging
    - Include request validation and sanitization
    - _Requirements: 8.5, 8.6_

- [ ] 10. Final integration and testing
  - [x] 10.1 Test complete workflow from deck selection to image save
    - Verify deck browsing and card selection works
    - Test image editing tools with local files
    - Confirm save operations write to correct file paths
    - _Requirements: 4.1, 4.2, 4.4, 4.6_
  
  - [ ]* 10.2 Write property test for deck and card navigation consistency
    - **Property 10: Deck and Card Navigation Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.6**
  
  - [ ]* 10.3 Write property test for image loading and display
    - **Property 11: Image Loading and Display**
    - **Validates: Requirements 4.5, 7.4**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Focus on CardsEditor functionality, DeckSettings will be added later
- Environment controls ensure development-only access to local files
- Enhanced ImageEditor maintains backward compatibility with existing usage
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases