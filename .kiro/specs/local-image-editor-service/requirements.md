# Requirements Document

## Introduction

The Local Image Editor Service is a standalone web application that provides image editing capabilities for managing deck and card images in a local folder structure. This service operates independently from the main application, running on a separate port, and focuses on direct file system operations without cloud service dependencies.

## Glossary

- **Service**: The standalone local image editor web application
- **Deck**: A collection of cards organized in a folder structure with metadata and images
- **Card**: An individual game card with associated images and metadata files
- **Image_Editor**: The core image manipulation component with tools like crop, magic wand, and eraser
- **File_System**: The local directory structure containing deck and card data
- **Canvas**: The HTML5 canvas element used for image editing operations
- **Tool**: A specific image editing function (crop, magic wand, eraser, auto-trim)

## Requirements

### Requirement 1: Standalone Service Architecture

**User Story:** As a content creator, I want to run an independent image editing service, so that I can edit deck images without requiring the main application or cloud services.

#### Acceptance Criteria

1. THE Service SHALL run on a configurable port separate from the main application
2. WHEN the Service starts, THE Service SHALL initialize without dependencies on external cloud services
3. THE Service SHALL operate independently of UploadThing or other cloud upload services
4. THE Service SHALL provide a web-based interface accessible through a browser
5. WHEN the Service is running, THE Service SHALL serve static assets and handle HTTP requests for image operations

### Requirement 2: Local File System Integration

**User Story:** As a content creator, I want to work directly with my local deck folder structure, so that I can manage images in the same organization as my main application.

#### Acceptance Criteria

1. THE Service SHALL read from the local specs/decks/ directory structure
2. WHEN browsing decks, THE Service SHALL display folders matching the pattern specs/decks/{deck_name}/
3. THE Service SHALL recognize card folders containing en.md, ru.md, ua.md, prompt.md files
4. THE Service SHALL identify deck-level images including Border.jpg, GameBoard.jpg, and category images
5. WHEN saving images, THE Service SHALL write directly to the appropriate local file system paths
6. THE Service SHALL preserve the existing folder structure and naming conventions

### Requirement 3: Image Editing Capabilities

**User Story:** As a content creator, I want comprehensive image editing tools, so that I can modify deck and card images with the same functionality as the current admin panel.

#### Acceptance Criteria

1. THE Image_Editor SHALL provide a crop tool with visual selection rectangle
2. THE Image_Editor SHALL include a magic wand tool with configurable tolerance settings
3. THE Image_Editor SHALL support both contiguous and global selection modes for magic wand
4. THE Image_Editor SHALL provide an auto-trim tool to remove transparent borders
5. THE Image_Editor SHALL include an eraser tool with adjustable brush size
6. THE Image_Editor SHALL maintain undo/redo functionality with operation history
7. WHEN editing images, THE Canvas SHALL render changes in real-time
8. THE Image_Editor SHALL support common image formats (PNG, JPG, JPEG)

### Requirement 4: Deck and Card Management Interface

**User Story:** As a content creator, I want to browse and select images from my deck structure, so that I can efficiently navigate and edit the images I need.

#### Acceptance Criteria

1. THE Service SHALL display a deck browser showing available decks from specs/decks/
2. WHEN a deck is selected, THE Service SHALL show both deck-level images and card categories
3. THE Service SHALL provide navigation between cards and settings views similar to the admin panel
4. WHEN browsing cards, THE Service SHALL group cards by category (protagonists, etc.)
5. THE Service SHALL display thumbnail previews of available images
6. WHEN an image is selected, THE Service SHALL load it into the Image_Editor for modification

### Requirement 5: File Operations and Persistence

**User Story:** As a content creator, I want to save my edited images back to the file system, so that my changes are preserved in the correct locations.

#### Acceptance Criteria

1. WHEN an image is edited, THE Service SHALL provide save functionality to overwrite the original file
2. THE Service SHALL support "Save As" functionality to create new image files
3. THE Service SHALL provide download functionality to save images to user-specified locations
4. WHEN saving images, THE Service SHALL preserve image quality and format
5. THE Service SHALL validate file paths to prevent writing outside the specs/decks/ directory
6. IF a save operation fails, THEN THE Service SHALL display an error message and maintain the current editor state

### Requirement 6: Image Format and Quality Management

**User Story:** As a content creator, I want to maintain image quality and format consistency, so that my edited images work properly with the existing deck system.

#### Acceptance Criteria

1. THE Service SHALL support PNG format with transparency preservation
2. THE Service SHALL support JPEG format for non-transparent images
3. WHEN saving images, THE Service SHALL maintain original format unless explicitly changed
4. THE Service SHALL preserve image metadata when possible
5. THE Service SHALL handle high-resolution images without quality degradation
6. WHEN processing images, THE Service SHALL maintain aspect ratios unless explicitly modified
7. WHEN saving images, THE Service SHALL optimize file size while maintaining reasonable quality
8. THE Service SHALL provide configurable quality settings for JPEG compression
9. THE Service SHALL prevent excessive file size increases during save operations

### Requirement 7: User Interface and Experience

**User Story:** As a content creator, I want an intuitive interface similar to the admin panel, so that I can quickly learn and use the image editing features.

#### Acceptance Criteria

1. THE Service SHALL provide a responsive web interface that works on desktop browsers
2. THE Service SHALL display tool palettes with clear icons and labels
3. WHEN tools are selected, THE Service SHALL provide visual feedback and cursor changes
4. THE Service SHALL show image dimensions and file information
5. THE Service SHALL provide keyboard shortcuts for common operations (Ctrl+Z for undo, etc.)
6. WHEN operations are in progress, THE Service SHALL display loading indicators or progress feedback

### Requirement 8: Error Handling and Validation

**User Story:** As a content creator, I want clear error messages and robust operation handling, so that I can understand and recover from any issues that occur.

#### Acceptance Criteria

1. WHEN file operations fail, THE Service SHALL display descriptive error messages
2. THE Service SHALL validate image file formats before attempting to load them
3. IF an image is corrupted or unreadable, THEN THE Service SHALL show an appropriate error message
4. THE Service SHALL handle network interruptions gracefully without losing editor state
5. WHEN invalid file paths are accessed, THE Service SHALL prevent directory traversal attacks
6. THE Service SHALL log errors appropriately for debugging purposes