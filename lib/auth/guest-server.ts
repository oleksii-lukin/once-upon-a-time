import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

const GUEST_ID_COOKIE = 'ouat_guest_id'

export async function getServerGuestId(): Promise<string> {
  const cookieStore = await cookies()
  let guestId = cookieStore.get(GUEST_ID_COOKIE)?.value

  if (!guestId) {
    guestId = uuidv4()
    cookieStore.set(GUEST_ID_COOKIE, guestId, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  return guestId
}
