'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard as LayoutDashboardIcon,
  Palette as PaletteIcon,
  Users as UsersIcon,
  DoorOpen as DoorOpenIcon,
  Settings as SettingsIcon,
  Brain as BrainIcon,
  ChevronLeft,
  Menu,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface NavItemProps {
  href: string
  label: string
  icon: React.ElementType
  lng: string
  isCollapsed: boolean
}

function NavItem({ href, label, icon: Icon, isCollapsed }: NavItemProps) {
  const pathname = usePathname()
  const isExactActive = pathname === href

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[40px]',
        isExactActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        isCollapsed ? 'justify-center px-2' : '',
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{label}</span>}
    </Link>
  )
}

export default function AdminSidebar({ lng }: { lng: string }) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out relative',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn(
        'flex h-16 items-center px-4 border-b border-border/50',
        isCollapsed ? 'justify-center' : 'justify-between',
      )}
      >
        {!isCollapsed && (
          <h1 className="text-foreground text-lg font-bold truncate pr-2">
            {t('title')}
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <NavItem href={`/${lng}/admin`} label={t('dashboard')} icon={LayoutDashboardIcon} lng={lng} isCollapsed={isCollapsed} />
        <NavItem href={`/${lng}/admin/decks`} label={t('decks')} icon={PaletteIcon} lng={lng} isCollapsed={isCollapsed} />
        <NavItem href={`/${lng}/admin/players`} label={t('players')} icon={UsersIcon} lng={lng} isCollapsed={isCollapsed} />
        <NavItem href={`/${lng}/admin/lobbies`} label={t('lobbies')} icon={DoorOpenIcon} lng={lng} isCollapsed={isCollapsed} />
        <NavItem href={`/${lng}/admin/ai`} label={t('ai')} icon={BrainIcon} lng={lng} isCollapsed={isCollapsed} />
        <NavItem href={`/${lng}/admin/settings`} label={t('settings')} icon={SettingsIcon} lng={lng} isCollapsed={isCollapsed} />
      </nav>

      <div className="p-4 border-t border-border/50 text-xs text-muted-foreground text-center">
        {!isCollapsed ? 'v0.1.0' : 'v0.1'}
      </div>
    </aside>
  )
}
