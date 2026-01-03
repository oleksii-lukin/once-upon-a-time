import Link from 'next/link'
import { ReactNode } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getTranslation } from '@/app/i18n/server'
import {
  LayoutDashboard as LayoutDashboardIcon,
  Palette as PaletteIcon,
  Users as UsersIcon,
  DoorOpen as DoorOpenIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import AdminSidebarNav from '@/components/admin/AdminSidebarNav'

export default async function AdminLayout({ children, params }: { children: ReactNode, params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')
  const { sessionClaims } = await auth()

  // Check if user is admin via Clerk session claims (JWT)
  // We check both the root and publicMetadata to be robust
  let isAdmin = sessionClaims?.is_admin === true ||
    sessionClaims?.is_admin === 'true' ||
    (sessionClaims?.publicMetadata as any)?.is_admin === true ||
    (sessionClaims?.publicMetadata as any)?.is_admin === 'true'

  // Fallback to currentUser() if JWT claims don't have it yet (e.g. fresh update)
  if (!isAdmin) {
    const user = await currentUser()
    const metadata = user?.publicMetadata as { is_admin?: boolean | string }
    isAdmin = metadata?.is_admin === true || metadata?.is_admin === 'true'
  }

  if (!isAdmin) {
    redirect(`/${lng}/access-denied`)
  }

  return (
    <div className="relative flex h-screen w-full bg-background overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-border bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-foreground text-lg font-bold">{t('storycraft_admin')}</h1>
        </div>
        <AdminSidebarNav
          lng={lng}
          translations={{
            dashboard: t('dashboard'),
            decks: t('decks'),
            players: t('players'),
            lobbies: t('lobbies'),
            settings: t('settings')
          }}
        />
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
