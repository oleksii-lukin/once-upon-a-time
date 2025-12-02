import { v4 as uuidv4 } from 'uuid';

const GUEST_ID_KEY = 'ouat_guest_id';

export function getGuestId(): string {
    if (typeof window === 'undefined') return '';

    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
        guestId = uuidv4();
        localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
}

export function clearGuestId() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GUEST_ID_KEY);
}
