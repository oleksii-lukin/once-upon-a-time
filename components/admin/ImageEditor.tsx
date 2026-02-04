'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Crop, Wand2, Undo, Save, Loader2, Scissors, Eraser, Copy, Frame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

interface ImageEditorProps {
  // Existing modal props (for backward compatibility)
  isOpen?: boolean
  onClose?: () => void
  imageUrl: string
  onSave?: (file: File) => Promise<void>

  // New props for local file support
  isLocalFile?: boolean
  localPath?: string
  onLocalSave?: (editedImageData: Blob, originalPath: string, format?: string, quality?: number) => Promise<void>
  enableLocalFeatures?: boolean

  // New prop for inline usage (non-modal)
  inline?: boolean
}

interface SaveOptions {
  format: 'png' | 'jpeg' | 'jpg'
  quality: number // 0.1 to 1.0 for JPEG
  preserveTransparency: boolean
}

export default function ImageEditor({
  isOpen = false,
  onClose,
  imageUrl,
  onSave,
  isLocalFile = false,
  localPath,
  onLocalSave,
  enableLocalFeatures = false,
  inline = false,
}: ImageEditorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'view' | 'crop' | 'magic' | 'eraser' | 'resize-canvas'>('view')
  const [tolerance, setTolerance] = useState([30])
  const [isProcessing, setIsProcessing] = useState(false)
  const [imageHistory, setImageHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isContiguous, setIsContiguous] = useState(true)

  // Eraser state
  const [eraserSize, setEraserSize] = useState([20])
  const [isDrawing, setIsDrawing] = useState(false)

  // Save As dialog state
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false)
  const [saveAsFilename, setSaveAsFilename] = useState('')

  // Image format and quality state
  const [saveOptions, setSaveOptions] = useState<SaveOptions>({
    format: 'png',
    quality: 0.9,
    preserveTransparency: true,
  })
  const [originalFormat, setOriginalFormat] = useState<string>('png')
  const [hasTransparency, setHasTransparency] = useState(false)

  // Crop state
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null)
  const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null)
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number, height: number }>({ width: 1, height: 1 })
  const [activeHandle, setActiveHandle] = useState<string | null>(null)

  // Handle Resize Logic
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (activeHandle && cropRect && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width)
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height)

        let { x: rx, y: ry, w: rw, h: rh } = cropRect
        const maxX = canvasDimensions.width
        const maxY = canvasDimensions.height
        const minSize = 10

        if (activeHandle.includes('e')) {
          rw = Math.max(minSize, Math.min(x - rx, maxX - rx))
        }
        if (activeHandle.includes('w')) {
          const newX = Math.max(0, Math.min(x, rx + rw - minSize))
          rw = rx + rw - newX
          rx = newX
        }
        if (activeHandle.includes('s')) {
          rh = Math.max(minSize, Math.min(y - ry, maxY - ry))
        }
        if (activeHandle.includes('n')) {
          const newY = Math.max(0, Math.min(y, ry + rh - minSize))
          rh = ry + rh - newY
          ry = newY
        }

        setCropRect({ x: rx, y: ry, w: rw, h: rh })
      }
    }

    const handleGlobalUp = () => {
      if (activeHandle) {
        setActiveHandle(null)
      }
    }

    if (activeHandle) {
      window.addEventListener('mousemove', handleGlobalMove)
      window.addEventListener('mouseup', handleGlobalUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
    }
  }, [activeHandle, cropRect, canvasDimensions])

  // Initialize canvas
  useEffect(() => {
    if ((!inline && !isOpen) || !imageUrl) return

    const initCanvas = async () => {
      // Simple delay to ensure Dialog content is mounted and ref is populated
      await new Promise(r => setTimeout(r, 100))

      const canvas = canvasRef.current
      if (!canvas) {
        console.error('Canvas ref is null')
        return
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        console.error('Could not get 2d context')
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageUrl

      img.onload = () => {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        setCanvasDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        ctx.drawImage(img, 0, 0)

        // Detect original format from URL or filename
        const detectedFormat = detectImageFormat(imageUrl)
        setOriginalFormat(detectedFormat)

        // Set initial save options based on detected format
        setSaveOptions(prev => ({
          ...prev,
          format: detectedFormat === 'jpg' || detectedFormat === 'jpeg' ? 'jpeg' : 'png',
          preserveTransparency: detectedFormat === 'png',
        }))

        // Check for transparency
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const hasAlpha = checkImageTransparency(imageData)
        setHasTransparency(hasAlpha)

        // Initialize history
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setImageHistory([initialData])
        setHistoryIndex(0)
        // console.log("Image loaded successfully:", img.naturalWidth, "x", img.naturalHeight)
      }

      img.onerror = (e) => {
        console.error('Failed to load image for editing', e)

        // Provide more specific error messages based on the error type
        let errorMessage = t('admin.imageEditor.error_loading')

        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
          errorMessage = 'Failed to load image: Local server may be unavailable. Please check if the image editor service is running.'
        }
        else if (imageUrl.startsWith('/api/')) {
          errorMessage = 'Failed to load image: The image file may be corrupted, moved, or you may not have permission to access it.'
        }
        else if (imageUrl.startsWith('http')) {
          errorMessage = 'Failed to load image: Network connection issue or the image URL is invalid.'
        }
        else {
          errorMessage = 'Failed to load image: The image file may be corrupted or in an unsupported format.'
        }

        toast.error(errorMessage, {
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => {
              // Retry loading the image
              img.src = imageUrl + '?retry=' + Date.now()
            },
          },
        })
      }
    }

    initCanvas()

    return () => {
      // Cleanup if needed
      setImageHistory([])
      setHistoryIndex(-1)
    }
  }, [inline ? true : isOpen, imageUrl, t])

  // Utility function to detect image format from URL
  const detectImageFormat = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'png':
        return 'png'
      case 'jpg':
      case 'jpeg':
        return 'jpeg'
      default:
        return 'png' // Default to PNG for transparency support
    }
  }

  // Utility function to check if image has transparency
  const checkImageTransparency = (imageData: ImageData): boolean => {
    const data = imageData.data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true // Found a pixel with alpha < 255
      }
    }
    return false
  }

  // Utility function to optimize image for save
  const optimizeImageForSave = (canvas: HTMLCanvasElement, options: SaveOptions): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Determine the MIME type and quality
      let mimeType: string
      let quality: number | undefined

      if (options.format === 'jpeg' || options.format === 'jpg') {
        mimeType = 'image/jpeg'
        quality = options.quality

        // If saving as JPEG but image has transparency, convert to white background
        if (hasTransparency && !options.preserveTransparency) {
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height

            // Fill with white background
            tempCtx.fillStyle = '#FFFFFF'
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

            // Draw the original image on top
            tempCtx.drawImage(canvas, 0, 0)

            tempCanvas.toBlob((blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to create optimized blob'))
            }, mimeType, quality)
            return
          }
        }
      }
      else {
        mimeType = 'image/png'
        // PNG doesn't use quality parameter
      }

      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      }, mimeType, quality)
    })
  }

  const saveState = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // Limit history size to prevent memory issues
    const newHistory = imageHistory.slice(0, historyIndex + 1)
    newHistory.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))

    if (newHistory.length > 10) newHistory.shift()

    setImageHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return

      const prevState = imageHistory[historyIndex - 1]
      canvasRef.current.width = prevState.width
      canvasRef.current.height = prevState.height
      ctx.putImageData(prevState, 0, 0)
      setHistoryIndex(historyIndex - 1)
      setCropRect(null)
    }
  }

  // --- Cropping Logic ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'crop') {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width)
      const y = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)
      setCropStart({ x, y })
      setCropRect({ x, y, w: 0, h: 0 })
    }
    else if (mode === 'eraser') {
      setIsDrawing(true)
      erase(e)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'crop' && cropStart) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const currentX = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width)
      const currentY = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)

      setCropRect({
        x: Math.min(cropStart.x, currentX),
        y: Math.min(cropStart.y, currentY),
        w: Math.abs(currentX - cropStart.x),
        h: Math.abs(currentY - cropStart.y),
      })
    }
    else if (mode === 'eraser' && isDrawing) {
      erase(e)
    }
  }

  const handleMouseUp = () => {
    setCropStart(null)
    if (isDrawing) {
      setIsDrawing(false)
      saveState()
    }
  }

  const applyCrop = () => {
    if (!cropRect || !canvasRef.current || cropRect.w === 0 || cropRect.h === 0) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h)

    canvasRef.current.width = cropRect.w
    canvasRef.current.height = cropRect.h
    ctx.putImageData(imageData, 0, 0)

    setCropRect(null)
    setMode('view')
    saveState()
  }

  const autoTrim = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const width = canvasRef.current.width
    const height = canvasRef.current.height
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    let minX = width, minY = height, maxX = 0, maxY = 0
    let found = false

    // Scan for non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          found = true
        }
      }
    }

    if (!found) {
      // Empty image, maybe warn? Or just return.
      return
    }

    // Add 1px padding optionally, or just strict trim?
    // Usually strict trim is expected for "remove borders".

    // Bounds check just in case
    // maxX is 0-indexed, so width is maxX - minX + 1
    const cropWidth = maxX - minX + 1
    const cropHeight = maxY - minY + 1

    const croppedData = ctx.getImageData(minX, minY, cropWidth, cropHeight)

    canvasRef.current.width = cropWidth
    canvasRef.current.height = cropHeight
    ctx.putImageData(croppedData, 0, 0)

    saveState()
  }

  // --- Eraser Logic ---

  const erase = (e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width)
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
    const radius = eraserSize[0]

    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // --- Magic Wand / Chroma Key Logic ---

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode === 'magic' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const clickX = (e.clientX - rect.left) * (canvasRef.current.width / rect.width)
      const clickY = (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return

      const pixel = ctx.getImageData(clickX, clickY, 1, 1).data
      const targetR = pixel[0]
      const targetG = pixel[1]
      const targetB = pixel[2]
      // console.log("Target color:", targetR, targetG, targetB)

      const imgData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
      const data = imgData.data
      const tol = tolerance[0]
      const width = canvasRef.current.width
      const height = canvasRef.current.height

      // Helper to check color match
      const isMatch = (idx: number) => {
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        const dist = Math.sqrt(
          Math.pow(r - targetR, 2)
          + Math.pow(g - targetG, 2)
          + Math.pow(b - targetB, 2),
        )
        // tolerance X means match within distance X * 4.4 roughly matching the global logic
        return dist <= tol * 4.4
      }

      if (!isContiguous) {
        // Global replacement (existing logic)
        for (let i = 0; i < data.length; i += 4) {
          // Re-implementing logic here to use the shared isMatch if possible,
          // but keeping loop simple for performance as before
          if (isMatch(i)) {
            data[i + 3] = 0
          }
        }
      }
      else {
        // Contiguous replacement (Flood Fill)
        const startX = Math.floor(clickX)
        const startY = Math.floor(clickY)
        const startIdx = (startY * width + startX) * 4

        // If start pixel doesn't match or is already transparent?
        // Usually we want to erase the color we clicked on.
        // But if we clicked on transparent, maybe we shouldn't do anything?
        // Let's assume we proceed if it matches target (which it should, as it IS target).
        // Actually, logic above defined target from clicked pixel.

        if (data[startIdx + 3] !== 0) { // Only if not already transparent
          const stack = [[startX, startY]]
          const visited = new Uint8Array(width * height) // 0 = unvisited, 1 = visited

          while (stack.length > 0) {
            const [x, y] = stack.pop()!
            const idx = (y * width + x) * 4
            const visitedIdx = y * width + x

            if (x < 0 || x >= width || y < 0 || y >= height) continue
            if (visited[visitedIdx]) continue
            visited[visitedIdx] = 1

            if (isMatch(idx)) {
              data[idx + 3] = 0 // Erase

              // Add neighbors
              stack.push([x + 1, y])
              stack.push([x - 1, y])
              stack.push([x, y + 1])
              stack.push([x, y - 1])
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0)
      saveState()
    }
  }

  const handleSave = async () => {
    if (!canvasRef.current) return
    setIsProcessing(true)

    try {
      const optimizedBlob = await optimizeImageForSave(canvasRef.current, saveOptions)

      if (isLocalFile && enableLocalFeatures && onLocalSave) {
        // Local file save logic with format and quality
        try {
          await onLocalSave(optimizedBlob, localPath || '', saveOptions.format, saveOptions.quality)
          toast.success(t('admin.imageEditor.save_success'))
          if (onClose) onClose()
        }
        catch (error) {
          console.error('Error saving local file:', error)
          handleSaveError(error instanceof Error ? error : new Error(String(error)), 'save')
        }
      }
      else {
        if (onSave) {
          // Existing UploadThing save logic (unchanged)
          const file = new File([optimizedBlob], 'edited_image.png', { type: optimizedBlob.type })
          try {
            await onSave(file)
            toast.success(t('admin.imageEditor.save_success'))
            if (onClose) onClose()
          }
          catch (error) {
            console.error('Error saving file:', error)
            handleSaveError(error instanceof Error ? error : new Error(String(error)), 'save')
          }
        }
        else {
          toast.error('No save method available. Please check your configuration.')
        }
      }
    }
    catch (error) {
      console.error('Error optimizing image:', error)
      toast.error('Failed to optimize image for saving. Please try again.')
    }

    setIsProcessing(false)
  }

  const handleSaveAs = async () => {
    if (!canvasRef.current || !saveAsFilename.trim()) return
    setIsProcessing(true)

    try {
      const optimizedBlob = await optimizeImageForSave(canvasRef.current, saveOptions)

      if (isLocalFile && enableLocalFeatures && localPath) {
        try {
          // Create FormData for the save-as API
          const formData = new FormData()
          formData.append('image', optimizedBlob, saveAsFilename)
          formData.append('originalPath', localPath)
          formData.append('newFilename', saveAsFilename)
          formData.append('format', saveOptions.format)
          formData.append('quality', saveOptions.quality.toString())

          const response = await fetchWithRetry('/api/image-editor/save-as', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to save file')
          }

          const result = await response.json()
          toast.success(`Image saved as ${result.file.filename}`)
          setShowSaveAsDialog(false)
          setSaveAsFilename('')

          // Don't close the editor, user might want to continue editing
        }
        catch (error) {
          console.error('Error saving file as:', error)
          handleSaveError(error instanceof Error ? error : new Error(String(error)), 'save-as')
        }
      }
    }
    catch (error) {
      console.error('Error optimizing image for save as:', error)
      toast.error('Failed to optimize image for saving. Please try again.')
    }

    setIsProcessing(false)
  }

  // Enhanced error handling function
  const handleSaveError = (error: Error, operation: 'save' | 'save-as') => {
    let errorMessage = `Failed to ${operation === 'save' ? 'save' : 'save as'} image`
    let isRetryable = false

    // Handle specific error types
    if (error.message.includes('Network connection interrupted')
      || error.message.includes('ECONNRESET')
      || error.message.includes('ECONNABORTED')) {
      errorMessage = 'Network connection interrupted. Please check your connection and try again.'
      isRetryable = true
    }
    else if (error.message.includes('Request timed out')
      || error.message.includes('timeout')) {
      errorMessage = 'Request timed out. The file may be too large or the server is busy. Please try again.'
      isRetryable = true
    }
    else if (error.message.includes('too large')) {
      errorMessage = 'Image file is too large. Try reducing the image size or quality.'
    }
    else if (error.message.includes('Permission denied')) {
      errorMessage = 'Permission denied. Check that you have write access to the destination folder.'
    }
    else if (error.message.includes('No space') || error.message.includes('ENOSPC')) {
      errorMessage = 'Insufficient disk space. Free up some space and try again.'
    }
    else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
      errorMessage = 'Image data appears to be corrupted. Please try editing the image again.'
    }
    else if (error.message.includes('File already exists')) {
      errorMessage = 'A file with this name already exists. Choose a different name or enable overwrite.'
    }
    else if (error.message.includes('outside allowed directories')) {
      errorMessage = 'Invalid file path. Files can only be saved within the decks directory.'
    }
    else {
      // Use the error message if it's descriptive enough
      if (error.message.length > 10 && !error.message.includes('fetch')) {
        errorMessage = error.message
      }
    }

    // Show error with retry option if applicable
    if (isRetryable) {
      toast.error(errorMessage, {
        action: {
          label: 'Retry',
          onClick: () => {
            if (operation === 'save') {
              handleSave()
            }
            else {
              handleSaveAs()
            }
          },
        },
      })
    }
    else {
      toast.error(errorMessage)
    }
  }

  // Fetch with retry logic for network resilience
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })
        return response
      }
      catch (error) {
        lastError = error as Error

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError' && !error.message.includes('timeout')) {
            // User cancelled, don't retry
            throw error
          }

          if (error.message.includes('400')
            || error.message.includes('401')
            || error.message.includes('403')
            || error.message.includes('404')) {
            // Client errors, don't retry
            throw error
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Max 5 second delay
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  // Render the editor content
  const editorContent = (
    <>
      <div className="flex-1 overflow-auto p-4 bg-muted/20 relative flex items-center justify-center min-h-[400px]">
        {/* Canvas */}
        <div className="relative shadow-lg border border-border/50 bg-[#333] checkered-bg">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-[calc(60vh-60px)] object-contain ${mode === 'eraser'
              ? 'cursor-crosshair'
              : mode === 'crop'
                ? 'cursor-crosshair'
                : mode === 'magic'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
          />

          {/* Crop Rect Overlay */}
          {cropRect && (
            <div
              className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{
                left: (cropRect.x / canvasDimensions.width) * 100 + '%',
                top: (cropRect.y / canvasDimensions.height) * 100 + '%',
                width: (cropRect.w / canvasDimensions.width) * 100 + '%',
                height: (cropRect.h / canvasDimensions.height) * 100 + '%',
              }}
            />
          )}

          {/* Resize Handles */}
          {mode === 'resize-canvas' && cropRect && (
            <>
              {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #333',
                  zIndex: 10,
                }

                const left = (cropRect.x / canvasDimensions.width) * 100
                const top = (cropRect.y / canvasDimensions.height) * 100
                const width = (cropRect.w / canvasDimensions.width) * 100
                const height = (cropRect.h / canvasDimensions.height) * 100

                if (handle.includes('n')) style.top = `calc(${top}% - 5px)`
                else if (handle.includes('s')) style.top = `calc(${top + height}% - 5px)`
                else style.top = `calc(${top + height / 2}% - 5px)`

                if (handle.includes('w')) style.left = `calc(${left}% - 5px)`
                else if (handle.includes('e')) style.left = `calc(${left + width}% - 5px)`
                else style.left = `calc(${left + width / 2}% - 5px)`

                let cursor = 'default'
                if (handle === 'nw' || handle === 'se') cursor = 'nwse-resize'
                else if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize'
                else if (handle === 'n' || handle === 's') cursor = 'ns-resize'
                else if (handle === 'w' || handle === 'e') cursor = 'ew-resize'
                style.cursor = cursor

                return (
                  <div
                    key={handle}
                    style={style}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setActiveHandle(handle)
                    }}
                  />
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-t border-border bg-card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'crop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('crop')}
            >
              <Crop className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.tool_crop')}
            </Button>
            {mode === 'crop' && (
              <Button variant="secondary" size="sm" onClick={applyCrop} disabled={!cropRect || cropRect.w < 5}>
                {t('admin.imageEditor.apply_crop')}
              </Button>
            )}

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant={mode === 'resize-canvas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (mode !== 'resize-canvas') {
                  setMode('resize-canvas')
                  setCropRect({ x: 0, y: 0, w: canvasDimensions.width, h: canvasDimensions.height })
                  setCropStart(null)
                }
              }}
            >
              <Frame className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.tool_resize_canvas')}
            </Button>
            {mode === 'resize-canvas' && (
              <Button variant="secondary" size="sm" onClick={applyCrop} title={t('admin.imageEditor.tool_resize_canvas_hint')}>
                {t('admin.imageEditor.apply_crop')}
              </Button>
            )}

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant={mode === 'magic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('magic')}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.tool_magic')}
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant="outline"
              size="sm"
              onClick={autoTrim}
              title={t('admin.imageEditor.tool_trim_hint')}
            >
              <Scissors className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.tool_trim')}
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant={mode === 'eraser' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('eraser')}
            >
              <Eraser className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.tool_eraser')}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {mode === 'magic' && (
          <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-lg">
            <span className="text-xs font-medium whitespace-nowrap">
              {t('admin.imageEditor.tolerance')}
              :
              {' '}
              {tolerance}
              %
            </span>
            <Slider
              value={tolerance}
              onValueChange={setTolerance}
              max={100}
              step={1}
              className="w-[200px]"
            />
            <span className="text-xs text-muted-foreground">{t('admin.imageEditor.magic_hint')}</span>

            <div className="w-px h-6 bg-border mx-2" />

            <div className="flex items-center space-x-2">
              <Switch
                id="contiguous-mode"
                checked={isContiguous}
                onCheckedChange={setIsContiguous}
              />
              <Label htmlFor="contiguous-mode" className="text-xs cursor-pointer">
                {t('admin.imageEditor.contiguous')}
              </Label>
            </div>
          </div>
        )}

        {mode === 'eraser' && (
          <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-lg">
            <span className="text-xs font-medium whitespace-nowrap">
              {t('admin.imageEditor.eraser_size')}
              :
              {' '}
              {eraserSize}
              {t('admin.imageEditor.pixels')}
            </span>
            <Slider
              value={eraserSize}
              onValueChange={setEraserSize}
              max={100}
              min={1}
              step={1}
              className="w-[200px]"
            />
            <span className="text-xs text-muted-foreground">{t('admin.imageEditor.eraser_hint')}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          {onClose && (
            <Button variant="outline" className="mr-2" onClick={onClose}>
              {t('admin.imageEditor.cancel')}
            </Button>
          )}
          {isLocalFile && enableLocalFeatures && (
            <Button
              variant="outline"
              className="mr-2"
              onClick={() => setShowSaveAsDialog(true)}
              disabled={isProcessing}
            >
              <Copy className="w-4 h-4 mr-2" />
              {t('admin.imageEditor.save_as')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {t('admin.imageEditor.save_image')}
          </Button>
        </div>

        {/* Image Format and Quality Settings */}
        {isLocalFile && enableLocalFeatures && (
          <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg mt-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">{t('admin.imageEditor.format')}</Label>
              <select
                value={saveOptions.format}
                onChange={e => setSaveOptions(prev => ({
                  ...prev,
                  format: e.target.value as 'png' | 'jpeg',
                  preserveTransparency: e.target.value === 'png',
                }))}
                className="text-xs bg-background border border-border rounded px-2 py-1"
              >
                <option value="png">{t('admin.imageEditor.png_with_transparency')}</option>
                <option value="jpeg">{t('admin.imageEditor.jpeg_smaller_file')}</option>
              </select>
            </div>

            {saveOptions.format === 'jpeg' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium">
                  {t('admin.imageEditor.quality')}
                  {Math.round(saveOptions.quality * 100)}
                  %
                </Label>
                <Slider
                  value={[saveOptions.quality * 100]}
                  onValueChange={value => setSaveOptions(prev => ({ ...prev, quality: value[0] / 100 }))}
                  max={100}
                  min={10}
                  step={5}
                  className="w-[120px]"
                />
              </div>
            )}

            {hasTransparency && saveOptions.format === 'jpeg' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="preserve-transparency"
                  checked={saveOptions.preserveTransparency}
                  onCheckedChange={checked => setSaveOptions(prev => ({ ...prev, preserveTransparency: checked }))}
                />
                <Label htmlFor="preserve-transparency" className="text-xs cursor-pointer">
                  {t('admin.imageEditor.white_background_jpeg')}
                </Label>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {t('admin.imageEditor.original')}
              {' '}
              {originalFormat.toUpperCase()}
              {hasTransparency && ' (has transparency)'}
            </div>
          </div>
        )}
      </div>
    </>
  )

  // Return inline version if inline prop is true
  if (inline) {
    return (
      <>
        <div className="flex flex-col h-full overflow-hidden bg-background">
          {editorContent}
        </div>

        {/* Save As Dialog */}
        <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('admin.imageEditor.save_as')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filename">{t('admin.imageEditor.filename')}</Label>
                <Input
                  id="filename"
                  value={saveAsFilename}
                  onChange={e => setSaveAsFilename(e.target.value)}
                  placeholder={t('admin.imageEditor.filename_placeholder')}
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">{t('admin.imageEditor.format')}</Label>
                  <select
                    value={saveOptions.format}
                    onChange={e => setSaveOptions(prev => ({
                      ...prev,
                      format: e.target.value as 'png' | 'jpeg',
                      preserveTransparency: e.target.value === 'png',
                    }))}
                    className="text-sm bg-background border border-border rounded px-2 py-1"
                  >
                    <option value="png">{t('admin.imageEditor.png_with_transparency')}</option>
                    <option value="jpeg">{t('admin.imageEditor.jpeg_smaller_file')}</option>
                  </select>
                </div>

                {saveOptions.format === 'jpeg' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">
                        {t('admin.imageEditor.quality')}
                        {Math.round(saveOptions.quality * 100)}
                        %
                      </Label>
                      <Slider
                        value={[saveOptions.quality * 100]}
                        onValueChange={value => setSaveOptions(prev => ({ ...prev, quality: value[0] / 100 }))}
                        max={100}
                        min={10}
                        step={5}
                        className="flex-1"
                      />
                    </div>

                    {hasTransparency && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="preserve-transparency-dialog"
                          checked={!saveOptions.preserveTransparency}
                          onCheckedChange={checked => setSaveOptions(prev => ({ ...prev, preserveTransparency: !checked }))}
                        />
                        <Label htmlFor="preserve-transparency-dialog" className="text-sm cursor-pointer">
                          {t('admin.imageEditor.convert_transparency_to_white')}
                        </Label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveAsDialog(false)}
                  disabled={isProcessing}
                >
                  {t('admin.imageEditor.cancel')}
                </Button>
                <Button
                  onClick={handleSaveAs}
                  disabled={isProcessing || !saveAsFilename.trim()}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('admin.imageEditor.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Return modal version (existing behavior)
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-[95vw] max-h-[95vh] h-[90vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle>{t('admin.imageEditor.title')}</DialogTitle>
          </DialogHeader>
          {editorContent}
        </DialogContent>
      </Dialog>

      {/* Save As Dialog */}
      <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.imageEditor.save_as')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filename">{t('admin.imageEditor.filename')}</Label>
              <Input
                id="filename"
                value={saveAsFilename}
                onChange={e => setSaveAsFilename(e.target.value)}
                placeholder={t('admin.imageEditor.filename_placeholder')}
                className="mt-1"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{t('admin.imageEditor.format')}</Label>
                <select
                  value={saveOptions.format}
                  onChange={e => setSaveOptions(prev => ({
                    ...prev,
                    format: e.target.value as 'png' | 'jpeg',
                    preserveTransparency: e.target.value === 'png',
                  }))}
                  className="text-sm bg-background border border-border rounded px-2 py-1"
                >
                  <option value="png">{t('admin.imageEditor.png_with_transparency')}</option>
                  <option value="jpeg">{t('admin.imageEditor.jpeg_smaller_file')}</option>
                </select>
              </div>

              {saveOptions.format === 'jpeg' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">
                      {t('admin.imageEditor.quality')}
                      {Math.round(saveOptions.quality * 100)}
                      %
                    </Label>
                    <Slider
                      value={[saveOptions.quality * 100]}
                      onValueChange={value => setSaveOptions(prev => ({ ...prev, quality: value[0] / 100 }))}
                      max={100}
                      min={10}
                      step={5}
                      className="flex-1"
                    />
                  </div>

                  {hasTransparency && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="preserve-transparency-modal-dialog"
                        checked={!saveOptions.preserveTransparency}
                        onCheckedChange={checked => setSaveOptions(prev => ({ ...prev, preserveTransparency: !checked }))}
                      />
                      <Label htmlFor="preserve-transparency-modal-dialog" className="text-sm cursor-pointer">
                        {t('admin.imageEditor.convert_transparency_to_white')}
                      </Label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveAsDialog(false)}
                disabled={isProcessing}
              >
                {t('admin.imageEditor.cancel')}
              </Button>
              <Button
                onClick={handleSaveAs}
                disabled={isProcessing || !saveAsFilename.trim()}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('admin.imageEditor.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
