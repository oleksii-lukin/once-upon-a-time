import { ReactNode } from 'react'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children, params }: { children: ReactNode, params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { userId } = await auth()

  if (!userId) {
    redirect(`/${lng}/sign-in`)
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const isAdmin = user.publicMetadata.is_admin

  if (!isAdmin) {
    redirect(`/${lng}/access-denied`)
  }

  return (
    <div className="relative flex h-screen w-full bg-background overflow-hidden">
      <AdminSidebar
        lng={lng}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
