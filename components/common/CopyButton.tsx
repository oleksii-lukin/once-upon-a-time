'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Copy as CopyIcon, Check as CheckIcon } from 'lucide-react'

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  durationMs?: number
  side?: React.ComponentProps<typeof TooltipContent>['side']
}

export default function CopyButton({
  value,
  label = 'Copied!',
  className,
  variant = 'ghost',
  size = 'icon',
  durationMs = 1200,
  side = 'top',
}: CopyButtonProps) {
  const [open, setOpen] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || '')
      setOpen(true)
      window.setTimeout(() => setOpen(false), durationMs)
    }
    catch {
      // silently ignore; optionally extend to show error variant
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className={`border border-border ${className ?? ''}`}
            onClick={handleCopy}
          >
            {
              open
                ? <CheckIcon className="w-5 h-5 text-green-400" />
                : <CopyIcon className="w-5 h-5" />
            }
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
