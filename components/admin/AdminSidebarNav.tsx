'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard as LayoutDashboardIcon,
  Palette as PaletteIcon,
  Users as UsersIcon,
  DoorOpen as DoorOpenIcon,
  Settings as SettingsIcon,
} from 'lucide-react'

interface NavItemProps {
  href: string
  label: string
  icon: React.ElementType
  lng: string
}

function NavItem({ href, label, icon: Icon, lng }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname === `/${lng}${href}` || (href === `/${lng}/admin` && pathname === `/${lng}/admin`)

  // Special case for dashboard vs subpages
  const isExactActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        isExactActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

export default function AdminSidebarNav({ lng, translations }: { lng: string, translations: any }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <NavItem href={`/${lng}/admin`} label={translations.dashboard} icon={LayoutDashboardIcon} lng={lng} />
      <NavItem href={`/${lng}/admin/decks`} label={translations.decks} icon={PaletteIcon} lng={lng} />
      <NavItem href={`/${lng}/admin/players`} label={translations.players} icon={UsersIcon} lng={lng} />
      <NavItem href={`/${lng}/admin/lobbies`} label={translations.lobbies} icon={DoorOpenIcon} lng={lng} />
      <NavItem href={`/${lng}/admin/settings`} label={translations.settings} icon={SettingsIcon} lng={lng} />
    </nav>
  )
}
