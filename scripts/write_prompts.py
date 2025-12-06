import os

CARDS_DIR = '/home/alukin/proj/demo/once-upon-a-time/onceuponatime-antigravity/specs/decks/default/cards'

PROMPTS = {
    # Protagonists
    "The Reluctant Hero": "A hesitant young farmhand holding a rusty sword loosely, looking back at a peaceful village, simple tunic lighting",
    "The Chosen One": "A figure illuminated by a vertical beam of light from the heavens, holding a glowing artifact, ethereal atmosphere",
    "The Orphaned Child": "A small lonely child sitting on a stone step in a busy marketplace, clutching a worn wooden toy, soft melancholic lighting",
    "The Exiled Prince": "A cloaked figure looking at a distant castle on a hill, wearing a tarnished royal ring, dramatic lighting",
    "The Brave Farmhand": "A sturdy peasant gripping a pitchfork, standing defiantly against a looming shadow, sunrise background",
    "The Cursed Wanderer": "A traveler walking down a dusty road, a dark spectral shadow physically attached to their feet, ominous atmosphere",
    "The Silent Guardian": "A heavily armored knight standing motionless in a stone archway, face completely hidden by a visor, stoic mood",
    "The Clever Thief": "A hooded rogue crouching on a rooftop, holding a stolen jeweled purse, winking, moonlight",
    "The Loyal Companion": "A faithful wolf-dog standing guard beside a sleeping traveler, warm campfire lighting",
    "The Talking Animal": "A wise-looking owl wearing small spectacles and reading an open book, magical library background",
    "The Wise Mentor": "An elderly scholar with a long white beard pointing the way with a gnarled staff, ancient ruins background",
    "The Retired Knight": "An old warrior polishing a pristine sword by a fireplace, cozy interior lighting",
    "The Rebellious Heir": "A young noble tearing a royal decree in half, wearing fine clothes but messy hair, defiant expression",
    "The Seer with No Eyes": "A blindfolded mystic with hands hovering over a swirling crystal ball, purple magical aura",
    "The Apprentice Mage": "A young student struggling to control a ball of chaotic sparking magic in their hands, library background",
    "The Grizzled Mercenary": "A scarred veteran sharpening a large battleaxe, sitting on a wooden crate, gritty texture",
    "The Fool Who Knows Too Much": "A jester in colorful motley juggling balls, with a knowing and serious expression contrasting the outfit",
    "The Shape-shifting Ally": "A figure mid-transformation between human and fox, magical sparkles, dreamlike quality",
    "The Ghost of a Friend": "A translucent friendly spirit waving from a mist, blue spectral glow",
    "The Forgotten Twin": "Two identical figures standing side by side, one solid and colorful, the other faded and gray",
    "The Healer with a Secret": "A medic mixing a potion in a vial, hiding a dagger behind their back, candlelit room",
    "The Bard Who Can't Lie": "A minstrel playing a lute, with gold musical notes and truth runes floating from their mouth",
    "The Last of Their Kind": "A unique solitary creature looking sadly at a fossil of its own kind, sunset lighting",
    "The Child of Prophecy": "A sleeping baby in a basket with a glowing geometric mark on their forehead",
    "The Time-Lost Stranger": "A person in futuristic clothing looking confused at a medieval market stall",
    "The Inventor of Impossible Things": "An eccentric tinkerer surrounded by flying clockwork birds, workshop background",
    "The One Who Remembers": "An ancient historian writing in a massive book, surrounded by floating memory bubbles",
    "The Peacemaker": "A figure standing calmly between two crossing swords, holding up a white flower",
    "The Reluctant Leader": "A person looking anxiously at a heavy gold crown resting on a simple table",
    "The Dreamer Who Dared": "A person looking up at the stars, beginning to climb a ladder that extends into the clouds",

    # Antagonists
    "The Shadow King": "A dark ruler sitting on an obsidian throne, shrouded in living shadows, red eyes glowing",
    "The Betrayer Within": "A friendly-looking ally holding a dagger behind their back, their reflection in a mirror shows a monster",
    "The Cursed Beast": "A werewolf-like creature howling at the moon, looking in pain rather than rage",
    "The False Prophet": "A charismatic leader preaching to a crowd, but their shadow cast on the wall has horns",
    "The Puppetmaster": "A figure in the shadows holding strings attached to people walking below",
    "The Ancient Evil": "A massive eldritch eye opening in a dark void, cosmic horror style",
    "The Smiling Assassin": "A well-dressed courtier offering a poisoned goblet with a warm smile",
    "The Tyrant Queen": "A stern queen holding a scepter, sitting on a high iron throne, imposing perspective",
    "The Whispering Mask": "A porcelain mask floating in the dark, whispering smoke coming from the mouth",
    "The Mirror Doppelgänger": "A person looking in a mirror, but the reflection is smiling evilly while the person is not",
    "The Corrupted Mentor": "A wizard with dark purple veins on their face abusing magic, ruined tower background",
    "The Unseen Watcher": "Many glowing eyes peering out from the darkness of a dense forest",
    "The Collector of Souls": "A cloaked figure holding a lantern containing glowing blue spirits",
    "The Laughing Plague": "A jester's mask lying on the ground, surrounded by green toxic mist",
    "The Eternal Duelist": "A skeletal warrior in armor waiting with a drawn sword, foggy battlefield",
    "The Fallen Hero": "A knight in black armor holding a broken shield with a noble crest, rain falling",
    "The Living Storm": "A tornado taking the shape of a humanoid upper body, lightning crackling",
    "The Hunger That Walks": "A gaunt mouthless figure with a gaping maw explicitly on its stomach",
    "The Forgotten God": "A crumbling stone idol half-buried in sand, glowing faintly with remaining power",
    "The Bound Demon": "A demon chained to a rock, struggling to break free, fiery background",
    "The Voice in the Flames": "A face forming in the fire of a hearth, speaking",
    "The One Who Knows Your Name": "A figure writing names in a black book, face hidden by hood",
    "The Clockwork Warden": "A massive mechanical golem with a glowing red eye standing guard",
    "The Beast Beneath the City": "A giant reptilian eye looking up from a sewer grate in a cobblestone street",
    "The Curse of the Blood Moon": "A red moon in the night sky, with silhouettes transforming below",
    "The Silent Inquisition": "Three robed figures with featureless white masks standing in a row",
    "The Eyes in the Dark": "A pair of sharp glowing yellow eyes in pitch blackness",
    "The Broken Oath": "A shattered stone tablet with runes, bleeding red liquid",
    "The Price of Power": "A hand reaching for a glowing gem, the fingers turning to stone",
    "The Thing That Should Not Be": "A writhing mass of tentacles and eyes in a geometric shape, abstract horror",

    # Settings
    "The Haunted Forest": "Twisted dark trees with faces in the bark, mist on the ground, scary atmosphere",
    "The Crumbling Castle": "A ruined stone castle on a cliff, missing towers, overgrowth",
    "The Hidden Village": "Small thatched cottages nestled in a deep green valley, peaceful morning",
    "The Tower with No Doors": "A smooth tall black stone tower with no windows or doors, monolith style",
    "The City of Masks": "Venetian-style city streets with people traversing in gondolas wearing masks",
    "The Frozen Wastes": "An expansive barren landscape of ice and snow mountains, blizzard conditions",
    "The Desert of Whispers": "Endless sand dunes with wind forming shapes of faces in the sand",
    "The Library of Forgotten Names": "Infinite rows of bookshelves spiraling upwards, magical floating books",
    "The Bridge Between Worlds": "A transparent bridge spanning a starry void, galaxy background",
    "The Island That Moves": "A tropical island on the back of a giant turtle swimming in the ocean",
    "The Market of Lost Things": "A chaotic bazaar stall filled with random mismatched items and trinkets",
    "The Sunken Temple": "Greek-style ruins underwater with fish swimming through arches, light rays from above",
    "The Skyborne Citadel": "A white castle floating on a cloud island, blue sky",
    "The Endless Staircase": "A spiral stone staircase going up into clouds and down into darkness, Escher style",
    "The Garden of Bones": "Flowers made of small bones blooming in a gray field",
    "The Hollow Mountain": "A mountain cross-section showing a city inside a massive cavern",
    "The Mirror Lake": "A perfectly still lake reflecting the night sky and a second different moon",
    "The Labyrinth Below": "A complex stone maze of tunnels, torchlight",
    "The Clockwork City": "A steampunk city skyline with gears, steam pipes, and brass buildings",
    "The Battlefield of Ghosts": "A misty field with spectral soldiers fighting, translucent figures",
    "The River of Time": "A river flowing with images of history instead of water",
    "The Forbidden Archives": "A chained book on a pedestal in a dark room, spotlight",
    "The Ship of the Dead": "A tattered ghostly pirate ship sailing on mist, green glow",
    "The Dreaming Spire": "A tower that twists and changes shape like a surrealist painting",
    "The Crater of Stars": "A smoking crater with glowing meteor rocks inside",
    "The Edge of the World": "A waterfall where the ocean falls off into space",
    "The Moonlit Carnival": "Colorful circus tents glowing under a full moon, night time",
    "The Buried Cathedral": "Stained glass windows sticking out of a sand dune",
    "The Realm of Echoes": "A canyon with multiple translucent reflections of a shouter",
    "The Last Safe Place": "A warm lit cabin surrounded by a dark scary forest",

    # Objects
    "The Sword of Truth": "A shining silver sword reflecting a clear blue sky, pristine condition",
    "The Crown of Lies": "A gold crown that appears to be melting or dripping, distorted shape",
    "The Map of Destiny": "A parchment map with glowing footsteps moving on it",
    "The Elixir of Memory": "A glass vial containing swirling blue liquid, sparkles",
    "The Ring of Binding": "A heavy iron ring with chains hanging from it",
    "The Lantern of Lost Souls": "A lantern glowing with spooky green flame, mist inside",
    "The Book That Writes Itself": "An open book with a quill writing on it by itself, magical aura",
    "The Mirror of Regret": "A hand mirror showing a crying face in reflection",
    "The Key to the End": "A skull-shaped skeleton key made of black bone",
    "The Cloak of Shadows": "A black cloak that seems to dissolve into smoke at the edges",
    "The Coin That Decides Fate": "A gold coin spinning in the air, heads is a sun, tails is a skull",
    "The Bone Flute": "A simple flute carved from white bone",
    "The Phoenix Feather": "A brilliant red and orange feather glowing with heat",
    "The Hourglass of Undoing": "An hourglass with sand flowing upwards so gravity is reversed",
    "The Mask of Many Faces": "A white mask with shifting facial features, blur effect",
    "The Compass That Points to Danger": "A compass with the needle pointing at a red skull symbol",
    "The Seed of the World Tree": "A glowing green acorn pulsing with light",
    "The Chain of Promises": "A chain made of golden links, unbreakable, glowing",
    "The Gem of Nightfall": "A dark purple gem absorbing light around it",
    "The Blade That Hungers": "A jagged sword with teeth along the edge, organic texture",
    "The Scroll of Names": "A rolled parchment with a long list of names, calligraphy",
    "The Crown of Thorns": "A wreath made of dry thorny vines",
    "The Bell of Awakening": "A silver hand bell radiating sound waves visually",
    "The Lantern That Burns Cold": "A lantern emitting blue icy light, frosting the glass",
    "The Stone That Speaks": "A grey rune stone with a mouth carved into it",
    "The Puzzle Box": "An intricate wooden cube with sliding panels",
    "The Heart of the Machine": "A glowing mechanical core with gears and pipes, cyberpunk",
    "The Thorned Rose": "A beautiful red rose with excessively large sharp thorns",
    "The Whispering Locket": "An open locket with a picture of a ghost inside",
    "The Egg That Never Hatches": "A stone egg with cracks that glow but never break",

    # Catalysts
    "A Prophecy Revealed": "An ancient scroll unrolling to reveal glowing text",
    "A Secret Uncovered": "A loose floorboard prying open to reveal a hidden box",
    "A Rescue Attempt": "A hand reaching down to grab another hand from a ledge",
    "A Sudden Betrayal": "A dagger stabbing into a map on a table",
    "A Forbidden Love": "Two silhouettes reaching for each other through a barred window",
    "A Duel at Dawn": "Two pistols lying crossed on the grass at sunrise",
    "A Message from the Past": "A dusty letter sealed with wax found in a bottle",
    "A Stranger Arrives": "A silhouette standing in a doorway with a walking stick",
    "A Door Appears": "A magical glowing door standing freestanding in a field",
    "A Dream Foretold": "A thought bubble showing a castle burning",
    "A Pact is Broken": "A torn contract document on a table",
    "A Festival Begins": "Flags and banners flying over a town square, confetti",
    "A War Ignites": "A lit torch setting fire to a pile of wood",
    "A Storm Approaches": "Dark storm clouds gathering over a hill",
    "A Child is Born": "A cradle glowing with warm light",
    "A Hero Falls": "A broken sword lying on the ground",
    "A Truth is Denied": "A person covering their ears with their hands",
    "A Monster Awakens": "A large yellow eye opening in the dark",
    "A Spell Backfires": "A wizard's wand exploding with sparks",
    "A Clock Strikes Thirteen": "A clock face showing the hand past 12",
    "A Mask is Removed": "A hand holding a mask away from a face",
    "A Sacrifice is Made": "A gold necklace left on a stone altar",
    "A Prison is Breached": "Broken metal bars of a jail cell",
    "A Trial is Called": "A wooden gavel resting on a sound block",
    "A God Demands Tribute": "A large stone hand held out palm up",
    "A Friend is Lost": "An empty chair at a dinner table",
    "A New Power Rises": "A fist raising a glowing scepter",
    "A Letter is Delivered": "A hand handing a sealed envelope to another hand",
    "A Weapon is Found": "A sword half-buried in dirt being discovered",
    "A Memory Returns": "A puzzle piece fitting into a missing spot in a picture",
    "A Portal Opens": "A swirling vortex of blue energy",
    "A Curse is Cast": "A voodoo doll with pins in it",
    "A Kingdom Crumbles": "A stone tower collapsing, dust",
    "A Stranger is Trusted": "Two hands shaking, one gloved, one bare",
    "A Lie is Believed": "A pinned butterfly that is actually made of paper",
    "A Fire Spreads": "Flames jumping from one house roof to another",
    "A Deal is Struck": "Two hands shaking over a contract signed in blood",
    "A Secret Passage Found": "A bookshelf swinging open like a door",
    "A Song is Sung": "Musical notes floating in the air, abstract",
    "A Choice Must Be Made": "A fork in a road with two different paths",

    # Traits
    "Bravery in Doubt": "A shaking hand gripping a sword handle tightly",
    "Greed Unleashed": "Hands overflowing with gold coins",
    "Hope Rekindled": "A single candle burning in a dark room",
    "Loneliness Echoed": "A single set of footprints in snow",
    "Love Unspoken": "A flower left on a doorstep",
    "Pride Before the Fall": "A peacock admiring itself in a mirror",
    "Redemption Sought": "A person kneeling in prayer, silhouette",
    "Trust Betrayed": "A broken handshake icon",
    "Duty Over Desire": "A helmet resting on top of a love letter",
    "Fear of the Unknown": "A person looking into a dark cave entrance",
    "Ambition Without End": "A ladder reaching up into the sky endlessly",
    "Kindness in Darkness": "A hand offering bread to a beggar in an alley",
    "Guilt That Festers": "A dark stain spreading on a white cloth",
    "Joy in Small Things": "A wildflower growing in a crack in pavement",
    "Rage Unleashed": "A fist smashing a table, motion blur",
    "Honor Above All": "A pristine white shield with a heraldic crest",
    "Curiosity Unchecked": "A hand reaching for a forbidden book",
    "Faith in the Impossible": "A person walking on air off a cliff, magical",
    "Regret That Haunts": "A ghost following a person",
    "Sacrifice for Love": "A heart symbol carved into a tree bark",
    "Obsession Consumes": "A room covered in scribbled notes on the walls",
    "Loyalty Beyond Death": "A skeleton dog sitting by a grave",
    "Innocence Lost": "A dropped teddy bear in a puddle",
    "Courage in Silence": "A person with tape over their mouth standing tall",
    "Grief That Transforms": "A caterpillar cocoon hanging from a branch",
    "Arrogance Punished": "A king's crown lying in mud",
    "Forgiveness Given": "An open hand offering help",
    "Despair Overcome": "A sun breaking through storm clouds",
    "Vengeance Taken": "A scale tipped completely to one side",
    "Wonder Rekindled": "Wide eyes reflecting stars",

    # Endings
    "…and the monster was vanquished.": "A giant beast lying defeated on the ground",
    "…but the hero lost everything.": "A hero standing alone in a ruined city",
    "…and harmony was restored.": "A yin-yang symbol made of nature and water elements",
    "…yet the curse endured.": "A dark mark on a hand that won't wash off",
    "…and the journey changed them forever.": "Two portraits of the same person, young and old",
    "…but the truth was never spoken.": "A sealed envelope being thrown into a fire",
    "…and the kingdom was reborn.": "Scaffolding around a castle being rebuilt, bright light",
    "…and they vanished into legend.": "Footprints fading away into dust",
    "…but the price was too high.": "A pile of gold next to a skeleton",
    "…and the world forgot their name.": "An eroded tombstone with no name",
    "…and peace returned at last.": "A dove flying over a battlefield with flowers growing",
    "…but the shadows still whispered.": "Long shadows stretching in a lit room",
    "…and the stars sang once more.": "Constellations connecting in the sky",
    "…and the cycle began anew.": "A snake eating its own tail (Ouroboros)",
    "…but the hero never came home.": "A dusty untouched room",
    "…and the story was passed on.": "An old person reading to children by a fire",
    "…yet the wound never healed.": "A scar that glows red",
    "…and the light returned.": "Sunrise over a hill, golden hour",
    "…but the silence remained.": "An empty music hall",
    "…and they lived, changed, ever after.": "A family portrait with missing members but new ones"
}

def main():
    print(f"Scanning {CARDS_DIR}...")
    count = 0
    missing = []
    
    for category in os.listdir(CARDS_DIR):
        cat_path = os.path.join(CARDS_DIR, category)
        if not os.path.isdir(cat_path):
            continue
            
        print(f"Processing {category}...")
        for card_dir in os.listdir(cat_path):
            card_path = os.path.join(cat_path, card_dir)
            if not os.path.isdir(card_path):
                continue
                
            en_file = os.path.join(card_path, 'en.md')
            if not os.path.exists(en_file):
                print(f"Warning: No en.md in {card_dir}")
                continue
                
            # Read the name from en.md to match key
            with open(en_file, 'r') as f:
                content = f.read()
                # Assuming first line is "# Name"
                lines = content.split('\n')
                if not lines:
                    print(f"Empty file: {en_file}")
                    continue
                name = lines[0].replace('# ', '').strip()
            
            prompt = PROMPTS.get(name)
            if not prompt:
                # Try simple matching if name in file is slightly different or has punctuation
                # or finding key that contains this name?
                # Actually keys should match exactly based on previous step
                # Let's try to match 
                found = False
                for k, v in PROMPTS.items():
                    if k == name:
                        prompt = v
                        found = True
                        break
                if not found:
                    missing.append(name)
                    # Fallback
                    prompt = f"Image of {name}, isolated on white background"
            
            prompt_file = os.path.join(card_path, 'prompt.md')
            with open(prompt_file, 'w') as f:
                f.write(prompt)
            count += 1
            
    print(f"Written {count} prompt files.")
    if missing:
        print(f"Missing prompts for: {missing}")

if __name__ == "__main__":
    main()
