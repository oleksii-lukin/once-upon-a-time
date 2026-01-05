'use client'

import { useUploadThing } from '@/lib/uploadthing'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  onRemove?: () => void
  label?: string
  className?: string
}

export default function ImageUpload({ value, onChange, onRemove, label, className }: ImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(3 / 4) // Default to card ratio (3:4)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { t } = useTranslation()

  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res: any) => {
      if (res && res[0]) {
        onChange(res[0].url)
      }
    },
    onUploadError: (error: Error) => {
      alert(t('admin.deckEditor.imageUpload.uploadFailed', { error: error.message }))
    },
  })

  // Reset aspect ratio when value changes (optional, but good practice to reset to default or let next image update it)
  // However, keeping previous ratio prevents layout jump if replacing with same-ratio image.
  // We'll rely on onLoadingComplete to update it.

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      await startUpload(files)
    }
  }, [startUpload])

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      // console.log("Files selected:", files)
      await startUpload(files)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {value
        ? (
          <div className="relative group">
            <div
              className="relative rounded-lg overflow-hidden border-2 border-white/10 bg-background h-[266px] w-auto"
              style={{ aspectRatio: aspectRatio }}
            >
              <Image
                src={value}
                alt={t('admin.deckEditor.imageUpload.uploadedImageAlt')}
                fill
                className="object-cover"
                sizes="(max-height: 266px) 100vw, 266px"
                onLoadingComplete={(img) => {
                  if (img.naturalWidth && img.naturalHeight) {
                    setAspectRatio(img.naturalWidth / img.naturalHeight)
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => {
                    onChange('')
                    onRemove?.()
                  }}
                  className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-white/50 mt-2">{t('admin.deckEditor.imageUpload.hoverToRemove')}</p>
          </div>
        )
        : (
          <div className="space-y-2">
            <div
              className={`relative border-2 border-dashed ${isDragActive || isUploading ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/20'} rounded-lg p-8 bg-background hover:bg-muted/50 transition-colors cursor-pointer w-full flex flex-col items-center justify-center gap-3`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={triggerFileInput}
            >
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
              />

              <div className={`p-4 rounded-full ${isDragActive || isUploading ? 'bg-yellow-500/20 animate-pulse' : 'bg-primary/10'}`}>
                {isUploading
                  ? <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                  : <ImageIcon className={`w-8 h-8 ${isDragActive ? 'text-yellow-500' : 'text-primary'}`} />
                }
              </div>

              <div className="text-center">
                <p className="text-white font-medium mb-1">
                  {isUploading
                    ? t('admin.deckEditor.imageUpload.uploading')
                    : (label || t('admin.deckEditor.imageUpload.uploadCardImage'))
                  }
                </p>
                <p className="text-white/50 text-sm">{t('admin.deckEditor.imageUpload.fileSizeLimit')}</p>
              </div>

              {!isUploading && (
                <button
                  type="button"
                  className="bg-primary hover:bg-primary/90 text-white font-medium px-6 py-2 rounded-lg transition-colors mt-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    triggerFileInput()
                  }}
                >
                  {t('admin.deckEditor.imageUpload.chooseImage')}
                </button>
              )}
            </div>
            <p className="text-xs text-white/40">
              {t('admin.deckEditor.imageUpload.orPasteImageUrl')}
            </p>
          </div>
        )}
    </div>
  )
}
