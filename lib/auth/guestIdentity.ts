// Fun random name generator for anonymous guests
// Similar to Google Docs style names like "Anonymous Squirrel"

const ADJECTIVES = [
    'Adventurous', 'Brave', 'Clever', 'Daring', 'Eager',
    'Fearless', 'Gentle', 'Happy', 'Inventive', 'Jolly',
    'Kind', 'Lively', 'Merry', 'Noble', 'Optimistic',
    'Playful', 'Quick', 'Radiant', 'Silly', 'Thoughtful',
    'Unique', 'Valiant', 'Witty', 'Xenial', 'Youthful',
    'Zealous', 'Cosmic', 'Dreamy', 'Enchanted', 'Frosty',
    'Galactic', 'Heroic', 'Invisible', 'Jazzy', 'Kinetic',
    'Legendary', 'Mystic', 'Nifty', 'Oddball', 'Peaceful',
    'Quirky', 'Royal', 'Sneaky', 'Turbo', 'Ultimate',
    'Vivid', 'Wacky', 'Xtreme', 'Yappy', 'Zany',
    'Sleepy', 'Grumpy', 'Bashful', 'Sneezy', 'Dopey',
    'Dancing', 'Singing', 'Flying', 'Jumping', 'Running',
    'Magical', 'Electric', 'Neon', 'Fluffy', 'Sparkly'
];

const ANIMALS = [
    'Aardvark', 'Bear', 'Cat', 'Dragon', 'Elephant',
    'Fox', 'Giraffe', 'Hedgehog', 'Iguana', 'Jaguar',
    'Koala', 'Lion', 'Monkey', 'Narwhal', 'Owl',
    'Penguin', 'Quokka', 'Rabbit', 'Squirrel', 'Tiger',
    'Unicorn', 'Vulture', 'Walrus', 'Xenops', 'Yak',
    'Zebra', 'Alpaca', 'Badger', 'Capybara', 'Dolphin',
    'Eagle', 'Flamingo', 'Gorilla', 'Hippo', 'Ibis',
    'Jellyfish', 'Kangaroo', 'Lemur', 'Meerkat', 'Newt',
    'Octopus', 'Panda', 'Quail', 'Raccoon', 'Sloth',
    'Turtle', 'Urchin', 'Viper', 'Wolf', 'Yeti',
    'Axolotl', 'Beaver', 'Chinchilla', 'Duck', 'Emu',
    'Ferret', 'Goose', 'Hamster', 'Impala', 'Jay'
];

// Animal emoji mappings for avatars
const ANIMAL_EMOJIS: Record<string, string> = {
    'Aardvark': '🐽', 'Bear': '🐻', 'Cat': '🐱', 'Dragon': '🐉', 'Elephant': '🐘',
    'Fox': '🦊', 'Giraffe': '🦒', 'Hedgehog': '🦔', 'Iguana': '🦎', 'Jaguar': '🐆',
    'Koala': '🐨', 'Lion': '🦁', 'Monkey': '🐵', 'Narwhal': '🦄', 'Owl': '🦉',
    'Penguin': '🐧', 'Quokka': '🐻', 'Rabbit': '🐰', 'Squirrel': '🐿️', 'Tiger': '🐯',
    'Unicorn': '🦄', 'Vulture': '🦅', 'Walrus': '🦭', 'Xenops': '🐦', 'Yak': '🐂',
    'Zebra': '🦓', 'Alpaca': '🦙', 'Badger': '🦡', 'Capybara': '🐹', 'Dolphin': '🐬',
    'Eagle': '🦅', 'Flamingo': '🦩', 'Gorilla': '🦍', 'Hippo': '🦛', 'Ibis': '🐦',
    'Jellyfish': '🪼', 'Kangaroo': '🦘', 'Lemur': '🐒', 'Meerkat': '🐿️', 'Newt': '🦎',
    'Octopus': '🐙', 'Panda': '🐼', 'Quail': '🐦', 'Raccoon': '🦝', 'Sloth': '🦥',
    'Turtle': '🐢', 'Urchin': '🦔', 'Viper': '🐍', 'Wolf': '🐺', 'Yeti': '🦣',
    'Axolotl': '🦎', 'Beaver': '🦫', 'Chinchilla': '🐭', 'Duck': '🦆', 'Emu': '🦚',
    'Ferret': '🦦', 'Goose': '🪿', 'Hamster': '🐹', 'Impala': '🦌', 'Jay': '🐦'
};

// Color palette for guest avatars (vibrant colors)
const AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9',
    '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124'
];

const GUEST_NAME_KEY = 'ouat_guest_name';
const GUEST_ANIMAL_KEY = 'ouat_guest_animal';
const GUEST_COLOR_KEY = 'ouat_guest_color';

function seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
}

function getFromArray<T>(array: T[], seed: string, offset: number = 0): T {
    const index = Math.floor(seededRandom(seed + offset.toString()) * array.length);
    return array[index];
}

export interface GuestIdentity {
    name: string;
    animal: string;
    emoji: string;
    color: string;
}

export function generateGuestIdentity(guestId: string): GuestIdentity {
    const adjective = getFromArray(ADJECTIVES, guestId, 0);
    const animal = getFromArray(ANIMALS, guestId, 1);
    const color = getFromArray(AVATAR_COLORS, guestId, 2);
    const emoji = ANIMAL_EMOJIS[animal] || '🎭';

    return {
        name: `${adjective} ${animal}`,
        animal,
        emoji,
        color
    };
}

export function getGuestIdentity(guestId: string): GuestIdentity {
    if (typeof window === 'undefined') {
        return generateGuestIdentity(guestId);
    }

    // Check if we already have a stored identity
    const storedName = localStorage.getItem(GUEST_NAME_KEY);
    const storedAnimal = localStorage.getItem(GUEST_ANIMAL_KEY);
    const storedColor = localStorage.getItem(GUEST_COLOR_KEY);

    if (storedName && storedAnimal && storedColor) {
        return {
            name: storedName,
            animal: storedAnimal,
            emoji: ANIMAL_EMOJIS[storedAnimal] || '🎭',
            color: storedColor
        };
    }

    // Generate new identity based on guest ID
    const identity = generateGuestIdentity(guestId);

    // Store for consistency
    localStorage.setItem(GUEST_NAME_KEY, identity.name);
    localStorage.setItem(GUEST_ANIMAL_KEY, identity.animal);
    localStorage.setItem(GUEST_COLOR_KEY, identity.color);

    return identity;
}

export function clearGuestIdentity() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(GUEST_NAME_KEY);
    localStorage.removeItem(GUEST_ANIMAL_KEY);
    localStorage.removeItem(GUEST_COLOR_KEY);
}
