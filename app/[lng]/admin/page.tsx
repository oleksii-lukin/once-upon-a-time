import { redirect } from 'next/navigation'

export default async function AdminPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  redirect(`/${lng}/admin/decks`)
}
