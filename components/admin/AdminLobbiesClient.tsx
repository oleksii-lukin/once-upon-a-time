'use client'

import { useState } from 'react'
import { X as CrossIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/app/i18n/client'

type Lobby = Database['public']['Tables']['lobbies']['Row'] & {
  players: { count: number }[]
}

interface AdminLobbiesClientProps {
  lobbies: Lobby[]
  lng: string
}

type FilterStatus = 'all' | 'active' | 'archived'

export default function AdminLobbiesClient({ lobbies: initialLobbies, lng }: AdminLobbiesClientProps) {
  const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedLobby, setSelectedLobby] = useState<Lobby | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { t } = useTranslation(lng, 'common')

  const filteredLobbies = lobbies.filter((lobby) => {
    if (filter === 'active') return !lobby.deleted_at
    if (filter === 'archived') return !!lobby.deleted_at
    return true
  })

  const getStatusBadge = (lobby: Lobby) => {
    if (lobby.deleted_at) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
          Archived
        </span>
      )
    }
    switch (lobby.status) {
      case 'playing':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            Playing
          </span>
        )
      case 'finished':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
            Finished
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            Waiting
          </span>
        )
    }
  }

  const handlePermanentDelete = async (lobbyId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this lobby? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('lobbies')
        .delete()
        .eq('id', lobbyId)

      if (error) {
        console.error('Error deleting lobby:', error)
        alert('Failed to delete lobby: ' + error.message)
      }
      else {
        setLobbies(prev => prev.filter(l => l.id !== lobbyId))
        setSelectedLobby(null)
      }
    }
    finally {
      setIsDeleting(false)
    }
  }

  const handleArchive = async (lobbyId: string) => {
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('lobbies')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lobbyId)

      if (error) {
        console.error('Error archiving lobby:', error)
        alert('Failed to archive lobby: ' + error.message)
      }
      else {
        setLobbies(prev => prev.map(l =>
          l.id === lobbyId ? { ...l, deleted_at: new Date().toISOString() } : l,
        ))
        if (selectedLobby?.id === lobbyId) {
          setSelectedLobby({ ...selectedLobby, deleted_at: new Date().toISOString() })
        }
      }
    }
    finally {
      setIsDeleting(false)
    }
  }

  const handleRestore = async (lobbyId: string) => {
    setIsRestoring(true)
    try {
      const { error } = await supabase
        .from('lobbies')
        .update({ deleted_at: null })
        .eq('id', lobbyId)

      if (error) {
        console.error('Error restoring lobby:', error)
        alert('Failed to restore lobby: ' + error.message)
      }
      else {
        setLobbies(prev => prev.map(l =>
          l.id === lobbyId ? { ...l, deleted_at: null } : l,
        ))
        if (selectedLobby?.id === lobbyId) {
          setSelectedLobby({ ...selectedLobby, deleted_at: null })
        }
      }
    }
    finally {
      setIsRestoring(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Lobby List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex gap-2 px-8 py-4 border-b border-white/10">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
              ? 'bg-primary text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            All (
            {lobbies.length}
            )
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'active'
              ? 'bg-primary text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Active (
            {lobbies.filter(l => !l.deleted_at).length}
            )
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'archived'
              ? 'bg-primary text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Archived (
            {lobbies.filter(l => l.deleted_at).length}
            )
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-8">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#141118]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#211c27] text-left">
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Name</th>
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Code</th>
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Players</th>
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Status</th>
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Created</th>
                  <th className="px-6 py-3 text-sm font-medium text-white/70">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredLobbies.map(lobby => (
                  <tr
                    key={lobby.id}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedLobby?.id === lobby.id ? 'bg-white/10' : ''
                    }`}
                    onClick={() => setSelectedLobby(lobby)}
                  >
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {lobby.name}
                      {lobby.deleted_at && (
                        <span className="ml-2 text-white/30">(archived)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60 font-mono">
                      {lobby.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {lobby.players?.[0]?.count || 0}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(lobby)}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {formatDate(lobby.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLobby(lobby)
                        }}
                        className="text-primary hover:text-primary/80 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLobbies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-white/40">
                      No lobbies found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedLobby && (
        <div className="w-96 border-l border-white/10 bg-[#1a1520] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-white font-bold">Lobby Details</h2>
            <button
              onClick={() => setSelectedLobby(null)}
              className="text-white/50 hover:text-white"
            >
              <CrossIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-white/50 text-xs font-medium uppercase mb-2">Info</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/50 text-xs">Name</label>
                    <p className="text-white font-medium">{selectedLobby.name}</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">Code</label>
                    <p className="text-white font-mono">{selectedLobby.code}</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedLobby)}</div>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">Language</label>
                    <p className="text-white">{selectedLobby.language.toUpperCase()}</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">Players</label>
                    <p className="text-white">{selectedLobby.players?.[0]?.count || 0}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-white/50 text-xs font-medium uppercase mb-2">Timestamps</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/50 text-xs">Created</label>
                    <p className="text-white text-sm">{formatDate(selectedLobby.created_at)}</p>
                  </div>
                  {selectedLobby.deleted_at && (
                    <div>
                      <label className="text-white/50 text-xs">Archived</label>
                      <p className="text-white text-sm">{formatDate(selectedLobby.deleted_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-white/50 text-xs font-medium uppercase mb-2">Settings</h3>
                <pre className="text-xs text-white/70 bg-white/5 p-3 rounded-lg overflow-auto max-h-40">
                  {JSON.stringify(selectedLobby.settings, null, 2)}
                </pre>
              </div>

              {/* IDs */}
              <div>
                <h3 className="text-white/50 text-xs font-medium uppercase mb-2">IDs</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-white/50 text-xs">Lobby ID</label>
                    <p className="text-white/60 text-xs font-mono break-all">{selectedLobby.id}</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">Created By</label>
                    <p className="text-white/60 text-xs font-mono break-all">{selectedLobby.created_by}</p>
                  </div>
                  {selectedLobby.deck_id && (
                    <div>
                      <label className="text-white/50 text-xs">Deck ID</label>
                      <p className="text-white/60 text-xs font-mono break-all">{selectedLobby.deck_id}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-white/10 space-y-3">
            {selectedLobby.deleted_at
              ? (
                  <>
                    <button
                      onClick={() => handleRestore(selectedLobby.id)}
                      disabled={isRestoring}
                      className="w-full py-2 px-4 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {isRestoring ? 'Restoring...' : 'Restore Lobby'}
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(selectedLobby.id)}
                      disabled={isDeleting}
                      className="w-full py-2 px-4 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                  </>
                )
              : (
                  <button
                    onClick={() => handleArchive(selectedLobby.id)}
                    disabled={isDeleting}
                    className="w-full py-2 px-4 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Archiving...' : 'Archive Lobby'}
                  </button>
                )}
          </div>
        </div>
      )}
    </div>
  )
}
