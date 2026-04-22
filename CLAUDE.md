# CLAUDE.md

## Project overview

A static browser app for validating Magic: The Gathering deck lists against old frame format rules (2003 and earlier). No build step. Plain HTML + ES modules served over HTTP.

Card data is resolved via the [Scryfall API](https://scryfall.com/docs/api). There is no backend.

## Running locally

```bash
npm start   # runs: npx serve .
```

Any static HTTP server works. The files cannot be opened directly from disk — ES modules require HTTP due to browser CORS restrictions.

## Architecture

```
index.html                  # Single-page form; one <option> per format
styles.css                  # Global styles
js/
  main.js                   # Form submit handler; help panel toggle
  parser.js                 # Moxfield plain text deck list parser
  scryfall.js               # Scryfall API client (cached, rate-limited)
  formats/
    index.js                # Format registry (FORMATS map + getFormat())
    r40.js                  # Revised 40
    fe40.js                 # Fallen Empires 40
    forgotten-realms.js     # Forgotten Realms (DRK/FEM/HML)
```

## Adding a new format

Four things need to change:

1. **Create `js/formats/<id>.js`** — export an object with this shape:
   ```js
   export const MyFormat = {
     id:   'my-format',
     name: 'My Format Name',
     async validate(deck) {
       // deck = { mainboard: [{qty, name}], sideboard: [{qty, name}] }
       const errors = [];
       // ...
       return { valid: errors.length === 0, errors };
     },
   };
   ```

2. **Register it in `js/formats/index.js`** — import and add to `FORMATS`.

3. **Add an `<option>` to `index.html`** — the `value` must match the format `id`.

4. **Document it in `README.md`** — add a row to the supported formats table and an inline rules summary (formats in this project have no dedicated external rules page).

## Format module conventions

- **Module-level `cardPool` Map** — keyed by lowercase card name, valued by Scryfall card object or `null`. Declared at module scope so it persists across `validate()` calls within a session. The Revised/Fallen Empires/etc. card pools never change; a card looked up once need not be fetched again.
- **Basic lands** — defined as a module-level `BASIC_LANDS` Set of lowercase names (`plains`, `island`, `swamp`, `mountain`, `forest`). Always skip API lookup and copy-limit checks for these.
- **Copy limits spanning main + sideboard** — combine quantities from both zones before applying limits. When reporting an error for a card that appears in both zones, include the breakdown: `"3 main, 1 sideboard"`.
- **Banned before restricted before copy limit** — check in that order and `continue` after a ban hit so a card only produces one error.
- **Canonical names** — always use `cardData.name` (from Scryfall) for banned/restricted set membership checks, not the user-supplied string, so capitalisation differences don't matter.

## Scryfall client (`js/scryfall.js`)

Three exported functions:

| Function | Use when |
|---|---|
| `batchGetCardsInSet(names, setCode)` | Card pool is a single set (e.g. R40 → `3ed`, FE40 → `fem`) |
| `batchGetCardsInAnySets(names, setCodes[])` | Card pool spans multiple sets (e.g. Forgotten Realms → `['drk','fem','hml']`) |
| `getCardInSet(name, setCode)` | Single-card lookup; tries exact then fuzzy match. Prefer batch functions for deck validation. |

**Rate limiting** — 100 ms minimum between network calls, enforced inside `scryfallFetch`. Cached results skip the delay entirely.

**Caching** — module-level `cache` Map keyed by `"lowercase_name|setcode"`. Both batch functions populate this cache, so `getCardInSet` benefits from prior batch calls at no cost.

**Multi-set lookup** — `batchGetCardsInAnySets` tries each set in order, carrying only unresolved names forward. Prefer ordering sets by where most cards are likely to be found to minimise round-trips.

## Parser (`js/parser.js`)

Handles Moxfield plain text export format:
- Lines: `<qty> <card name>` with optional trailing `(SETCODE) collector_number [flags]` — the suffix is stripped.
- Section headers (`Deck`, `Sideboard`, `// Sideboard`, etc.) switch the active zone.
- Everything before a sideboard header is mainboard.

## HTML / CSS notes

- Layout: `#header` (dark bar) → optional `#help-panel` (Moxfield instructions, toggled by `?` button) → `#content` (form) → `#footer`.
- `.container` centres and constrains content to 600 px max-width with `padding: 1rem`.
- Result states use three CSS classes: `.result-valid` (green), `.result-error` (red), `.result-loading` (grey).
- All user-visible strings inserted into `innerHTML` must go through the `esc()` helper in `main.js` to prevent XSS.
