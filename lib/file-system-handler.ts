import fs from 'fs/promises'
import path from 'path'
import { lookup } from 'mime-types'
import { checkEnvironment, validatePath, type EnvironmentConfig } from './image-editor-env'

export interface FileSystemErrorDetails {
  deckName?: string
  deckPath?: string
  filePath?: string
  directory?: string
  allowedPaths?: string[]
  isEnabled?: boolean
  isDevelopment?: boolean
  decksPath?: string
  systemError?: string | Error | unknown
  originalError?: unknown
  invalidCharacters?: string[]
  size?: number
  minSize?: number
  maxSize?: number
  minExpectedSize?: number
  requiredSpace?: number
  dataSize?: number
  width?: number
  height?: number
  maxDimension?: number
  expectedFormat?: string
  foundChunkType?: string
  expectedChunkType?: string
  expectedEOI?: string
  foundEOI?: string
  extension?: string
  supportedExtensions?: string[]
  fileSignature?: string
  type?: string
  resolvedPath?: string
  error?: unknown
}

/**
 * Custom error class for file system operations
 */
export class FileSystemError extends Error {
  public readonly code: string
  public readonly details: FileSystemErrorDetails

  constructor(code: string, message: string, details: FileSystemErrorDetails = {}) {
    super(message)
    this.name = 'FileSystemError'
    this.code = code
    this.details = details
  }
}

/**
 * Image validation error class
 */
export class ImageValidationError extends FileSystemError {
  constructor(message: string, details: FileSystemErrorDetails = {}) {
    super('INVALID_IMAGE', message, details)
    this.name = 'ImageValidationError'
  }
}

/**
 * Data models for local file system operations
 */
export interface LocalDeckInfo {
  name: string
  path: string
  cardCount: number
  categories: string[]
  deckImages: LocalImageInfo[]
  lastModified: Date
}

export interface LocalCardInfo {
  name: string
  category: string
  path: string
  images: LocalImageInfo[]
  metadata: {
    enFile?: string
    ruFile?: string
    uaFile?: string
    promptFile?: string
  }
  lastModified: Date
}

export interface LocalImageInfo {
  filename: string
  path: string
  relativePath: string
  serveUrl: string
  size: number
  dimensions?: {
    width: number
    height: number
  }
  format: 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp'
  lastModified: Date
}

export interface DeckStructure {
  deck: LocalDeckInfo
  cards: LocalCardInfo[]
  deckImages: LocalImageInfo[]
}

export interface FileSystemPath {
  absolute: string
  relative: string
  isValid: boolean
  isWithinDecksDirectory: boolean
  exists: boolean
  resolvedFromProjectRoot: string
}

/**
 * File System Handler for specs/decks/ operations
 */
export class FileSystemHandler {
  private config: EnvironmentConfig

  constructor() {
    this.config = checkEnvironment()
  }

  /**
   * Check if the file system handler is enabled
   */
  isEnabled(): boolean {
    return this.config.isLocalImageEditorEnabled
  }

  /**
   * Validate environment requirements
   */
  validateEnvironment(): boolean {
    return this.config.isLocalImageEditorEnabled && this.config.isDevelopmentMode
  }

  /**
   * Get absolute path to decks directory
   */
  getAbsoluteDecksPath(): string {
    return this.config.decksPath
  }

  /**
   * Validate and resolve a file path
   */
  async validateAndResolvePath(filePath: string): Promise<FileSystemPath> {
    const absolute = path.resolve(filePath)
    const relative = path.relative(this.config.decksPath, absolute)
    const resolvedFromProjectRoot = path.relative(process.cwd(), absolute)

    const isValid = validatePath(absolute, this.config)
    const isWithinDecksDirectory = absolute.startsWith(path.resolve(this.config.decksPath))

    let exists = false
    try {
      await fs.access(absolute)
      exists = true
    }
    catch {
      // File doesn't exist
    }

    return {
      absolute,
      relative,
      isValid,
      isWithinDecksDirectory,
      exists,
      resolvedFromProjectRoot,
    }
  }

  /**
   * List all available decks with enhanced error handling
   */
  async listDecks(): Promise<string[]> {
    if (!this.validateEnvironment()) {
      throw new FileSystemError(
        'ENVIRONMENT_DISABLED',
        'Local image editor is not available. Ensure ENABLE_LOCAL_IMAGE_EDITOR=true is set in .env.local and you are in development mode.',
        {
          isEnabled: this.config.isLocalImageEditorEnabled,
          isDevelopment: this.config.isDevelopmentMode,
          decksPath: this.config.decksPath,
        },
      )
    }

    try {
      // Check if decks directory exists
      try {
        await fs.access(this.config.decksPath)
      }
      catch (accessError) {
        throw new FileSystemError(
          'DECKS_DIRECTORY_NOT_FOUND',
          `Decks directory not found: "${this.config.decksPath}". Please create the specs/decks directory structure.`,
          { decksPath: this.config.decksPath, systemError: accessError },
        )
      }

      const entries = await fs.readdir(this.config.decksPath, { withFileTypes: true })
      const deckNames = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => !name.startsWith('.')) // Exclude hidden directories

      return deckNames.sort() // Return sorted list for consistent ordering
    }
    catch (error) {
      if (error instanceof FileSystemError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.message.includes('EACCES')) {
          throw new FileSystemError(
            'PERMISSION_DENIED',
            `Permission denied: Cannot access decks directory "${this.config.decksPath}". Check directory permissions.`,
            { decksPath: this.config.decksPath, systemError: error.message },
          )
        }

        if (error.message.includes('ENOENT')) {
          throw new FileSystemError(
            'DECKS_DIRECTORY_NOT_FOUND',
            `Decks directory not found: "${this.config.decksPath}". Please create the specs/decks directory structure.`,
            { decksPath: this.config.decksPath, systemError: error.message },
          )
        }
      }

      console.error('Unexpected error listing decks:', error)
      throw new FileSystemError(
        'LIST_ERROR',
        `Failed to list decks from "${this.config.decksPath}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { decksPath: this.config.decksPath, originalError: error },
      )
    }
  }

  /**
   * Read deck structure from file system with enhanced error handling
   */
  async readDeckStructure(deckName: string): Promise<DeckStructure> {
    if (!this.validateEnvironment()) {
      throw new FileSystemError(
        'ENVIRONMENT_DISABLED',
        'Local image editor is not available. Ensure ENABLE_LOCAL_IMAGE_EDITOR=true is set in .env.local and you are in development mode.',
        {
          isEnabled: this.config.isLocalImageEditorEnabled,
          isDevelopment: this.config.isDevelopmentMode,
        },
      )
    }

    if (!deckName || deckName.trim() === '') {
      throw new FileSystemError(
        'INVALID_DECK_NAME',
        'Deck name cannot be empty',
        { deckName },
      )
    }

    // Validate deck name for security (prevent directory traversal)
    if (deckName.includes('..') || deckName.includes('/') || deckName.includes('\\')) {
      throw new FileSystemError(
        'INVALID_DECK_NAME',
        `Invalid deck name "${deckName}". Deck names cannot contain path separators or parent directory references.`,
        { deckName, invalidCharacters: ['..', '/', '\\'] },
      )
    }

    const deckPath = path.join(this.config.decksPath, deckName)
    const pathInfo = await this.validateAndResolvePath(deckPath)

    if (!pathInfo.isValid) {
      throw new FileSystemError(
        'INVALID_PATH',
        `Invalid deck path: "${deckName}"`,
        { deckName, deckPath },
      )
    }

    if (!pathInfo.exists) {
      throw new FileSystemError(
        'DECK_NOT_FOUND',
        `Deck "${deckName}" not found. Available decks can be listed using the list decks function.`,
        { deckName, deckPath },
      )
    }

    try {
      // Verify it's actually a directory
      const deckStats = await fs.stat(deckPath)
      if (!deckStats.isDirectory()) {
        throw new FileSystemError(
          'NOT_A_DIRECTORY',
          `"${deckName}" exists but is not a directory`,
          { deckName, deckPath },
        )
      }

      // Read deck-level images with error handling
      let deckImages: LocalImageInfo[] = []
      try {
        deckImages = await this.getDeckImages(deckName)
      }
      catch (error) {
        console.warn(`Warning: Could not read deck images for "${deckName}":`, error)
        // Continue without deck images rather than failing completely
      }

      // Read cards structure with error handling
      let cards: LocalCardInfo[] = []
      try {
        cards = await this.getCardList(deckName)
      }
      catch (error) {
        console.warn(`Warning: Could not read cards for deck "${deckName}":`, error)
        // Continue without cards rather than failing completely
      }

      const deck: LocalDeckInfo = {
        name: deckName,
        path: deckPath,
        cardCount: cards.length,
        categories: [...new Set(cards.map(card => card.category))].sort(),
        deckImages,
        lastModified: deckStats.mtime,
      }

      return {
        deck,
        cards,
        deckImages,
      }
    }
    catch (error) {
      if (error instanceof FileSystemError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.message.includes('EACCES')) {
          throw new FileSystemError(
            'PERMISSION_DENIED',
            `Permission denied: Cannot access deck "${deckName}". Check directory permissions.`,
            { deckName, deckPath, systemError: error.message },
          )
        }

        if (error.message.includes('ENOENT')) {
          throw new FileSystemError(
            'DECK_NOT_FOUND',
            `Deck "${deckName}" not found or was deleted`,
            { deckName, deckPath, systemError: error.message },
          )
        }
      }

      console.error(`Unexpected error reading deck structure for ${deckName}:`, error)
      throw new FileSystemError(
        'READ_DECK_ERROR',
        `Failed to read deck structure for "${deckName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { deckName, deckPath, originalError: error },
      )
    }
  }

  /**
   * Get list of cards in a deck
   */
  async getCardList(deckName: string): Promise<LocalCardInfo[]> {
    const cardsPath = path.join(this.config.decksPath, deckName, 'cards')
    const pathInfo = await this.validateAndResolvePath(cardsPath)

    if (!pathInfo.exists) {
      return [] // No cards directory
    }

    try {
      const categoryEntries = await fs.readdir(cardsPath, { withFileTypes: true })
      const categories = categoryEntries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)

      const allCards: LocalCardInfo[] = []

      for (const category of categories) {
        const categoryPath = path.join(cardsPath, category)
        const cardEntries = await fs.readdir(categoryPath, { withFileTypes: true })

        for (const cardEntry of cardEntries) {
          if (cardEntry.isDirectory()) {
            const cardPath = path.join(categoryPath, cardEntry.name)
            const cardInfo = await this.getCardInfo(deckName, category, cardEntry.name)
            allCards.push(cardInfo)
          }
        }
      }

      return allCards
    }
    catch (error) {
      console.error(`Error reading card list for deck ${deckName}:`, error)
      throw new Error(`Failed to read card list: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get information about a specific card
   */
  async getCardInfo(deckName: string, category: string, cardName: string): Promise<LocalCardInfo> {
    const cardPath = path.join(this.config.decksPath, deckName, 'cards', category, cardName)
    const pathInfo = await this.validateAndResolvePath(cardPath)

    if (!pathInfo.exists) {
      throw new Error(`Card not found: ${cardName} in ${category}`)
    }

    try {
      const cardStats = await fs.stat(cardPath)
      const cardFiles = await fs.readdir(cardPath)

      // Identify metadata files
      const metadata = {
        enFile: cardFiles.includes('en.md') ? 'en.md' : undefined,
        ruFile: cardFiles.includes('ru.md') ? 'ru.md' : undefined,
        uaFile: cardFiles.includes('ua.md') ? 'ua.md' : undefined,
        promptFile: cardFiles.includes('prompt.md') ? 'prompt.md' : undefined,
      }

      // Get card images
      const images = await this.getCardImages(deckName, category, cardName)

      return {
        name: cardName,
        category,
        path: cardPath,
        images,
        metadata,
        lastModified: cardStats.mtime,
      }
    }
    catch (error) {
      console.error(`Error reading card info for ${cardName}:`, error)
      throw new Error(`Failed to read card info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get images for a specific card
   */
  async getCardImages(deckName: string, category: string, cardName: string): Promise<LocalImageInfo[]> {
    const cardPath = path.join(this.config.decksPath, deckName, 'cards', category, cardName)
    return this.getImagesInDirectory(cardPath, `${deckName}/cards/${category}/${cardName}`)
  }

  /**
   * Get deck-level images
   */
  async getDeckImages(deckName: string): Promise<LocalImageInfo[]> {
    const deckPath = path.join(this.config.decksPath, deckName)
    return this.getImagesInDirectory(deckPath, deckName)
  }

  /**
   * Get all images in a directory
   */
  private async getImagesInDirectory(dirPath: string, relativeDirPath: string): Promise<LocalImageInfo[]> {
    const pathInfo = await this.validateAndResolvePath(dirPath)

    if (!pathInfo.exists) {
      return []
    }

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true })
      const imageFiles = files.filter((file) => {
        if (!file.isFile()) return false
        const mimeType = lookup(file.name)
        return mimeType && mimeType.startsWith('image/')
      })

      const images: LocalImageInfo[] = []

      for (const file of imageFiles) {
        const filePath = path.join(dirPath, file.name)
        const fileStats = await fs.stat(filePath)
        const mimeType = lookup(file.name)

        if (mimeType && mimeType.startsWith('image/')) {
          const format = this.getImageFormat(mimeType)
          const relativePath = path.join(relativeDirPath, file.name)
          const serveUrl = `/api/image-editor/serve/${relativePath}`

          images.push({
            filename: file.name,
            path: filePath,
            relativePath,
            serveUrl,
            size: fileStats.size,
            format,
            lastModified: fileStats.mtime,
          })
        }
      }

      return images
    }
    catch (error) {
      console.error(`Error reading images in directory ${dirPath}:`, error)
      return []
    }
  }

  /**
   * Read image file as buffer with enhanced error handling
   */
  async readImageFile(filePath: string): Promise<Buffer> {
    const pathInfo = await this.validateAndResolvePath(filePath)

    if (!pathInfo.isValid) {
      throw new FileSystemError(
        'INVALID_PATH',
        `Access denied: File path "${filePath}" is outside allowed directories`,
        { filePath, allowedPaths: this.config.allowedPaths },
      )
    }

    if (!pathInfo.exists) {
      throw new FileSystemError(
        'FILE_NOT_FOUND',
        `Image file not found: "${filePath}"`,
        { filePath, resolvedPath: pathInfo.absolute },
      )
    }

    try {
      const fileStats = await fs.stat(pathInfo.absolute)

      if (!fileStats.isFile()) {
        throw new FileSystemError(
          'NOT_A_FILE',
          `Path "${filePath}" exists but is not a file (it may be a directory)`,
          { filePath, type: fileStats.isDirectory() ? 'directory' : 'other' },
        )
      }

      if (fileStats.size === 0) {
        throw new FileSystemError(
          'EMPTY_FILE',
          `Image file "${filePath}" is empty (0 bytes)`,
          { filePath, size: fileStats.size },
        )
      }

      if (fileStats.size > this.config.maxFileSize) {
        throw new FileSystemError(
          'FILE_TOO_LARGE',
          `Image file "${filePath}" is too large: ${this.formatFileSize(fileStats.size)} (maximum allowed: ${this.formatFileSize(this.config.maxFileSize)})`,
          { filePath, size: fileStats.size, maxSize: this.config.maxFileSize },
        )
      }

      const buffer = await fs.readFile(pathInfo.absolute)

      // Validate that the file is actually an image
      await this.validateImageBuffer(buffer, filePath)

      return buffer
    }
    catch (error) {
      if (error instanceof FileSystemError) {
        throw error
      }

      // Handle system-level errors
      if (error instanceof Error) {
        if (error.message.includes('EACCES')) {
          throw new FileSystemError(
            'PERMISSION_DENIED',
            `Permission denied: Cannot read image file "${filePath}". Check file permissions.`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('ENOENT')) {
          throw new FileSystemError(
            'FILE_NOT_FOUND',
            `Image file not found: "${filePath}" (file may have been moved or deleted)`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
          throw new FileSystemError(
            'TOO_MANY_FILES',
            `System limit reached: Too many files open. Please try again in a moment.`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('ENOSPC')) {
          throw new FileSystemError(
            'NO_SPACE',
            `Insufficient disk space to read file "${filePath}"`,
            { filePath, systemError: error.message },
          )
        }
      }

      console.error(`Unexpected error reading image file ${filePath}:`, error)
      throw new FileSystemError(
        'READ_ERROR',
        `Failed to read image file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, originalError: error },
      )
    }
  }

  /**
   * Write image file to disk with enhanced error handling
   */
  async writeImageFile(filePath: string, imageData: Buffer): Promise<void> {
    const pathInfo = await this.validateAndResolvePath(filePath)

    if (!pathInfo.isValid) {
      throw new FileSystemError(
        'INVALID_PATH',
        `Access denied: Cannot write to path "${filePath}" (outside allowed directories)`,
        { filePath, allowedPaths: this.config.allowedPaths },
      )
    }

    if (imageData.length === 0) {
      throw new FileSystemError(
        'EMPTY_DATA',
        `Cannot save empty image data to "${filePath}"`,
        { filePath, dataSize: imageData.length },
      )
    }

    if (imageData.length > this.config.maxFileSize) {
      throw new FileSystemError(
        'DATA_TOO_LARGE',
        `Image data too large: ${this.formatFileSize(imageData.length)} (maximum allowed: ${this.formatFileSize(this.config.maxFileSize)})`,
        { filePath, dataSize: imageData.length, maxSize: this.config.maxFileSize },
      )
    }

    // Validate that the data is actually an image
    await this.validateImageBuffer(imageData, filePath)

    try {
      // Ensure directory exists
      const dirPath = path.dirname(pathInfo.absolute)
      await this.ensureDirectory(dirPath)

      // Check available disk space (if possible)
      try {
        const stats = await fs.stat(dirPath)
        // Note: Node.js doesn't provide direct disk space checking,
        // but we can at least verify the directory is accessible
      }
      catch (dirError) {
        throw new FileSystemError(
          'DIRECTORY_ACCESS',
          `Cannot access directory "${dirPath}" for writing`,
          { filePath, directory: dirPath, error: dirError },
        )
      }

      // Write the file atomically by writing to a temporary file first
      const tempPath = pathInfo.absolute + '.tmp'

      try {
        await fs.writeFile(tempPath, imageData)
        await fs.rename(tempPath, pathInfo.absolute)
      }
      catch (writeError) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath)
        }
        catch {
          // Ignore cleanup errors
        }
        throw writeError
      }
    }
    catch (error) {
      if (error instanceof FileSystemError) {
        throw error
      }

      // Handle system-level errors
      if (error instanceof Error) {
        if (error.message.includes('EACCES')) {
          throw new FileSystemError(
            'PERMISSION_DENIED',
            `Permission denied: Cannot write to "${filePath}". Check directory permissions.`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('ENOSPC')) {
          throw new FileSystemError(
            'NO_SPACE',
            `Insufficient disk space to save image "${filePath}". Free up some space and try again.`,
            { filePath, requiredSpace: imageData.length, systemError: error.message },
          )
        }

        if (error.message.includes('EROFS')) {
          throw new FileSystemError(
            'READ_ONLY',
            `Cannot write to "${filePath}": File system is read-only`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
          throw new FileSystemError(
            'TOO_MANY_FILES',
            `System limit reached: Too many files open. Please try again in a moment.`,
            { filePath, systemError: error.message },
          )
        }

        if (error.message.includes('EEXIST')) {
          throw new FileSystemError(
            'FILE_EXISTS',
            `File "${filePath}" already exists and cannot be overwritten`,
            { filePath, systemError: error.message },
          )
        }
      }

      console.error(`Unexpected error writing image file ${filePath}:`, error)
      throw new FileSystemError(
        'WRITE_ERROR',
        `Failed to save image "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, dataSize: imageData.length, originalError: error },
      )
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    const pathInfo = await this.validateAndResolvePath(dirPath)

    if (!pathInfo.isValid) {
      throw new Error('Invalid directory path - outside allowed directories')
    }

    try {
      await fs.mkdir(pathInfo.absolute, { recursive: true })
    }
    catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get image format from MIME type
   */
  private getImageFormat(mimeType: string): LocalImageInfo['format'] {
    switch (mimeType) {
      case 'image/png':
        return 'png'
      case 'image/jpeg':
        return 'jpg'
      case 'image/jpg':
        return 'jpg'
      case 'image/gif':
        return 'gif'
      case 'image/webp':
        return 'webp'
      default:
        return 'jpg' // Default fallback
    }
  }

  /**
   * Validate that a buffer contains valid image data
   */
  private async validateImageBuffer(buffer: Buffer, filePath: string): Promise<void> {
    if (buffer.length < 8) {
      throw new ImageValidationError(
        `File "${filePath}" is too small to be a valid image (${buffer.length} bytes)`,
        { filePath, size: buffer.length, minSize: 8 },
      )
    }

    // Check for common image file signatures
    const signatures = {
      png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      jpeg: [0xFF, 0xD8, 0xFF],
      gif87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      gif89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      webp: [0x52, 0x49, 0x46, 0x46], // RIFF header, followed by WEBP
      bmp: [0x42, 0x4D],
    }

    let isValidImage = false
    let detectedFormat = 'unknown'

    // Check PNG signature
    if (buffer.length >= 8 && signatures.png.every((byte, i) => buffer[i] === byte)) {
      isValidImage = true
      detectedFormat = 'PNG'
    }
    // Check JPEG signature
    else if (buffer.length >= 3 && signatures.jpeg.every((byte, i) => buffer[i] === byte)) {
      isValidImage = true
      detectedFormat = 'JPEG'
    }
    // Check GIF signatures
    else if (buffer.length >= 6 && (
      signatures.gif87a.every((byte, i) => buffer[i] === byte)
      || signatures.gif89a.every((byte, i) => buffer[i] === byte)
    )) {
      isValidImage = true
      detectedFormat = 'GIF'
    }
    // Check WebP signature (RIFF + WEBP)
    else if (buffer.length >= 12
      && signatures.webp.every((byte, i) => buffer[i] === byte)
      && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      isValidImage = true
      detectedFormat = 'WebP'
    }
    // Check BMP signature
    else if (buffer.length >= 2 && signatures.bmp.every((byte, i) => buffer[i] === byte)) {
      isValidImage = true
      detectedFormat = 'BMP'
    }

    if (!isValidImage) {
      // Try to detect based on file extension as fallback
      const extension = path.extname(filePath).toLowerCase()
      const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

      if (!supportedExtensions.includes(extension)) {
        throw new ImageValidationError(
          `File "${filePath}" is not a supported image format. Supported formats: PNG, JPEG, GIF, WebP, BMP`,
          {
            filePath,
            extension,
            supportedExtensions,
            fileSignature: Array.from(buffer.slice(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
          },
        )
      }

      // File has correct extension but invalid signature - likely corrupted
      throw new ImageValidationError(
        `File "${filePath}" appears to be corrupted. The file has a ${extension.slice(1).toUpperCase()} extension but invalid file signature.`,
        {
          filePath,
          extension,
          expectedFormat: extension.slice(1).toUpperCase(),
          fileSignature: Array.from(buffer.slice(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
        },
      )
    }

    // Additional validation for specific formats
    if (detectedFormat === 'PNG') {
      await this.validatePngStructure(buffer, filePath)
    }
    else if (detectedFormat === 'JPEG') {
      await this.validateJpegStructure(buffer, filePath)
    }
  }

  /**
   * Validate PNG file structure
   */
  private async validatePngStructure(buffer: Buffer, filePath: string): Promise<void> {
    // Check for IHDR chunk (must be first chunk after signature)
    if (buffer.length < 33) { // 8 bytes signature + 8 bytes chunk length/type + 13 bytes IHDR + 4 bytes CRC
      throw new ImageValidationError(
        `PNG file "${filePath}" is truncated or corrupted (missing IHDR chunk)`,
        { filePath, size: buffer.length, minExpectedSize: 33 },
      )
    }

    // Check IHDR chunk type
    const ihdrType = buffer.slice(12, 16).toString('ascii')
    if (ihdrType !== 'IHDR') {
      throw new ImageValidationError(
        `PNG file "${filePath}" is corrupted (invalid or missing IHDR chunk)`,
        { filePath, foundChunkType: ihdrType, expectedChunkType: 'IHDR' },
      )
    }

    // Extract and validate image dimensions
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    if (width === 0 || height === 0) {
      throw new ImageValidationError(
        `PNG file "${filePath}" has invalid dimensions: ${width}x${height}`,
        { filePath, width, height },
      )
    }

    if (width > 65535 || height > 65535) {
      throw new ImageValidationError(
        `PNG file "${filePath}" dimensions too large: ${width}x${height} (maximum: 65535x65535)`,
        { filePath, width, height, maxDimension: 65535 },
      )
    }
  }

  /**
   * Validate JPEG file structure
   */
  private async validateJpegStructure(buffer: Buffer, filePath: string): Promise<void> {
    // JPEG files should end with EOI marker (0xFF 0xD9)
    if (buffer.length < 4) {
      throw new ImageValidationError(
        `JPEG file "${filePath}" is too small to be valid`,
        { filePath, size: buffer.length, minSize: 4 },
      )
    }

    const lastTwoBytes = buffer.slice(-2)
    if (lastTwoBytes[0] !== 0xFF || lastTwoBytes[1] !== 0xD9) {
      throw new ImageValidationError(
        `JPEG file "${filePath}" appears to be truncated or corrupted (missing EOI marker)`,
        {
          filePath,
          expectedEOI: '0xFF 0xD9',
          foundEOI: `0x${lastTwoBytes[0].toString(16).padStart(2, '0')} 0x${lastTwoBytes[1].toString(16).padStart(2, '0')}`,
        },
      )
    }

    // Look for SOF (Start of Frame) marker to validate basic structure
    let foundSOF = false
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xFF) {
        const marker = buffer[i + 1]
        // SOF markers: 0xC0-0xCF (except 0xC4, 0xC8, 0xCC which are other markers)
        if ((marker >= 0xC0 && marker <= 0xC3)
          || (marker >= 0xC5 && marker <= 0xC7)
          || (marker >= 0xC9 && marker <= 0xCB)
          || (marker >= 0xCD && marker <= 0xCF)) {
          foundSOF = true
          break
        }
      }
    }

    if (!foundSOF) {
      throw new ImageValidationError(
        `JPEG file "${filePath}" appears to be corrupted (no Start of Frame marker found)`,
        { filePath },
      )
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  /**
   * Validate file path for security
   */
  validatePath(filePath: string): boolean {
    return validatePath(filePath, this.config)
  }
}

/**
 * Create a singleton instance of the file system handler
 */
export const fileSystemHandler = new FileSystemHandler()

/**
 * Utility functions for common operations
 */
export async function getDecksPath(): Promise<string> {
  return fileSystemHandler.getAbsoluteDecksPath()
}

export async function listAvailableDecks(): Promise<string[]> {
  return fileSystemHandler.listDecks()
}

export async function getDeckStructure(deckName: string): Promise<DeckStructure> {
  return fileSystemHandler.readDeckStructure(deckName)
}

export async function getCardImages(deckName: string, category: string, cardName: string): Promise<LocalImageInfo[]> {
  return fileSystemHandler.getCardImages(deckName, category, cardName)
}

export async function getDeckImages(deckName: string): Promise<LocalImageInfo[]> {
  return fileSystemHandler.getDeckImages(deckName)
}
