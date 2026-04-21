/**
 * Fallen Empires 40 (FE40) format validator.
 *
 * Card pool: Fallen Empires (fem). Basic lands from any set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 40 cards mainboard
 *   - 0–5 card sideboard
 *   - Basic lands (any set): no copy limit
 *   - All other cards must be printed in Fallen Empires
 *   - Max 4 copies of any card across main + sideboard combined
 *     (e.g. 3 main + 1 side is legal; 3 main + 2 side is not)
 *   - Banned: Hymn to Tourach
 *   - Restricted to 2 copies across main + sideboard:
 *       Dwarven Catapult, Hand of Justice, Icatian Javelineers
 *
 * Note: Fallen Empires printed multiple alternate arts for many cards.
 * All copies of the same card name count together regardless of which
 * art variant is used.
 */

import { batchGetCardsInSet } from '../scryfall.js';

const LEGAL_SET = 'fem';

const MIN_DECK_SIZE = 40;
const MAX_SIDEBOARD_SIZE = 5;
const MAX_COPIES = 4;
const MAX_RESTRICTED_COPIES = 2;

const BANNED = new Set([
  'Hymn to Tourach',
]);

const RESTRICTED = new Set([
  'Dwarven Catapult',
  'Hand of Justice',
  'Icatian Javelineers',
]);

// Basic land names (lowercase). These may come from any set with no copy limit.
const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

// Module-level card pool cache: persists across validate() calls within a session.
// Keyed by lowercase card name; values are Scryfall card objects or null.
const cardPool = new Map();

export const FE40 = {
  id: 'fe40',
  name: 'Fallen Empires 40 (FE40)',

  /**
   * @param {{ mainboard: Array<{qty:number, name:string}>, sideboard: Array<{qty:number, name:string}> }} deck
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validate(deck) {
    const errors = [];
    const { mainboard, sideboard } = deck;

    // --- Size checks ---
    const mainTotal = mainboard.reduce((s, c) => s + c.qty, 0);
    const sideTotal = sideboard.reduce((s, c) => s + c.qty, 0);

    if (mainTotal < MIN_DECK_SIZE) {
      errors.push(
        `Deck must contain at least ${MIN_DECK_SIZE} cards (found ${mainTotal}).`
      );
    }
    if (sideTotal > MAX_SIDEBOARD_SIZE) {
      errors.push(
        `Sideboard may contain at most ${MAX_SIDEBOARD_SIZE} cards (found ${sideTotal}).`
      );
    }

    // --- Build combined (main + side) quantity map ---
    // The 4-copy limit applies across both zones together.
    // Keys: lowercase name. Values: { displayName, mainQty, sideQty }
    const combined = new Map();

    const tally = (entries, zone) => {
      for (const { qty, name } of entries) {
        const key = name.toLowerCase();
        if (!combined.has(key)) {
          combined.set(key, { displayName: name, mainQty: 0, sideQty: 0 });
        }
        combined.get(key)[zone] += qty;
      }
    };
    tally(mainboard, 'mainQty');
    tally(sideboard, 'sideQty');

    if (combined.size === 0) {
      return { valid: errors.length === 0, errors };
    }

    // --- Populate card pool for unknown non-basic cards ---
    const toFetch = [...combined.keys()].filter(
      name => !BASIC_LANDS.has(name) && !cardPool.has(name)
    );

    if (toFetch.length > 0) {
      const fetched = await batchGetCardsInSet(toFetch, LEGAL_SET);
      for (const [name, data] of fetched) {
        cardPool.set(name.toLowerCase(), data);
      }
    }

    // --- Per-card rule checks ---
    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;

      // Basic lands are always legal in any quantity
      if (BASIC_LANDS.has(key)) continue;

      const cardData = cardPool.get(key);

      // Card pool check
      if (!cardData) {
        errors.push(`"${displayName}" was not found in the Fallen Empires card pool.`);
        continue;
      }

      const canonicalName = cardData.name;

      // Banned check
      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Fallen Empires 40.`);
        continue;
      }

      // Restricted and general copy-limit checks
      const isRestricted = RESTRICTED.has(canonicalName);
      const limit = isRestricted ? MAX_RESTRICTED_COPIES : MAX_COPIES;

      if (totalQty > limit) {
        // Describe where the copies appear when split across both zones
        const location = sideQty > 0
          ? `${mainQty} main, ${sideQty} sideboard`
          : `${totalQty}`;
        const reason = isRestricted
          ? `${canonicalName} is restricted — maximum ${limit} copies allowed across main and sideboard`
          : `${canonicalName} — maximum ${limit} copies allowed across main and sideboard`;
        errors.push(`${reason} (found ${location}).`);
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
