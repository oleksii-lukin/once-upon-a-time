'use client'

import { UploadButton } from '@uploadthing/react'
import { OurFileRouter } from '@/app/api/uploadthing/core'
import { X, User } from 'lucide-react'

interface AvatarUploadProps {
  value?: string
  onChange: (url: string) => void
  onRemove?: () => void
}

export default function AvatarUpload({ value, onChange, onRemove }: AvatarUploadProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        {value
          ? (
              <div className="relative">
                <div
                  className="size-32 rounded-full bg-cover bg-center ring-4 ring-primary/20"
                  style={{ backgroundImage: `url("${value}")` }}
                />
                <button
                  onClick={() => {
                    onChange('')
                    onRemove?.()
                  }}
                  className="absolute -top-1 -right-1 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors opacity-0 group-hover:opacity-100"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          : (
              <div className="size-32 rounded-full bg-white/10 flex items-center justify-center ring-4 ring-white/5">
                <User className="w-12 h-12 text-white/40" />
              </div>
            )}
      </div>

      <UploadButton<OurFileRouter, 'imageUploader'>
        endpoint="imageUploader"
        onClientUploadComplete={(res) => {
          if (res && res[0]) {
            onChange(res[0].url)
          }
        }}
        onUploadError={(error: Error) => {
          alert(`Upload failed: ${error.message}`)
        }}
        appearance={{
          button: 'bg-primary/20 hover:bg-primary/30 text-primary font-medium px-4 py-2 rounded-lg transition-colors ut-ready:bg-primary/20 ut-uploading:bg-primary/10 ut-uploading:cursor-not-allowed text-sm',
          container: 'flex flex-col items-center',
          allowedContent: 'hidden',
        }}
        content={{
          button({ ready, isUploading }) {
            if (isUploading) return 'Uploading...'
            if (ready) return value ? 'Change Photo' : 'Upload Photo'
            return 'Getting ready...'
          },
        }}
      />
    </div>
  )
}
