'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { LocalCardInfo, LocalImageInfo } from '@/lib/file-system-handler'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { getTranslation } from '@/app/i18n/client'
import ImageEditor from '@/components/admin/ImageEditor'
import { Plus, FileText, Image as ImageIcon } from 'lucide-react'

interface LocalCardsEditorProps {
  deckName: string
  deckPath: string
  lng: string
}

interface CardsResponse {
  deckName: string
  cards: LocalCardInfo[]
  cardsByCategory: Record<string, LocalCardInfo[]>
  categories: string[]
  summary: {
    totalCards: number
    categoryCounts: Record<string, number>
    totalImages: number
  }
}

export default function LocalCardsEditor({ deckName, lng }: LocalCardsEditorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = getTranslation(lng, 'common')

  const selectedCardId = searchParams.get('card')
  const selectedImagePath = searchParams.get('image')

  const [cards, setCards] = useState<LocalCardInfo[]>([])
  const [selectedCard, setSelectedCard] = useState<LocalCardInfo | null>(null)
  const [selectedImage, setSelectedImage] = useState<LocalImageInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isNewImage, setIsNewImage] = useState(false)
  const [newImageFilename, setNewImageFilename] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)

  // Define categories for filter checkboxes with color coding
  const categoryColors: Record<string, { bg: string, text: string, border: string }> = {
    all: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
    protagonists: { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-600' },
    antagonists: { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-700' },
    settings: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
    objects: { bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
    catalysts: { bg: 'bg-fuchsia-500', text: 'text-white', border: 'border-fuchsia-600' },
    traits: { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  }

  const fetchCards = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/image-editor/decks/${encodeURIComponent(deckName)}/cards`)
      if (!response.ok) {
        throw new Error(`Failed to load cards: ${response.statusText}`)
      }

      const data: CardsResponse = await response.json()

      // Convert lastModified strings back to Date objects
      const processedCards = data.cards.map(card => ({
        ...card,
        lastModified: new Date(card.lastModified),
        images: card.images.map(image => ({
          ...image,
          lastModified: new Date(image.lastModified),
        })),
      }))

      setCards(processedCards)
    }
    catch (err) {
      console.error('Error loading cards:', err)
      setError(err instanceof Error ? err.message : 'Failed to load cards')
    }
    finally {
      setIsLoading(false)
    }
  }, [deckName])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  // Synchronize selection with URL parameters
  useEffect(() => {
    if (isLoading || cards.length === 0) return

    if (selectedCardId) {
      const card = cards.find(c => c.name === selectedCardId)
      if (card) {
        setSelectedCard(card)

        if (selectedImagePath) {
          const image = card.images.find(img => img.relativePath === selectedImagePath)
          if (image) {
            setSelectedImage(image)
            setShowImageEditor(true)
          }
          else {
            setSelectedImage(null)
            setShowImageEditor(false)
          }
        }
        else {
          setSelectedImage(null)
          setShowImageEditor(false)
        }
      }
      else {
        setSelectedCard(null)
        setSelectedImage(null)
        setShowImageEditor(false)
      }
    }
    else {
      setSelectedCard(null)
      setSelectedImage(null)
      setShowImageEditor(false)
    }
  }, [cards, selectedCardId, selectedImagePath, isLoading])

  const toggleCategory = (categoryId: string) => {
    const newCategories = new Set(selectedCategories)

    if (categoryId === 'all') {
      // If clicking "All", clear others and select only All
      return setSelectedCategories(new Set(['all']))
    }

    // If clicking a specific category
    if (newCategories.has('all')) {
      newCategories.delete('all')
    }

    if (newCategories.has(categoryId)) {
      newCategories.delete(categoryId)
    }
    else {
      newCategories.add(categoryId)
    }

    // If nothing selected, revert to All
    if (newCategories.size === 0) {
      newCategories.add('all')
    }

    setSelectedCategories(newCategories)
  }

  const filteredCards = cards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesCategory = false
    if (selectedCategories.has('all')) {
      matchesCategory = true
    }
    else {
      matchesCategory = selectedCategories.has(card.category)
    }

    return matchesSearch && matchesCategory
  })

  // Get unique categories from cards
  const availableCategories = ['all', ...new Set(cards.map(card => card.category))]

  // Count cards by category
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') {
      return cards.length
    }
    return cards.filter(card => card.category === categoryId).length
  }

  const handleCardSelect = useCallback((card: LocalCardInfo | null, updateUrl = true) => {
    setSelectedCard(card)
    setSelectedImage(null)
    setShowImageEditor(false)

    // Update URL when card selection changes
    if (updateUrl) {
      const params = new URLSearchParams(searchParams)
      if (card) {
        params.set('card', card.name)
      }
      else {
        params.delete('card')
      }
      params.delete('image') // Clear image selection when changing cards
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [searchParams, router, pathname])

  const handleImageSelect = (image: LocalImageInfo) => {
    setSelectedImage(image)
    setIsNewImage(false) // This is editing an existing image, not a new one
    setShowImageEditor(true)

    // Update URL to include selected image
    const params = new URLSearchParams(searchParams)
    params.set('image', image.relativePath)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleImageEditorClose = () => {
    setShowImageEditor(false)
    setSelectedImage(null)

    // Remove image from URL
    const params = new URLSearchParams(searchParams)
    params.delete('image')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    processFile(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // Create a temporary LocalImageInfo for the new image
      const tempImage: LocalImageInfo = {
        filename: file.name,
        path: '', // Will be set on save
        relativePath: '', // Will be set on save
        serveUrl: result, // Use data URL for preview
        size: file.size,
        format: file.type.split('/')[1] as 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp',
        lastModified: new Date(),
      }

      setSelectedImage(tempImage)
      setIsNewImage(true)

      // If we already have an image, we'll suggest overwriting it
      if (selectedCard && selectedCard.images.length > 0) {
        // For existing cards, use generic name
        const extension = file.name.split('.').pop() || 'png'
        setNewImageFilename(`image.${extension}`)
      }
      else {
        // For new cards, use generic name
        const extension = file.name.split('.').pop() || 'png'
        setNewImageFilename(`image.${extension}`)
      }

      setShowImageEditor(true)
    }
    reader.readAsDataURL(file)
  }, [selectedCard])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        processFile(file)
      }
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleLocalSave = async (editedImageData: Blob, originalPath: string, format?: string, quality?: number) => {
    try {
      const formData = new FormData()
      formData.append('image', editedImageData)

      // If it's a new image, construct the path
      if (isNewImage && selectedCard) {
        const separator = selectedCard.path.includes('\\') ? '\\' : '/'
        const targetPath = `${selectedCard.path}${separator}${newImageFilename}`
        formData.append('filePath', targetPath)
      }
      else {
        // For existing images, replace the filename with a generic name based on format
        let fullPath = originalPath
        if (!originalPath.startsWith('specs/decks/') && !originalPath.startsWith('/')) {
          fullPath = `specs/decks/${originalPath}`
        }

        // Extract directory path and replace filename with generic name
        const pathParts = fullPath.split('/')
        const filename = pathParts.pop() || ''
        const directory = pathParts.join('/')

        // Determine extension from format parameter or original file
        const extension = format || filename.split('.').pop() || 'png'
        const genericFilename = `image.${extension}`

        // For absolute paths, we need to ensure we're using the full path
        let newPath
        if (fullPath.startsWith('/')) {
          // It's an absolute path, keep it absolute
          newPath = `${directory}/${genericFilename}`
        }
        else {
          // It's a relative path, keep it relative
          newPath = `${directory}/${genericFilename}`
        }

        formData.append('filePath', newPath)
      }

      formData.append('overwrite', 'true') // Allow overwriting

      // Add format and quality parameters if provided
      if (format) {
        formData.append('format', format)
      }
      if (quality !== undefined) {
        formData.append('quality', quality.toString())
      }

      const response = await fetch('/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to save image: ${response.statusText}`)
      }

      const result = await response.json()

      // Refresh the card data to show updated image
      await fetchCards(false)

      // Reset new image state
      setIsNewImage(false)
      setNewImageFilename('')

      // Show success message with optimization info
      const message = result.file.compressionRatio
        ? `Image saved successfully! Size: ${Math.round(result.file.size / 1024)}KB (${Math.round(result.file.compressionRatio * 100)}% of original)`
        : 'Image saved successfully!'
      console.log(message)
    }
    catch (error) {
      console.error('Error saving image:', error)
      // Show error message to user
      alert(`Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {t('loading')}
            ...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchCards()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  // Helper to render text info
  const renderTextInfo = (title: string, content?: string, icon?: React.ReactNode) => {
    if (!content) return null
    return (
      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          {icon || <FileText className="w-4 h-4" />}
          {title}
        </h4>
        <div className="text-sm text-foreground/80 whitespace-pre-wrap font-serif">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
      {/* Left Column: Card List */}
      <div className="w-full md:w-1/3 flex flex-col gap-4 min-h-0 h-full">
        <div className="flex flex-col gap-3 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search_cards')}
            className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {availableCategories.map((categoryId) => {
              const colors = categoryColors[categoryId] || categoryColors.all
              const isSelected = selectedCategories.has(categoryId)
              return (
                <button
                  key={categoryId}
                  onClick={() => toggleCategory(categoryId)}
                  className={`px-2 py-1 rounded border transition-colors ${isSelected
                    ? `${colors.bg} ${colors.text} ${colors.border} border-2`
                    : `bg-card text-muted-foreground border-border hover:border-primary/50`
                  }`}
                >
                  {categoryId === 'all' ? t('all') : categoryId}
                  {' '}
                  (
                  {getCategoryCount(categoryId)}
                  )
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow className="bg-muted/40 text-left">
                <TableHead className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('name')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {filteredCards.map(card => (
                <TableRow
                  key={`${card.category}-${card.name}`}
                  className={`transition-colors cursor-pointer ${selectedCard?.name === card.name ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
                  onClick={() => handleCardSelect(card)}
                >
                  <TableCell className="px-4 py-3 text-sm text-foreground font-medium">
                    <div className="flex justify-between items-center">
                      <span>{card.name}</span>
                      <span
                        className={`text-[10px] uppercase px-1 rounded ml-2 font-medium ${categoryColors[card.category]?.bg
                        && categoryColors[card.category]?.text
                        && categoryColors[card.category]?.border
                          ? `${categoryColors[card.category].bg} ${categoryColors[card.category].text} border ${categoryColors[card.category].border}`
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {card.category.substring(0, 3).toUpperCase()}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCards.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-center text-muted-foreground">
                    {searchQuery || selectedCategories.size > 0 ? t('no_search_results') : t('no_cards_yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right Column: Card Details and Images */}
      <div className="flex-1 bg-card p-6 rounded-xl border border-border overflow-y-auto h-full shadow-sm">
        {selectedCard
          ? (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-2">{selectedCard.name}</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>
                        {t('category')}
                        :
                      </strong>
                      {' '}
                      {selectedCard.category}
                    </p>
                    <p>
                      <strong>
                        {t('path')}
                        :
                      </strong>
                      {' '}
                      {selectedCard.path}
                    </p>
                    <p>
                      <strong>
                        {t('images')}
                        :
                      </strong>
                      {' '}
                      {selectedCard.images.length}
                    </p>
                    <p>
                      <strong>
                        {t('last_modified')}
                        :
                      </strong>
                      {' '}
                      {selectedCard.lastModified.toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Text Metadata Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {renderTextInfo('English (en.md)', selectedCard.metadata.enFile ? selectedCard.textContent?.en : undefined)}
                  {renderTextInfo('Prompt', selectedCard.metadata.promptFile ? selectedCard.textContent?.prompt : undefined, <ImageIcon className="w-4 h-4" />)}
                  {/* Can add RU/UA here if needed, keeping it simple for now based on user request */}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold">{t('image')}</h4>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                {selectedCard.images.length > 0
                  ? (
                      <div className="w-full">
                        <div
                          className={`group relative border ${isDragActive ? 'border-primary border-2 bg-primary/5' : 'border-border'} rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer bg-muted`}
                          onClick={() => handleImageSelect(selectedCard.images[0])}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                        >
                          <div className="aspect-video flex items-center justify-center max-w-sm mx-auto">
                            <Image
                              src={selectedCard.images[0].serveUrl}
                              alt={selectedCard.name}
                              width={300}
                              height={400}
                              className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                            <div className="hidden text-muted-foreground text-sm">
                              {t('image_load_error')}
                            </div>
                          </div>
                          <div className={`absolute inset-0 ${isDragActive ? 'bg-primary/20' : 'bg-black/40'} opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity`}>
                            <ImageIcon className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-white'} mb-2`} />
                            <p className={`font-medium ${isDragActive ? 'text-primary' : 'text-white'}`}>
                              {isDragActive ? (t('drop_image_here')) : t('edit_image')}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 text-center max-w-sm mx-auto">
                          <p className="text-xs font-semibold">{selectedCard.images[0].filename}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {selectedCard.images[0].format}
                            {' '}
                            •
                            {Math.round(selectedCard.images[0].size / 1024)}
                            {' '}
                            KB
                          </p>
                        </div>
                      </div>
                    )
                  : (
                      <div
                        className={`relative border-2 border-dashed ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'} rounded-lg p-4 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer w-full flex flex-col items-center justify-center gap-3`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />

                        <div className={`p-4 rounded-full ${isDragActive ? 'bg-primary/20 animate-pulse' : 'bg-muted'}`}>
                          <ImageIcon className={`w-12 h-12 ${isDragActive ? 'text-primary' : 'text-muted-foreground opacity-50'}`} />
                        </div>

                        <div className="text-center">
                          <p className="text-muted-foreground font-medium mb-1">
                            {isDragActive ? t('drop_image_here') : t('no_images_found')}
                          </p>
                          <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                            {isDragActive
                              ? t('release_to_upload')
                              : t('upload_image_hint')}
                          </p>
                          {!isDragActive && (
                            <Button
                              variant="secondary"
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                fileInputRef.current?.click()
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              {t('add_image')}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
              </div>
            )
          : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">{t('select_card_to_view_details')}</p>
                </div>
              </div>
            )}
      </div>

      {showImageEditor && selectedImage && (
        <ImageEditor
          isOpen={showImageEditor}
          onClose={handleImageEditorClose}
          imageUrl={selectedImage.serveUrl}
          isLocalFile={true}
          localPath={selectedImage.relativePath}
          onLocalSave={handleLocalSave}
          enableLocalFeatures={true}
          inline={false}
        />
      )}
    </div>
  )
}
