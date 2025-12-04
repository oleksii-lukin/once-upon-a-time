import { v4 as uuidv4 } from 'uuid';

const GUEST_ID_COOKIE = 'ouat_guest_id';

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

function setCookie(name: string, value: string, days: number = 365) {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

export function getGuestId(): string {
    if (typeof window === 'undefined') return '';

    let guestId = getCookie(GUEST_ID_COOKIE);
    if (!guestId) {
        guestId = uuidv4();
        setCookie(GUEST_ID_COOKIE, guestId);
    }
    return guestId;
}

export function clearGuestId() {
    if (typeof document === 'undefined') return;
    document.cookie = `${GUEST_ID_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}
