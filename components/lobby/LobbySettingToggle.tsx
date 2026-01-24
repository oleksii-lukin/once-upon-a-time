'use client'

import { Info as InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface LobbySettingToggleProps {
  label: string
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  infoText?: string
  htmlFor?: string
}

export default function LobbySettingToggle({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  infoText,
  htmlFor,
}: LobbySettingToggleProps) {
  const labelElement = (
    <label
      className={
        checked && !disabled
          ? 'text-foreground text-base font-medium leading-normal'
          : 'text-muted-foreground text-base font-medium leading-normal'
      }
      htmlFor={htmlFor}
    >
      {label}
    </label>
  )

  const labelWithInfo = infoText
    ? (
        <div className="flex items-center gap-2">
          {labelElement}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground transition-colors">
                  <InfoIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{infoText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    : labelElement

  return (
    <div className="flex items-center justify-between py-2">
      {labelWithInfo}
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
