# Requirements Document

## Introduction

This feature extends the existing Python seed generation script (`scripts/generate_seed.py`) to automatically upload images to UploadThing service and include the URLs in the generated SQL seed files. The system will handle both deck-level images (borders, backgrounds, category images) and individual card images, integrating seamlessly with the current folder-based card organization structure.

## Glossary

- **Seed_Generator**: The Python script that generates SQL seed files for card decks
- **UploadThing_Service**: The cloud image hosting service used by the application
- **Card_Folder**: Directory containing card data files (en.md, ru.md, ua.md, prompt.md) and images
- **Deck_Folder**: Directory containing all cards and deck-level assets for a specific deck
- **Image_Asset**: Any image file (JPG, PNG, WebP) that needs to be uploaded and referenced in the database
- **Layout_Configuration**: JSON file containing positioning and layout settings for deck elements
- **SQL_Seed**: Generated SQL file that populates the database with deck and card data

## Requirements

### Requirement 1: Automated Image Detection and Upload

**User Story:** As a developer, I want the seed generation script to automatically detect and upload images, so that I don't have to manually manage image URLs.

#### Acceptance Criteria

1. WHEN the Seed_Generator runs, THE system SHALL scan all Card_Folders for image files with extensions .jpg, .jpeg, .png, .webp
2. WHEN the Seed_Generator finds deck-level images, THE system SHALL upload them to UploadThing_Service with appropriate naming conventions
3. WHEN image upload succeeds, THE system SHALL store the returned URL for database insertion
4. WHEN image upload fails, THE system SHALL log the error and continue processing other images
5. WHEN no images are found in a Card_Folder, THE system SHALL continue processing without errors

### Requirement 2: UploadThing API Integration

**User Story:** As a system administrator, I want the Python script to integrate with UploadThing API, so that images are uploaded to the same service used by the web application.

#### Acceptance Criteria

1. THE Seed_Generator SHALL authenticate with UploadThing_Service using API credentials
2. WHEN uploading images, THE system SHALL use the same file size and type restrictions as the web application (4MB max, image types only)
3. WHEN API rate limits are encountered, THE system SHALL implement exponential backoff retry logic
4. WHEN API credentials are invalid, THE system SHALL fail gracefully with clear error messages
5. THE system SHALL preserve original filenames in UploadThing metadata for traceability

### Requirement 3: Deck-Level Image Management

**User Story:** As a content creator, I want to manage deck-level images like borders and backgrounds, so that each deck can have its unique visual identity.

#### Acceptance Criteria

1. WHEN Border.jpg exists in the Deck_Folder, THE system SHALL upload it and store the URL in the deck's border_image_url field
2. WHEN GameBoard.jpg exists in the Deck_Folder, THE system SHALL upload it and store the URL in the deck's background_image_url field
3. WHEN category images exist (protagonists.jpg, antagonists.jpg, etc.), THE system SHALL upload them and create category_images JSONB field
4. WHEN position.json exists in the Deck_Folder, THE system SHALL parse it and store layout data in the deck's layout_config field
5. WHEN deck-level images are missing, THE system SHALL set corresponding database fields to NULL

### Requirement 4: Card Image Association

**User Story:** As a content creator, I want individual card images to be automatically associated with their cards, so that each card displays its unique artwork.

#### Acceptance Criteria

1. WHEN an image file exists in a Card_Folder, THE system SHALL upload it and associate the URL with that specific card
2. WHEN multiple images exist in a Card_Folder, THE system SHALL upload the first valid image file found
3. WHEN card images are uploaded, THE system SHALL store the URL in the card's image_url field
4. WHEN a Card_Folder contains no images, THE system SHALL set the card's image_url field to NULL
5. THE system SHALL maintain the deterministic UUID generation for cards to ensure consistent database updates

### Requirement 5: Database Schema Integration

**User Story:** As a database administrator, I want image URLs properly stored in the database schema, so that the application can display images correctly.

#### Acceptance Criteria

1. THE system SHALL add image_url column to the cards table for individual card images
2. THE system SHALL add border_image_url column to the decks table for deck border images
3. THE system SHALL add background_image_url column to the decks table for game board backgrounds
4. THE system SHALL add category_images JSONB column to the decks table for category-specific images
5. THE system SHALL add layout_config JSONB column to the decks table for positioning data

### Requirement 6: Error Handling and Resilience

**User Story:** As a developer, I want robust error handling for image operations, so that the seed generation process doesn't fail due to image issues.

#### Acceptance Criteria

1. WHEN image files are corrupted or invalid, THE system SHALL log warnings and skip those files
2. WHEN UploadThing_Service is unavailable, THE system SHALL retry uploads with exponential backoff
3. WHEN network connectivity fails, THE system SHALL provide clear error messages and exit gracefully
4. WHEN disk space is insufficient for temporary operations, THE system SHALL detect and report the issue
5. THE system SHALL continue processing remaining cards even when individual image uploads fail

### Requirement 7: Configuration and Environment Management

**User Story:** As a system administrator, I want configurable settings for image upload behavior, so that I can adapt the system to different environments.

#### Acceptance Criteria

1. THE system SHALL read UploadThing API credentials from environment variables (UPLOADTHING_SECRET, UPLOADTHING_APP_ID)
2. WHEN environment variables are missing, THE system SHALL provide clear setup instructions
3. THE system SHALL support configuration of upload retry attempts and timeout values
4. THE system SHALL allow configuration of supported image file extensions
5. THE system SHALL support dry-run mode that simulates uploads without actually uploading files

### Requirement 8: Internationalization Support

**User Story:** As a content creator, I want image support for internationalized content, so that different locales can have appropriate imagery.

#### Acceptance Criteria

1. WHEN locale-specific images exist (card_en.jpg, card_ru.jpg), THE system SHALL upload and associate them with the appropriate translations
2. WHEN only generic images exist, THE system SHALL use them for all locales
3. THE system SHALL store locale-specific image URLs in the translations JSONB field structure
4. WHEN mixing locale-specific and generic images, THE system SHALL prioritize locale-specific images
5. THE system SHALL maintain backward compatibility with existing single-image-per-card structure

### Requirement 9: Image Upload Caching System

**User Story:** As a developer, I want a persistent caching mechanism for uploaded images, so that I don't re-upload the same images multiple times across different runs.

#### Acceptance Criteria

1. THE system SHALL maintain a persistent cache file (image_cache.json) that maps image file paths and checksums to UploadThing URLs
2. WHEN an image file hasn't changed (same path, size, and MD5 hash), THE system SHALL use the cached URL instead of re-uploading
3. WHEN the cache file is corrupted or missing, THE system SHALL recreate it and continue processing
4. WHEN cached URLs are no longer valid (404 responses), THE system SHALL remove them from cache and re-upload
5. THE system SHALL provide cache management commands (clear, validate, list) for maintenance operations

### Requirement 10: Standalone Image Upload Script

**User Story:** As a content creator, I want to run image uploads independently from seed generation, so that I can upload images in batches and manage the process more granularly.

#### Acceptance Criteria

1. THE system SHALL provide a separate script (upload_images.py) that handles only image upload operations
2. WHEN running the standalone script, THE system SHALL support filtering by deck name, category, or specific card folders
3. WHEN using batch processing, THE system SHALL support processing subsets of images (e.g., --category protagonists, --deck default)
4. THE system SHALL support dry-run mode for the standalone script to preview what would be uploaded
5. THE system SHALL allow the seed generation script to use cached URLs from previous standalone uploads

### Requirement 11: Performance and Efficiency

**User Story:** As a developer, I want efficient image processing and upload, so that operations complete in reasonable time.

#### Acceptance Criteria

1. THE system SHALL upload images concurrently with a configurable maximum of 5 simultaneous uploads
2. THE system SHALL implement progress reporting for long-running upload operations with ETA estimates
3. THE system SHALL compress images larger than 2MB before uploading while maintaining quality
4. WHEN processing large batches, THE system SHALL support resumable operations that can continue from interruption points
5. THE system SHALL validate image files before attempting upload to avoid unnecessary API calls

### Requirement 12: Logging and Monitoring

**User Story:** As a system administrator, I want comprehensive logging of image operations, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. THE system SHALL log all image upload attempts with timestamps and file details
2. WHEN uploads succeed, THE system SHALL log the resulting URLs and file sizes
3. WHEN uploads fail, THE system SHALL log detailed error information including HTTP status codes
4. THE system SHALL provide summary statistics at the end of processing (total images, successes, failures)
5. THE system SHALL support different log levels (DEBUG, INFO, WARNING, ERROR) with configurable output