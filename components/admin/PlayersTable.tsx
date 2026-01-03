import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar"

interface Player {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  total_games_played: number
  total_games_won: number
  created_at: string
}

interface PlayersTableProps {
  players: Player[]
  translations: any
}

export function PlayersTable({ players, translations }: PlayersTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">{translations.avatar || 'Avatar'}</TableHead>
            <TableHead>{translations.display_name || 'Display Name'}</TableHead>
            <TableHead>{translations.games_played || 'Games Played'}</TableHead>
            <TableHead>{translations.games_won || 'Games Won'}</TableHead>
            <TableHead className="text-right">{translations.joined || 'Joined'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.user_id}>
              <TableCell>
                <div className="size-8 rounded-full overflow-hidden bg-muted">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.display_name || ''} className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-xs font-bold">
                      {(player.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">{player.display_name || player.user_id}</TableCell>
              <TableCell>{player.total_games_played}</TableCell>
              <TableCell>{player.total_games_won}</TableCell>
              <TableCell className="text-right">
                {new Date(player.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
          {players.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                {translations.no_players_found || 'No players found.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
