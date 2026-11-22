import { v4 as uuidv4 } from 'uuid'

const GUEST_ID_COOKIE = 'ouat_guest_id'
const GUEST_SECRET_COOKIE = 'ouat_guest_secret'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

export function getGuestId(): string {
  if (typeof window === 'undefined') return ''

  let guestId = getCookie(GUEST_ID_COOKIE)
  if (!guestId) {
    guestId = uuidv4()
    setCookie(GUEST_ID_COOKIE, guestId)
  }

  // The guest identity consists of BOTH cookies: the public id and the
  // secret that server actions hash into players.guest_secret_hash.
  // Seeding the secret here (before any action is dispatched) keeps
  // concurrent first actions from each generating a different secret —
  // the server only falls back to generating one for non-browser callers.
  if (!getCookie(GUEST_SECRET_COOKIE)) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const secret = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    setCookie(GUEST_SECRET_COOKIE, secret)
  }

  return guestId
}

export function clearGuestId() {
  if (typeof document === 'undefined') return
  document.cookie = `${GUEST_ID_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
  document.cookie = `${GUEST_SECRET_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}
