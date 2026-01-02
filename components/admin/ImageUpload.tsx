'use client'

import { UploadButton } from '@uploadthing/react'
import { OurFileRouter } from '@/app/api/uploadthing/core'
import { X, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  onRemove?: () => void
}

export default function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {value
        ? (
            <div className="relative group">
              <div className="relative rounded-lg overflow-hidden border-2 border-white/10 bg-background aspect-3/4 max-w-[200px]">
                <Image
                  src={value}
                  alt={t('admin.deckEditor.imageUpload.uploadedImageAlt')}
                  fill
                  className="object-cover"
                  sizes="(max-width: 200px) 100vw, 200px"
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
              <div className="relative">
                <div className={`border-2 border-dashed ${isUploading ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/20'} rounded-lg p-8 bg-background hover:bg-muted/50 transition-colors`}>
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className={`p-4 rounded-full ${isUploading ? 'bg-yellow-500/20 animate-pulse' : 'bg-primary/10'}`}>
                      <ImageIcon className={`w-8 h-8 ${isUploading ? 'text-yellow-500' : 'text-primary'}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium mb-1">{t('admin.deckEditor.imageUpload.uploadCardImage')}</p>
                      <p className="text-white/50 text-sm">{t('admin.deckEditor.imageUpload.fileSizeLimit')}</p>
                    </div>
                    <UploadButton<OurFileRouter, 'imageUploader'>
                      endpoint="imageUploader"
                      onClientUploadComplete={(res) => {
                        if (res && res[0]) {
                          onChange(res[0].url)
                          setIsUploading(false)
                        }
                      }}
                      onUploadError={(error: Error) => {
                        alert(t('admin.deckEditor.imageUpload.uploadFailed', { error: error.message }))
                        setIsUploading(false)
                      }}
                      onUploadBegin={() => {
                        setIsUploading(true)
                      }}
                      appearance={{
                        button: 'bg-primary hover:bg-primary/90 text-white font-medium px-6 py-2 rounded-lg transition-colors ut-ready:bg-primary ut-uploading:bg-primary/50 ut-uploading:cursor-not-allowed',
                        container: 'flex flex-col items-center gap-2',
                        allowedContent: 'hidden',
                      }}
                      content={{
                        button({ ready, isUploading }) {
                          if (isUploading) return t('admin.deckEditor.imageUpload.uploading')
                          if (ready) return t('admin.deckEditor.imageUpload.chooseImage')
                          return t('admin.deckEditor.imageUpload.gettingReady')
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/40">
                {t('admin.deckEditor.imageUpload.orPasteImageUrl')}
              </p>
            </div>
          )}
    </div>
  )
}
