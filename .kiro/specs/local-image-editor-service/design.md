# Design Document: Local Image Editor Service

## Overview

The Local Image Editor Service creates local file system versions of the existing admin panel components, specifically focusing on the CardsEditor functionality. This approach involves copying and adapting the existing `DeckEditor` and `CardsEditor` components to work with local file operations instead of remote database operations. The service integrates into the existing application as a new route under `app/[lng]/image-editor/` with environment-controlled access to the specs/decks/ folder structure.

The local versions maintain the same user interface and workflow as the existing admin panel but operate directly on the local file system. This includes copying the existing `ImageEditor` component and adapting it to save files locally instead of uploading to UploadThing. Environment controls ensure these local file features are only available in development mode.

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Client Browser"
        UI[Local Image Editor Page]
        LocalDeckEditor[LocalDeckEditor - Copy of DeckEditor]
        LocalCardsEditor[LocalCardsEditor - Copy of CardsEditor]
        LocalImageEditor[LocalImageEditor - Copy of ImageEditor]
        Canvas[HTML5 Canvas - Same as existing]
        Tools[Editing Tools - Same as existing]
    end
    
    subgraph "Next.js Application"
        Router[App Router]
        ImageEditorPage[app/[lng]/image-editor/page.tsx]
        API[API Routes /api/image-editor/]
        FileHandler[File System Handler]
        EnvGuard[Environment Guard]
        
        subgraph "Existing Admin Components"
            DeckEditor[DeckEditor - Database version]
            CardsEditor[CardsEditor - Database version]
            ImageEditor[ImageEditor - UploadThing version]
        end
    end
    
    subgraph "Local File System"
        Decks[specs/decks/]
        Cards[Card Folders]
        Images[Image Files]
    end
    
    UI --> Router
    LocalDeckEditor --> LocalCardsEditor
    LocalCardsEditor --> LocalImageEditor
    LocalImageEditor --> Canvas
    Canvas --> Tools
    Router --> ImageEditorPage
    ImageEditorPage --> LocalDeckEditor
    LocalDeckEditor --> API
    API --> EnvGuard
    EnvGuard --> FileHandler
    FileHandler --> Decks
    FileHandler --> Cards
    FileHandler --> Images
```

### Technology Stack

**Component Copy Strategy:**
- Copy `DeckEditor.tsx` → `LocalDeckEditor.tsx` (adapted for file system)
- Copy `CardsEditor.tsx` → `LocalCardsEditor.tsx` (adapted for file system)  
- Copy `ImageEditor.tsx` → `LocalImageEditor.tsx` (adapted for local file save)
- Focus on CardsEditor functionality, skip DeckSettings for now
- Maintain same UI/UX but with local file operations

**Integration with Existing App:**
- New route: `app/[lng]/image-editor/page.tsx`
- API routes under `/api/image-editor/`
- Separate components to avoid complexity of dual-mode components
- Reuse existing styling and UI patterns

**Backend (API Routes):**
- Next.js API routes for local file operations
- File serving endpoints for local images
- Environment-based access control
- Direct file system operations (no database)

### Service Configuration

The image editor integrates into the existing application structure:
- Page route: `/[lng]/image-editor`
- API endpoints under `/api/image-editor/`
- Environment-controlled activation via `.env.local`
- File system access restricted to development mode only

## Components and Interfaces

### Backend Components

#### Environment Guard
```typescript
interface EnvironmentGuard {
  isLocalImageEditorEnabled(): boolean;
  validateDevelopmentMode(): boolean;
  checkFileSystemAccess(): boolean;
  getDecksPath(): string | null;
}
```

#### Next.js API Routes
```typescript
interface ImageEditorAPI {
  routes: {
    '/api/image-editor/decks': DeckRoutes;
    '/api/image-editor/images': ImageRoutes;
    '/api/image-editor/files': FileRoutes;
  };
  middleware: {
    environmentCheck: EnvironmentMiddleware;
    pathValidation: PathValidationMiddleware;
    errorHandler: ErrorMiddleware;
  };
}
```

#### File System Handler
```typescript
interface FileSystemHandler {
  isEnabled(): boolean; // Check ENABLE_LOCAL_IMAGE_EDITOR env var
  validateEnvironment(): boolean; // Ensure development mode
  readDeckStructure(deckPath: string): Promise<DeckStructure>;
  listDecks(): Promise<string[]>;
  readImageFile(filePath: string): Promise<Buffer>;
  writeImageFile(filePath: string, imageData: Buffer): Promise<void>;
  validatePath(filePath: string): boolean; // Restrict to specs/decks/
  ensureDirectory(dirPath: string): Promise<void>;
  getAbsoluteDecksPath(): string; // Resolve path relative to project root
}
```

#### Image Processing Engine
```typescript
interface ImageProcessor {
  loadImage(buffer: Buffer): Promise<ProcessedImage>;
  crop(image: ProcessedImage, bounds: CropBounds): Promise<ProcessedImage>;
  removeBackground(image: ProcessedImage, tolerance: number, contiguous: boolean): Promise<ProcessedImage>;
  autoTrim(image: ProcessedImage): Promise<ProcessedImage>;
  erase(image: ProcessedImage, points: Point[], brushSize: number): Promise<ProcessedImage>;
  optimizeForSave(image: ProcessedImage, format: ImageFormat, quality?: number): Promise<Buffer>;
}
```

#### Deck Management
```typescript
interface DeckManager {
  getDeckList(): Promise<DeckInfo[]>;
  getDeckStructure(deckName: string): Promise<DeckStructure>;
  getCardList(deckName: string): Promise<CardInfo[]>;
  getCardImages(deckName: string, cardName: string): Promise<ImageInfo[]>;
  getDeckImages(deckName: string): Promise<ImageInfo[]>;
}
```

### Frontend Components

#### LocalDeckEditor (Copy of DeckEditor)
```typescript
interface LocalDeckEditor {
  // Same interface as DeckEditor but for local files
  selectedDeck: string | null;
  view: 'cards'; // Skip 'settings' for now, focus on CardsEditor
  deckList: LocalDeckInfo[];
  onDeckSelect: (deckName: string) => void;
  
  // Adapted for file system operations
  loadDecksFromFileSystem: () => Promise<LocalDeckInfo[]>;
  validateDeckStructure: (deckPath: string) => boolean;
}
```

#### LocalCardsEditor (Copy of CardsEditor)  
```typescript
interface LocalCardsEditor {
  // Same interface as CardsEditor but for local files
  selectedDeck: string;
  cards: LocalCardInfo[];
  selectedCard: string | null;
  onCardSelect: (cardName: string) => void;
  onImageEdit: (imagePath: string) => void;
  
  // Adapted for file system operations
  loadCardsFromDeck: (deckPath: string) => Promise<LocalCardInfo[]>;
  getCardImages: (cardPath: string) => Promise<string[]>;
}
```

#### Enhanced ImageEditor (Modified existing component)
```typescript
interface EnhancedImageEditorProps {
  // Existing props (maintain backward compatibility)
  imageUrl: string;
  onSave?: (editedImageUrl: string) => void;
  
  // New optional props for local file support
  isLocalFile?: boolean;
  localPath?: string;
  onLocalSave?: (editedImageData: Blob, originalPath: string) => Promise<void>;
  enableLocalFeatures?: boolean; // Environment-controlled
}

interface EnhancedImageEditor {
  // All existing functionality preserved
  canvas: HTMLCanvasElement;
  currentImage: ProcessedImage | null;
  activeTool: EditingTool;
  history: EditingHistory;
  tools: {
    crop: CropTool;
    magicWand: MagicWandTool;
    eraser: EraserTool;
    autoTrim: AutoTrimTool;
  };
  
  // Enhanced operations (backward compatible)
  operations: {
    undo: () => void;
    redo: () => void;
    save: () => Promise<void>; // Enhanced to handle both local and cloud
    saveAs: (filename: string) => Promise<void>; // New for local files
    download: () => void;
  };
}
```

#### Image Editor Page (New)
```typescript
interface ImageEditorPage {
  environmentCheck: boolean;
  components: {
    localDeckEditor: LocalDeckEditor;
    environmentWarning?: EnvironmentWarning;
  };
}
```

### Enhanced Component Integration

#### Component Strategy
```typescript
// File structure:
// components/admin/DeckEditor.tsx (existing - database version)
// components/local-admin/LocalDeckEditor.tsx (new - copy adapted for file system)
// components/admin/CardsEditor.tsx (existing - database version)  
// components/local-admin/LocalCardsEditor.tsx (new - copy adapted for file system)
// components/admin/ImageEditor.tsx (existing - enhanced to support both modes)

// Enhanced ImageEditor usage:
// Existing usage (unchanged):
<ImageEditor imageUrl="https://uploadthing.com/..." onSave={handleSave} />

// New local file usage:
<ImageEditor 
  imageUrl="/api/image-editor/serve/default/protagonists/hero.png"
  isLocalFile={true}
  localPath="specs/decks/default/cards/protagonists/The Hero/hero.png"
  onLocalSave={handleLocalSave}
  enableLocalFeatures={isDevMode}
/>
```

#### Data Flow Adaptation
```typescript
// Original DeckEditor flow:
// Database → API → DeckEditor → CardsEditor → ImageEditor → UploadThing

// New LocalDeckEditor flow:  
// File System → API → LocalDeckEditor → LocalCardsEditor → ImageEditor (enhanced) → Local File Save

interface LocalDataFlow {
  source: 'file-system';
  deckPath: string; // specs/decks/{deckName}
  cardPath: string; // specs/decks/{deckName}/cards/{category}/{cardName}
  imagePath: string; // Full file system path to image
  saveDestination: 'local-file-system';
}
```

#### ImageEditor Enhancement Strategy
```typescript
// Inside ImageEditor component, detect mode and handle accordingly:
const ImageEditor: React.FC<EnhancedImageEditorProps> = ({
  imageUrl,
  onSave,
  isLocalFile = false,
  localPath,
  onLocalSave,
  enableLocalFeatures = false
}) => {
  // All existing functionality remains unchanged
  
  // Enhanced save function
  const handleSave = async () => {
    if (isLocalFile && enableLocalFeatures && onLocalSave && localPath) {
      // Local file save logic
      const editedImageBlob = await canvasToBlob();
      await onLocalSave(editedImageBlob, localPath);
    } else if (onSave) {
      // Existing UploadThing save logic (unchanged)
      const editedImageUrl = await uploadToUploadThing();
      onSave(editedImageUrl);
    }
  };
  
  // Rest of component remains the same
};
```

### API Endpoints

#### Local Image Serving
- `GET /api/image-editor/serve/:deckName/:cardName?/:imageName` - Serve local image files with proper headers
- `GET /api/image-editor/thumbnail/:deckName/:cardName?/:imageName` - Generate and serve thumbnails

#### Enhanced Image Operations  
- `POST /api/image-editor/save` - Save edited image back to local file system
- `POST /api/image-editor/save-as` - Save edited image as new file
- `GET /api/image-editor/download/:path` - Download image file

#### Environment and Access Control
- `GET /api/image-editor/status` - Check if local image editor is enabled
- `GET /api/image-editor/environment` - Verify development mode and file system access

#### Deck Management (Reusing existing patterns)
- `GET /api/image-editor/decks` - List available decks from specs/decks/
- `GET /api/image-editor/decks/:deckName` - Get deck structure
- `GET /api/image-editor/decks/:deckName/cards` - List cards in deck
- `GET /api/image-editor/decks/:deckName/images` - List deck-level images

## Data Models

### Local File System Data Models

#### LocalDeckInfo (Adapted from existing DeckInfo)
```typescript
interface LocalDeckInfo {
  name: string;
  path: string; // specs/decks/{deckName}
  cardCount: number;
  categories: string[]; // Discovered from folder structure
  deckImages: LocalImageInfo[]; // Border.jpg, GameBoard.jpg, etc.
  lastModified: Date;
}
```

#### LocalCardInfo (Adapted from existing CardInfo)
```typescript
interface LocalCardInfo {
  name: string;
  category: string; // Folder name (protagonists, etc.)
  path: string; // specs/decks/{deckName}/cards/{category}/{cardName}
  images: LocalImageInfo[];
  metadata: {
    enFile?: string; // en.md
    ruFile?: string; // ru.md
    uaFile?: string; // ua.md
    promptFile?: string; // prompt.md
  };
  lastModified: Date;
}
```

#### LocalImageInfo (New for file system)
```typescript
interface LocalImageInfo {
  filename: string;
  path: string; // Full file system path
  relativePath: string; // Relative to specs/decks/
  serveUrl: string; // /api/image-editor/serve/...
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: 'png' | 'jpg' | 'jpeg';
  lastModified: Date;
}
```

#### ProcessedImage
```typescript
interface ProcessedImage {
  data: ImageData;
  width: number;
  height: number;
  format: ImageFormat;
  hasTransparency: boolean;
  metadata: {
    originalSize: number;
    compressionRatio?: number;
  };
}
```

### Editing Tools Data Models

#### CropBounds
```typescript
interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### MagicWandSettings
```typescript
interface MagicWandSettings {
  tolerance: number; // 0-255
  contiguous: boolean;
  antiAlias: boolean;
}
```

#### EraserSettings
```typescript
interface EraserSettings {
  brushSize: number; // 1-100
  hardness: number; // 0-100
  opacity: number; // 0-100
}
```

#### EditingHistory
```typescript
interface EditingHistory {
  states: ProcessedImage[];
  currentIndex: number;
  maxStates: number;
  canUndo: boolean;
  canRedo: boolean;
}
```

### File System Models

#### Environment Configuration
```typescript
interface EnvironmentConfig {
  isLocalImageEditorEnabled: boolean;
  isDevelopmentMode: boolean;
  decksPath: string;
  allowedPaths: string[];
  maxFileSize: number;
}
```

#### FileSystemPath
```typescript
interface FileSystemPath {
  absolute: string;
  relative: string;
  isValid: boolean;
  isWithinDecksDirectory: boolean;
  isWithinAllowedPaths: boolean;
  exists: boolean;
  resolvedFromProjectRoot: string;
}
```

#### SaveOptions
```typescript
interface SaveOptions {
  format: 'png' | 'jpg' | 'jpeg';
  quality?: number; // 1-100 for JPEG
  preserveTransparency: boolean;
  optimizeSize: boolean;
  maxFileSize?: number; // in bytes
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties validate the core correctness requirements:

### Property 1: Environment-Controlled File System Access
*For any* file system operation, the service should only allow access when ENABLE_LOCAL_IMAGE_EDITOR is true in development mode and restrict all operations to the specs/decks/ directory
**Validates: Requirements 1.2, 1.3, 5.5, 8.5**

### Property 2: Next.js Integration and Routing
*For any* request to the image editor routes, the service should properly integrate with the existing Next.js application structure and provide appropriate responses
**Validates: Requirements 1.1, 1.4, 1.5**

### Property 3: Image Format Support and Preservation
*For any* supported image format (PNG, JPG, JPEG), the service should correctly load, process, and save images while preserving format-specific features like PNG transparency
**Validates: Requirements 3.8, 6.1, 6.2, 6.3**

### Property 4: Deck Structure Recognition
*For any* valid deck directory structure, the service should correctly identify deck folders, card folders with metadata files, and associated images
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 5: Image Editing Tool Correctness
*For any* image and editing operation (crop, magic wand, eraser, auto-trim), the tool should produce the expected modification without corrupting the image data
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 6: Undo/Redo State Management
*For any* sequence of editing operations, undo should restore the previous state and redo should restore the undone state, maintaining operation history integrity
**Validates: Requirements 3.6**

### Property 7: File Save Operations Integrity
*For any* edited image, save operations should write the correct image data to the specified path without corrupting existing files or directory structure
**Validates: Requirements 2.5, 2.6, 5.1, 5.2**

### Property 8: Image Quality and Size Optimization
*For any* image save operation, the service should maintain reasonable quality while optimizing file size according to the specified format and quality settings
**Validates: Requirements 5.4, 6.5, 6.7, 6.8, 6.9**

### Property 9: Error Handling and State Preservation
*For any* operation that fails (file errors, corrupted images, network issues), the service should display appropriate error messages and maintain current editor state without data loss
**Validates: Requirements 5.6, 8.1, 8.2, 8.3, 8.4**

### Property 10: Deck and Card Navigation Consistency
*For any* deck selection and navigation operation, the service should display the correct deck contents, card categories, and images according to the file system structure
**Validates: Requirements 4.1, 4.2, 4.4, 4.6**

### Property 11: Image Loading and Display
*For any* valid image file in the deck structure, the service should correctly load, display thumbnails, and provide accurate image information (dimensions, format, size)
**Validates: Requirements 4.5, 7.4**

## Environment Configuration and Security

### Development Mode Restrictions

The image editor is designed to operate only in development environments with explicit configuration:

**Environment Variable Configuration:**
```bash
# .env.local
ENABLE_LOCAL_IMAGE_EDITOR=true
NODE_ENV=development
```

**Security Controls:**
- Feature is completely disabled in production environments
- File system access is restricted to the specs/decks/ directory only
- Path traversal attacks are prevented through strict validation
- All API endpoints check environment status before processing requests

**File System Access Model:**
```typescript
// Example path resolution
const projectRoot = process.cwd();
const decksPath = path.join(projectRoot, 'specs', 'decks');
const allowedPaths = [decksPath];

// All file operations are validated against allowed paths
function validatePath(requestedPath: string): boolean {
  const resolvedPath = path.resolve(requestedPath);
  return allowedPaths.some(allowedPath => 
    resolvedPath.startsWith(path.resolve(allowedPath))
  );
}
```

**Production Safety:**
- Environment guard middleware blocks all requests when not in development
- File system handlers return errors when environment checks fail
- Frontend displays appropriate warnings when feature is unavailable
- No file system operations are performed outside development mode

## Error Handling

### Error Categories and Responses

**File System Errors:**
- Invalid file paths → Return 400 Bad Request with descriptive message
- Permission denied → Return 403 Forbidden with access error details
- File not found → Return 404 Not Found with file path information
- Disk space issues → Return 507 Insufficient Storage with space requirements

**Image Processing Errors:**
- Unsupported format → Return 415 Unsupported Media Type with supported formats list
- Corrupted image data → Return 422 Unprocessable Entity with corruption details
- Processing timeout → Return 408 Request Timeout with operation details
- Memory limitations → Return 413 Payload Too Large with size limits

**Network and Service Errors:**
- Service unavailable → Return 503 Service Unavailable with retry information
- Internal processing errors → Return 500 Internal Server Error with error ID
- Rate limiting → Return 429 Too Many Requests with retry timing

### Error Recovery Strategies

**Client-Side Recovery:**
- Automatic retry with exponential backoff for transient errors
- Local state preservation during network interruptions
- Graceful degradation when optional features fail
- User notification with actionable error messages

**Server-Side Recovery:**
- Transaction rollback for failed file operations
- Temporary file cleanup on processing errors
- Resource cleanup on memory or timeout errors
- Comprehensive error logging for debugging

### Validation and Security

**Input Validation:**
- File path sanitization to prevent directory traversal
- Image format validation before processing
- File size limits to prevent resource exhaustion
- MIME type verification for uploaded files

**Security Measures:**
- Sandboxed file operations within specs/decks/ directory
- Resource limits for image processing operations
- Request rate limiting to prevent abuse
- Secure file handling to prevent code execution

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests:**
- Focus on specific examples, edge cases, and error conditions
- Test individual component functionality and integration points
- Validate specific user workflows and UI interactions
- Cover error handling scenarios with known inputs

**Property-Based Tests:**
- Verify universal properties across randomized inputs
- Test correctness properties with generated test data
- Validate system behavior under various conditions
- Ensure robustness with edge cases and boundary conditions

### Property-Based Testing Configuration

**Testing Framework:** 
- Backend: Use `fast-check` library for Node.js property-based testing
- Frontend: Use `fast-check` with Jest for React component testing
- Minimum 100 iterations per property test to ensure thorough coverage

**Test Organization:**
- Each correctness property implemented as a single property-based test
- Tests tagged with format: **Feature: local-image-editor-service, Property {number}: {property_text}**
- Property tests grouped by component (file system, image processing, UI)

**Test Data Generation:**
- Random image generation with various formats, sizes, and content
- Random file path generation within valid directory structures
- Random editing operation sequences for state management testing
- Random error condition simulation for robustness testing

### Unit Testing Focus Areas

**Backend Unit Tests:**
- File system operations with known directory structures
- Image processing with specific test images
- API endpoint responses with controlled inputs
- Error handling with simulated failure conditions

**Frontend Unit Tests:**
- Component rendering with mock data
- User interaction handling (clicks, keyboard shortcuts)
- Canvas operations with test images
- State management with known operation sequences

**Integration Tests:**
- End-to-end workflows from file selection to save
- API communication between frontend and backend
- File system integration with actual test directories
- Error propagation from backend to frontend UI

### Performance and Load Testing

**Performance Benchmarks:**
- Image processing operations should complete within 5 seconds for typical images
- File system operations should respond within 1 second
- UI interactions should provide feedback within 100ms
- Memory usage should remain stable during extended editing sessions

**Load Testing Scenarios:**
- Multiple concurrent image editing operations
- Large image file processing (up to 50MB)
- Extensive undo/redo operation sequences
- Bulk file operations on large deck structures

This comprehensive testing approach ensures both functional correctness and system reliability while maintaining development velocity through automated validation.