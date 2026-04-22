/**
 * Forgotten Realms (DRK/FEM/HML) format validator.
 *
 * Card pool: The Dark (drk), Fallen Empires (fem), Homelands (hml).
 * Only cards originally printed in those sets are legal. Only card name
 * matters for copy-limit purposes; artwork variant is irrelevant.
 * Basic lands from any old frame set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Basic lands (any set): no copy limit
 *   - All other cards must be printed in The Dark, Fallen Empires, or Homelands
 *   - Max 4 copies of any card across main + sideboard combined
 *   - Banned: An-Zerrin Ruins, Apocalypse Chime, Timmerian Fiends
 *   - Restricted to 1 copy across main + sideboard:
 *       Hymn to Tourach, Maze of Ith, Serrated Arrows
 */

import { batchGetCardsInAnySets } from '../scryfall.js';

const LEGAL_SETS = ['drk', 'fem', 'hml'];

const MIN_DECK_SIZE     = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES        = 4;
const MAX_RESTRICTED_COPIES = 1;

const BANNED = new Set([
  'An-Zerrin Ruins',
  'Apocalypse Chime',
  'Timmerian Fiends',
]);

const RESTRICTED = new Set([
  'Hymn to Tourach',
  'Maze of Ith',
  'Serrated Arrows',
]);

// Basic land names (lowercase). Legal from any set with no copy limit.
const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

// Module-level card pool cache: persists across validate() calls within a session.
// Keyed by lowercase card name; values are Scryfall card objects or null.
const cardPool = new Map();

export const ForgottenRealms = {
  id:   'forgotten-realms',
  name: 'Forgotten Realms (DRK/FEM/HML)',

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
    // Cards are checked against all three legal sets; the first set in which
    // a card is found determines its card data.
    const toFetch = [...combined.keys()].filter(
      name => !BASIC_LANDS.has(name) && !cardPool.has(name)
    );

    if (toFetch.length > 0) {
      const fetched = await batchGetCardsInAnySets(toFetch, LEGAL_SETS);
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
        errors.push(`"${displayName}" was not found in The Dark, Fallen Empires, or Homelands.`);
        continue;
      }

      const canonicalName = cardData.name;

      // Banned check
      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Forgotten Realms.`);
        continue;
      }

      // Restricted and general copy-limit checks
      const isRestricted = RESTRICTED.has(canonicalName);
      const limit        = isRestricted ? MAX_RESTRICTED_COPIES : MAX_COPIES;

      if (totalQty > limit) {
        const location = sideQty > 0
          ? `${mainQty} main, ${sideQty} sideboard`
          : `${totalQty}`;
        const reason = isRestricted
          ? `${canonicalName} is restricted — maximum ${limit} copy allowed across main and sideboard`
          : `${canonicalName} — maximum ${limit} copies allowed across main and sideboard`;
        errors.push(`${reason} (found ${location}).`);
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
