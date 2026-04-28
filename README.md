# Magic: The Gathering Old Frame Deck Validator

A browser-based deck list validator for Magic: The Gathering old frame (cards printed 2003 and earlier) formats. Paste a deck list, choose a format, and get immediate feedback on whether your deck is construction-legal.

Card legality is verified against the [Scryfall](https://scryfall.com) API.

## Supported Formats

| ID | Name | Rules |
|----|------|-------|
| `r40` | Revised 40 | <https://northernpaladins.com/r40/> |
| `fe40` | Fallen Empires 40 | See below |
| `fr` | Forgotten Realms (DRK/FEM/HML) | See below |
| `oft2` | Old Fashioned Type 2 (OFT2) | See below |
| `atl` | Atlantic 93/94 (ATL) | <https://sentineloldschoolmtg.com/atlantic-93-94/> |
| `a2a` | Alpha to Alliances (A2A) | <https://musiccityos.com/formats/alpha-alliances/> |
| `aaa` | Alpha to Alliances Ante (AAA) | <https://musiccityos.com/formats/ante/> |
| `xpt` | X-Point Old School 93/94 (Xpts) | <https://xpointoldschool.com/rules-points/> |
| `7pt` | 7 Points Singleton 93/94 (7pts) | <https://7pts-singleton.com/> |
| `swed` | Old School 93/94 (Swedish) | <https://oldschool-mtg.blogspot.com/p/banrestriction.html> |
| `ec` | Eternal Central 93/94 (EC) | <https://www.eternalcentral.com/9394rules/> |

### Fallen Empires 40 (FE40)

- Minimum 40 card mainboard; 0–5 card sideboard
- Card pool: Fallen Empires. Basic lands from any set are unrestricted.
- Maximum 4 copies of any card across mainboard and sideboard combined (e.g. 3 main + 1 side is legal)
- Fallen Empires printed multiple alternate arts for many cards; all copies of the same card name count together regardless of art variant
- **Banned:** Hymn to Tourach
- **Restricted** (max 2 copies across main + sideboard): Dwarven Catapult, Hand of Justice, Icatian Javelineers

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
        ├── fr.js                 # Forgotten Realms validator
        ├── oft2.js               # Old Fashioned Type 2 validator
        ├── atl.js                # Atlantic 93/94 validator
        ├── a2a.js                # Alpha to Alliances validator
        ├── aaa.js                # Alpha to Alliances Ante validator
        ├── xpt.js                # X-Point Old School 93/94 validator
        └── 7pt.js                # 7 Points Singleton 93/94 validator
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
