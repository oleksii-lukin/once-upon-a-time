'use client'

import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'

interface SaveButtonProps {
  onClick: () => void
  disabled?: boolean
  isSaving?: boolean
  isSaved?: boolean
  saveText?: string
  savingText?: string
  savedText?: string
  className?: string
  size?: 'sm' | 'default' | 'lg'
}

export default function SaveButton({
  onClick,
  disabled = false,
  isSaving = false,
  isSaved = false,
  saveText = 'Save',
  savingText = 'Saving...',
  savedText = 'Saved',
  className = '',
  size = 'default',
}: SaveButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isSaving}
      className={`min-w-[140px] ${className}`}
      size={size}
    >
      {isSaving
        ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {savingText}
            </>
          )
        : isSaved
          ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {savedText}
              </>
            )
          : (
              saveText
            )}
    </Button>
  )
}
