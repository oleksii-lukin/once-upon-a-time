'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Crop, Wand2, Undo, Save, Loader2, X, RefreshCw, Scissors } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ImageEditorProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  onSave: (file: File) => Promise<void>
}

export default function ImageEditor({ isOpen, onClose, imageUrl, onSave }: ImageEditorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'view' | 'crop' | 'magic'>('view')
  const [tolerance, setTolerance] = useState([30])
  const [isProcessing, setIsProcessing] = useState(false)
  const [imageHistory, setImageHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isContiguous, setIsContiguous] = useState(true)

  // Crop state
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null)
  const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null)

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || !imageUrl) return

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
        ctx.drawImage(img, 0, 0)

        // Initialize history
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setImageHistory([initialData])
        setHistoryIndex(0)
        // console.log("Image loaded successfully:", img.naturalWidth, "x", img.naturalHeight)
      }

      img.onerror = (e) => {
        console.error('Failed to load image for editing', e)
        console.error('Failed to load image for editing', e)
        alert(t('admin.imageEditor.error_loading'))
      }
    }

    initCanvas()

    return () => {
      // Cleanup if needed
      setImageHistory([])
      setHistoryIndex(-1)
    }
  }, [isOpen, imageUrl])

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
  }

  const handleMouseUp = () => {
    setCropStart(null)
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

    canvasRef.current.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'edited_image.png', { type: 'image/png' })
        await onSave(file)
        onClose()
      }
      setIsProcessing(false)
    }, 'image/png')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-[95vw] max-h-[95vh] h-[90vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle>{t('admin.imageEditor.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 bg-muted/20 relative flex items-center justify-center min-h-[400px]">
          {/* Canvas */}
          <div className="relative shadow-lg border border-border/50 bg-[#333] checkered-bg">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[60vh] object-contain cursor-crosshair"
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
                  left: (cropRect.x / (canvasRef.current?.width || 1)) * 100 + '%',
                  top: (cropRect.y / (canvasRef.current?.height || 1)) * 100 + '%',
                  width: (cropRect.w / (canvasRef.current?.width || 1)) * 100 + '%',
                  height: (cropRect.h / (canvasRef.current?.height || 1)) * 100 + '%',
                }}
              />
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

          <div className="flex justify-end pt-2">
            <Button variant="outline" className="mr-2" onClick={onClose}>{t('admin.imageEditor.cancel')}</Button>
            <Button onClick={handleSave} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {t('admin.imageEditor.save_image')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
