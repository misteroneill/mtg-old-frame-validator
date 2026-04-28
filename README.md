# MTG Old Frame Deck Validator

A browser-based deck list validator for Magic: The Gathering old frame formats (2003 and earlier). Paste a deck list, choose a format, and get immediate feedback on whether your deck is construction-legal.

Card legality is verified against the [Scryfall](https://scryfall.com) API.

## Supported Formats

| ID | Name | Rules |
|----|------|-------|
| `r40` | Revised 40 | <https://northernpaladins.com/r40/> |
| `fe40` | Fallen Empires 40 | See below |
| `forgotten-realms` | Forgotten Realms (DRK/FEM/HML) | See below |
| `oft2` | Old Fashioned Type 2 (OFT2) | See below |
| `atl` | Atlantic 93/94 (ATL) | <https://sentineloldschoolmtg.com/atlantic-93-94/> |
| `a2a` | Alpha to Alliances (A2A) | <https://musiccityos.com/formats/alpha-alliances/> |
| `aaa` | Alpha to Alliances Ante (AAA) | <https://musiccityos.com/formats/ante/> |

### Fallen Empires 40 (FE40)

- Minimum 40 card mainboard; 0–5 card sideboard
- Card pool: Fallen Empires. Basic lands from any set are unrestricted.
- Maximum 4 copies of any card across mainboard and sideboard combined (e.g. 3 main + 1 side is legal)
- Fallen Empires printed multiple alternate arts for many cards; all copies of the same card name count together regardless of art variant
- **Banned:** Hymn to Tourach
- **Restricted** (max 2 copies across main + sideboard): Dwarven Catapult, Hand of Justice, Icatian Javelineers

### Alpha to Alliances (A2A)

- Minimum 60 card mainboard; 0–15 card sideboard
- Card pool: Alpha, Beta, Unlimited, CE, IE, Arabian Nights, Antiquities, Revised, Legends, The Dark, Fallen Empires, Fourth Edition, Ice Age, Chronicles, Homelands, and Alliances. Basic lands from any set are unrestricted.
- Six legal promo cards: Arena, Giant Badger, Nalathni Dragon, Sewers of Estark, and Windseeker Centaur (unlimited copies); Mana Crypt (restricted)
- **Unlimited copies:** any card with the Aurochs or Rat creature type
- Maximum 4 copies of any other unrestricted card across mainboard and sideboard combined
- **Banned:** Amulet of Quoz, Bronze Tablet, Contract from Below, Darkpact, Demonic Attorney, Jeweled Bird, Rebirth, Tempest Efreet, Timmerian Fiends
- **Restricted** (max 1 copy across main + sideboard): Ancestral Recall, Balance, Black Lotus, Braingeyser, Chaos Orb, Channel, Demonic Consultation, Demonic Tutor, Library of Alexandria, Mana Crypt, Mana Drain, Mind Twist, Mox Emerald, Mox Jet, Mox Pearl, Mox Ruby, Mox Sapphire, Recall, Regrowth, Sol Ring, Time Vault, Time Walk, Timetwister, Wheel of Fortune

### Alpha to Alliances Ante (AAA)

- Uses all Alpha to Alliances rules, with the nine ante cards un-banned and legal
- **Restricted** (in addition to the A2A restricted list): Contract from Below, Jeweled Bird
- All other ante cards (Amulet of Quoz, Bronze Tablet, Darkpact, Demonic Attorney, Rebirth, Tempest Efreet, Timmerian Fiends) are legal at the standard 4-copy limit

### Atlantic 93/94 (ATL)

- Minimum 60 card mainboard; 0–15 card sideboard
- Card pool: Alpha, Beta, Arabian Nights, Antiquities, Legends, The Dark, and Fallen Empires. Reprint policy (CE/ICE, etc.) is community-defined; this validator checks only that the card name was printed in a legal set. Basic lands from any old frame set are unrestricted.
- Maximum 4 copies of any unrestricted card across mainboard and sideboard combined
- **Banned:** Bronze Tablet, Contract From Below, Darkpact, Demonic Attorney, Jeweled Bird, Rebirth, Tempest Efreet
- **Restricted** (max 1 copy across main + sideboard): Ancestral Recall, Balance, Black Lotus, Braingeyser, Chaos Orb, Channel, Demonic Tutor, Library of Alexandria, Mana Drain, Mind Twist, Mox Emerald, Mox Jet, Mox Pearl, Mox Ruby, Mox Sapphire, Regrowth, Sol Ring, Strip Mine, Time Walk, Timetwister, Wheel of Fortune

### Old Fashioned Type 2 (OFT2)

- Minimum 60 card mainboard; 0–15 card sideboard
- Card pool: Revised, The Dark, and Fallen Empires. CE/ICE and same-art/same-frame reprints are legal. Basic lands from any old frame set are unrestricted.
- Maximum 4 copies of any card across mainboard and sideboard combined; only card name matters, not artwork variant
- **Banned:** Contract From Below, Darkpact, Demonic Attorney, Balance, Braingeyser, Channel, Demonic Tutor, Hymn to Tourach, Maze of Ith, Mind Twist, Sol Ring, Wheel of Fortune

### Forgotten Realms (DRK/FEM/HML)

- Minimum 60 card mainboard; 0–15 card sideboard
- Card pool: The Dark, Fallen Empires, and Homelands. Basic lands from any old frame set are unrestricted.
- Maximum 4 copies of any card across mainboard and sideboard combined; only card name matters, not artwork variant
- **Banned:** An-Zerrin Ruins, Apocalypse Chime, Timmerian Fiends
- **Restricted** (max 1 copy across main + sideboard): Hymn to Tourach, Maze of Ith, Serrated Arrows

## Usage

Deck lists must be in [Moxfield plain text format](https://www.moxfield.com): one card per line, quantity first.

```
4 Lightning Bolt
4 Counterspell
4 Serra Angel
1 Sol Ring
20 Island
...
```

Set code and collector number suffixes exported by Moxfield are stripped automatically:

```
4 Lightning Bolt (3ED) 163
```

A `// Sideboard` (or bare `Sideboard`) section header marks cards as sideboard entries. All other lines are treated as mainboard.

## Running Locally

The app is plain HTML + ES modules — no build step required. Because ES modules are subject to browser CORS restrictions, the files must be served over HTTP rather than opened directly from disk.

```bash
npm start
```

This runs `npx serve .` and prints the local URL. Any static file server works equally well (e.g. `python3 -m http.server`).

## Project Structure

```
mtg-old-frame-validator/
├── index.html              # Single-page form
├── styles.css              # Minimal styling
├── package.json
└── js/
    ├── main.js             # Form submission and result rendering
    ├── parser.js           # Moxfield plain text parser
    ├── scryfall.js         # Scryfall API client (cached, rate-limited)
    └── formats/
        ├── index.js              # Format registry
        ├── r40.js                # Revised 40 validator
        ├── fe40.js               # Fallen Empires 40 validator
        ├── forgotten-realms.js   # Forgotten Realms validator
        ├── oft2.js               # Old Fashioned Type 2 validator
        ├── atl.js                # Atlantic 93/94 validator
        ├── a2a.js                # Alpha to Alliances validator
        └── aaa.js                # Alpha to Alliances Ante validator
```

## Adding a New Format

1. Create `js/formats/<id>.js` and export a validator object conforming to this interface:

```js
export const MyFormat = {
  id:   'my-format',       // matches the <option value> in index.html
  name: 'My Format Name',  // shown in the success message

  /**
   * @param {{ mainboard: Array<{qty: number, name: string}>,
   *           sideboard: Array<{qty: number, name: string}> }} deck
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validate(deck) {
    const errors = [];
    // ... validation logic ...
    return { valid: errors.length === 0, errors };
  },
};
```

2. Import and register it in `js/formats/index.js`:

```js
import { MyFormat } from './my-format.js';

export const FORMATS = {
  r40:       R40,
  'my-format': MyFormat,
};
```

3. Add a matching `<option>` to the `<select>` in `index.html`:

```html
<option value="my-format">My Format Name</option>
```

## Scryfall API Notes

Card data is fetched via Scryfall's [`/cards/collection`](https://scryfall.com/docs/api/cards/collection) endpoint, which accepts up to 75 card identifiers per POST request.  This means an entire deck is typically resolved in a single round-trip.

Lookups are cached for the lifetime of the page, so re-validating the same cards costs no additional requests. Results are cached at two levels:

- **`scryfall.js` module cache** — shared across all formats; persists for the page lifetime.
- **Format-level `cardPool`** — format-specific cache (e.g. in `r40.js`) that also persists for the page lifetime and skips the Scryfall call entirely for cards already seen in a previous submission.

Scryfall's rate limit guideline (≤10 requests/second) is respected by enforcing a 100 ms minimum gap between network calls.
