import { notFound } from 'next/navigation'

export default function CatchAllPage() {
  notFound() // This manually triggers the closest not-found.tsx
}
