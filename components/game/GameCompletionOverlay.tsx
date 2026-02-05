'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import confetti from 'canvas-confetti'
import { Trophy, BarChart3, ArrowLeft } from 'lucide-react'
import { type Player } from '@/types/model'
import { PlayerAvatar } from '../lobby/PlayerDisplay'

interface GameCompletionOverlayProps {
  winner: Player | undefined
  players: Player[]
  cardsPlayedCount: Record<string, number>
  onReturnToLobbies: () => void
}

export default function GameCompletionOverlay({
  winner,
  players,
  cardsPlayedCount,
  onReturnToLobbies,
}: GameCompletionOverlayProps) {
  const { t } = useTranslation()

  useEffect(() => {
    // Fire confetti!
    const duration = 5 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="max-w-2xl w-full mx-4 bg-background-dark/90 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-yellow-500 to-transparent" />
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

        <div className="mb-6 flex flex-col items-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 border border-yellow-500/30 animate-bounce">
            <Trophy className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 text-center tracking-tight">
            {t('game.congratulations')}
          </h1>
          <p className="text-xl text-white/60 text-center">
            {t('game.winner_is', { name: winner?.display_name || t('game.unknown_player') })}
          </p>
        </div>

        {/* Winner Card */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 flex items-center gap-6">
          <div className="relative">
            <div className="border-2 border-yellow-500 rounded-full">
              <PlayerAvatar player={winner!} size="lg" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black p-1 rounded-full shadow-lg">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">
              {winner?.display_name || t('game.unknown_player')}
            </h2>
            <div className="flex gap-4 text-sm text-white/60">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4" />
                <span>
                  {cardsPlayedCount[winner?.id || ''] || 0}
                  {' '}
                  {t('game.stats.cards_played')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Table */}
        <div className="w-full mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {t('game.stats.title')}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {players
              .filter(p => p.role !== 'spectator')
              .sort((a, b) => (cardsPlayedCount[b.id] || 0) - (cardsPlayedCount[a.id] || 0))
              .map(player => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${player.id === winner?.id
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={player} size="sm" />
                    <span className={`font-medium ${player.id === winner?.id ? 'text-yellow-500' : 'text-white/80'}`}>
                      {player.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="text-white">{cardsPlayedCount[player.id] || 0}</span>
                    <span className="text-white/40 font-normal">{t('game.stats.cards_played')}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            onClick={onReturnToLobbies}
            className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('game.return_to_lobbies')}
          </button>
        </div>
      </div>
    </div>
  )
}
