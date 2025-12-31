import Link from 'next/link'
import { ReactNode } from 'react'
import { getTranslation } from '@/app/i18n/server'
import {
  LayoutDashboard as LayoutDashboardIcon,
  Palette as PaletteIcon,
  Users as UsersIcon,
  DoorOpen as DoorOpenIcon,
  Settings as SettingsIcon,
} from 'lucide-react'

export default async function AdminLayout({ children, params }: { children: ReactNode, params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return (
    <div className="relative flex h-screen w-full bg-background overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-border bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-foreground text-lg font-bold">{t('storycraft_admin')}</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link href={`/${lng}/admin`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <LayoutDashboardIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('dashboard')}</span>
          </Link>
          <Link href={`/${lng}/admin/decks`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted text-foreground">
            <PaletteIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('decks')}</span>
          </Link>
          <Link href={`/${lng}/admin/players`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <UsersIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('players')}</span>
          </Link>
          <Link href={`/${lng}/admin/lobbies`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <DoorOpenIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('lobbies')}</span>
          </Link>
          <Link href={`/${lng}/admin/settings`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('settings')}</span>
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
