'use client'

import { useEffect, useState, useCallback } from 'react'
import { ClockIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TimerDisplayProps {
  isEnabled: boolean
  duration: number // in seconds
  isMyTurn: boolean
  isAnyonesTurn: boolean // true if it's anyone's turn (not spectator)
  onTimeExpire?: () => void
  onTimerStart?: () => void
  className?: string
  // Timer sync data from database
  timerStartedAt?: string | null
  timerExpiresAt?: string | null
}

export default function TimerDisplay({
  isEnabled,
  duration,
  isMyTurn,
  isAnyonesTurn,
  onTimeExpire,
  onTimerStart,
  className = '',
  timerStartedAt,
  timerExpiresAt,
}: TimerDisplayProps) {
  const { t } = useTranslation()
  const [timeLeft, setTimeLeft] = useState<number>(duration)

  // Calculate time left based on database timestamps
  const calculateTimeLeft = useCallback(() => {
    if (!isEnabled || !timerExpiresAt) {
      return duration
    }

    const now = new Date().getTime()
    const expires = new Date(timerExpiresAt).getTime()
    const remaining = Math.max(0, Math.ceil((expires - now) / 1000))

    return remaining
  }, [isEnabled, timerExpiresAt, duration])

  // Update time left every second
  useEffect(() => {
    if (!isEnabled || !timerExpiresAt) {
      setTimeout(() => setTimeLeft(duration), 0)
      return
    }

    // Initial calculation
    setTimeout(() => setTimeLeft(calculateTimeLeft()), 0)

    // Update every second
    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)
    }, 1000)

    return () => clearInterval(interval)
  }, [isEnabled, timerExpiresAt, duration, calculateTimeLeft])

  const isActive = isEnabled && isAnyonesTurn && timerExpiresAt && new Date(timerExpiresAt).getTime() > new Date().getTime()

  // Handle timer expiration
  useEffect(() => {
    if (!isActive || timeLeft > 0) return

    // Only call onTimeExpire if it's my turn and timer expired
    if (isMyTurn) {
      onTimeExpire?.()
    }
  }, [isActive, timeLeft, isMyTurn, onTimeExpire])

  if (!isEnabled) return null

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isWarning = timeLeft <= 10 && timeLeft > 0
  const isExpired = timeLeft === 0

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-lg border ${className} ${
        isExpired ? 'border-red-500' : isWarning ? 'border-yellow-500' : 'border-gray-600'
      }`}
    >
      <ClockIcon
        className={`w-5 h-5 ${
          isExpired ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-300'
        }`}
      />
      <span
        className={`font-mono font-semibold ${
          isExpired ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-200'
        }`}
      >
        {formatTime(timeLeft)}
      </span>
      {!isAnyonesTurn && (
        <span className="text-xs text-gray-400 ml-1">{t('waiting')}</span>
      )}
      {isAnyonesTurn && !isMyTurn && (
        <span className="text-xs text-blue-400 ml-1">{t('their_turn')}</span>
      )}
    </div>
  )
}
