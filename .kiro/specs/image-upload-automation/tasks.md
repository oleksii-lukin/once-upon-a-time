# Implementation Plan: Image Upload Automation

## Overview

This implementation plan creates a dedicated image upload script that handles all image processing operations, with the existing seed generator calling this script to obtain image URLs for database insertion. The approach separates concerns while maintaining simple integration.

**Current State Analysis:**
- ✅ Database schema already has image fields (cards.image_url, decks.bg_image_url, decks.card_back_image_url, decks.category_images, decks.card_layout)
- ✅ UploadThing is configured with 4MB image limit
- ✅ generate_seed.py exists but has no image upload functionality
- ❌ No upload_images.py script exists
- ❌ No image files in card folders (only markdown files)
- ❌ Only one sample image: specs/decks/default/cards/Border.jpg

## Tasks

- [x] 1. Create upload_images.py script foundation
  - [x] 1.1 Create upload_images.py with command-line interface
    - Set up argument parsing for deck, category, card filtering
    - Add dry-run mode and JSON output options
    - Configure logging with different levels
    - _Requirements: 2.1, 7.1, 7.2, 10.1, 10.2, 10.4_
  
  - [x] 1.2 Set up environment variable handling
    - Read UPLOADTHING_SECRET and UPLOADTHING_APP_ID from environment
    - Provide clear error messages for missing credentials
    - _Requirements: 7.1, 7.2_

- [x] 2. Implement image discovery system
  - [x] 2.1 Create ImageDiscoveryService class
    - Scan specs/decks/{deck_name}/cards/ directory structure
    - Detect deck-level images (Border.jpg, GameBoard.jpg, category images)
    - Find card images in individual card folders
    - Support filtering by deck, category, and card name
    - _Requirements: 1.1, 3.1, 3.2, 4.1, 10.2_
  
  - [x] 2.2 Handle position.json layout files
    - Parse position.json files for deck layout configuration
    - Store layout data for deck.card_layout field
    - Handle missing files gracefully
    - _Requirements: 3.4, 3.5_
  
  - [ ]* 2.3 Write property test for image file detection
    - **Property 1: Image File Detection**
    - **Validates: Requirements 1.1**

- [x] 3. Implement UploadThing API client
  - [x] 3.1 Create UploadThingClient class
    - Use existing UploadThing configuration (4MB limit, image types)
    - Implement file upload with proper authentication
    - Add retry logic with exponential backoff for rate limits
    - Store original filenames in metadata for traceability
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 3.2 Add file validation
    - Validate file size (4MB max) and type (jpg, jpeg, png, webp)
    - Implement image compression for files > 2MB
    - _Requirements: 2.2, 11.3_
  
  - [ ]* 3.3 Write property tests for upload functionality
    - **Property 4: File Size and Type Validation**
    - **Property 5: Filename Preservation**
    - **Validates: Requirements 2.2, 2.5**

- [x] 4. Implement caching system
  - [x] 4.1 Create ImageCacheManager class
    - Implement persistent cache file (image_cache.json) with MD5 hashing
    - Cache validation and URL verification (check for 404s)
    - Cache management commands (clear, validate, list)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 4.2 Write property tests for caching
    - **Property 10: Cache Round-Trip Consistency**
    - **Property 11: Cache Invalidation**
    - **Validates: Requirements 9.2, 9.4**

- [x] 5. Implement core ImageUploader with batch processing
  - [x] 5.1 Create ImageUploader class
    - Concurrent uploads with configurable limits (max 5)
    - Progress reporting with ETA estimates
    - Comprehensive error handling for network/API failures
    - Graceful continuation when individual uploads fail
    - _Requirements: 11.1, 11.2, 6.1, 6.2, 6.3, 6.4, 1.4_
  
  - [ ]* 5.2 Write property tests for upload resilience
    - **Property 2: Upload Success URL Storage**
    - **Property 3: Error Resilience**
    - **Validates: Requirements 1.3, 1.4, 4.3, 6.1, 6.2, 6.3**

- [x] 6. Implement output formatting and CLI features
  - [x] 6.1 Add JSON output for seed generator integration
    - Format: {"deck_images": {...}, "card_images": {...}}
    - Include deck-level images (bg_image_url, card_back_image_url, category_images)
    - Include card-level image URLs mapped by card name
    - _Requirements: 12.2, 12.4_
  
  - [x] 6.2 Add human-readable progress reporting
    - Different verbosity levels
    - Summary statistics (total images, successes, failures)
    - _Requirements: 12.1, 12.4_
  
  - [ ]* 6.3 Write property test for batch filtering
    - **Property 12: Batch Processing Filtering**
    - **Validates: Requirements 10.2, 10.3**

- [x] 7. Enhance generate_seed.py integration
  - [x] 7.1 Add upload_images.py subprocess call
    - Call upload_images.py before SQL generation
    - Parse JSON output to get image URLs
    - Handle upload failures gracefully (continue without images)
    - _Requirements: 10.5_
  
  - [x] 7.2 Modify generate_card_inserts function
    - Add image_url parameter and include in SQL INSERT
    - Map card names to image URLs from upload_images.py output
    - Set image_url to NULL for cards without images
    - Maintain deterministic UUID generation
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  
  - [x] 7.3 Create generate_deck_insert function
    - Generate deck INSERT with image URLs (bg_image_url, card_back_image_url)
    - Include category_images JSONB and card_layout JSONB
    - Use image URLs from upload_images.py output
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 7.4 Write property tests for integration
    - **Property 8: Card Image Association**
    - **Property 9: UUID Determinism**
    - **Property 13: Seed Generator Integration**
    - **Validates: Requirements 4.1, 4.2, 4.5, 10.5**

- [x] 8. Add internationalization support (optional)
  - [x] 8.1 Implement locale-specific image handling
    - Support locale-specific images (card_en.jpg, card_ru.jpg)
    - Fall back to generic images when locale-specific ones are missing
    - Store locale-specific URLs in translations JSONB structure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 8.2 Write unit tests for internationalization
    - Test locale-specific image detection and fallback logic
    - Test translations JSONB structure generation
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Add performance optimizations
  - [x] 9.1 Implement resumable operations
    - Support interrupted batch processing
    - Image validation before upload attempts
    - Concurrent processing with proper resource management
    - _Requirements: 11.4, 11.5_
  
  - [ ]* 9.2 Write integration tests
    - Test complete seed generation with image uploads
    - Test performance with large image batches
    - _Requirements: 11.1, 11.2_

- [x] 10. Final configuration and error handling
  - [x] 10.1 Add comprehensive configuration
    - Support configurable retry attempts and timeout values
    - Support configurable image file extensions
    - User-friendly error messages and setup instructions
    - _Requirements: 7.3, 7.4, 7.5, 12.1, 12.3_
  
  - [ ]* 10.2 Write final integration tests
    - Test complete workflow from image discovery to SQL generation
    - Test error recovery and graceful degradation
    - Test configuration and environment variable handling
    - _Requirements: 7.1, 7.2, 7.3_

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Database schema fields already exist and match the design requirements
- The implementation maintains backward compatibility with existing seed generation workflow
- Focus on creating a working MVP first, then adding optimizations and comprehensive testing