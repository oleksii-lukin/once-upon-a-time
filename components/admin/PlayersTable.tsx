'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type UserProfile } from '@/types/model'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

interface PlayersTableProps {
  players: UserProfile[]
}

export function PlayersTable({ players }: PlayersTableProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">{t('admin.playersTable.avatar')}</TableHead>
            <TableHead>{t('admin.playersTable.displayName')}</TableHead>
            <TableHead>{t('admin.playersTable.gamesPlayed')}</TableHead>
            <TableHead>{t('admin.playersTable.gamesWon')}</TableHead>
            <TableHead className="text-right">{t('admin.playersTable.joined')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map(player => (
            <TableRow key={player.user_id}>
              <TableCell>
                <div className="size-8 rounded-full overflow-hidden bg-muted relative">
                  {player.avatar_url
                    ? (
                        <Image
                          src={player.avatar_url}
                          alt={player.display_name || ''}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      )
                    : (
                        <div className="size-full flex items-center justify-center text-xs font-bold">
                          {(player.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                </div>
              </TableCell>
              <TableCell className="font-medium">{player.display_name || player.user_id}</TableCell>
              <TableCell>{player.total_games_played || 0}</TableCell>
              <TableCell>{player.total_games_won || 0}</TableCell>
              <TableCell className="text-right">
                {new Date(player.created_at).toLocaleDateString('en-US')}
              </TableCell>
            </TableRow>
          ))}
          {players.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                {t('admin.playersTable.noPlayersFound')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
