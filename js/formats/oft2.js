/**
 * Old Fashioned Type 2 (OFT2) format validator.
 *
 * Card pool: Revised (3ed), The Dark (drk), Fallen Empires (fem).
 * CE/ICE and same-art/same-frame reprints are legal; only the card name matters.
 * Basic lands from any old frame set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Basic lands (any set): no copy limit
 *   - All other cards must be printed in Revised, The Dark, or Fallen Empires
 *   - Max 4 copies of any card across main + sideboard combined
 *   - Banned: Contract From Below, Darkpact, Demonic Attorney, Balance,
 *             Braingeyser, Channel, Demonic Tutor, Hymn to Tourach,
 *             Maze of Ith, Mind Twist, Sol Ring, Wheel of Fortune
 */

import { batchGetCardsInAnySets } from '../scryfall.js';

const LEGAL_SETS = ['3ed', 'drk', 'fem'];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;

const BANNED = new Set([
  'Contract From Below',
  'Darkpact',
  'Demonic Attorney',
  'Balance',
  'Braingeyser',
  'Channel',
  'Demonic Tutor',
  'Hymn to Tourach',
  'Maze of Ith',
  'Mind Twist',
  'Sol Ring',
  'Wheel of Fortune',
]);

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const OFT2 = {
  id:   'oft2',
  name: 'Old Fashioned Type 2 (OFT2)',

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
      const fetched = await batchGetCardsInAnySets(toFetch, LEGAL_SETS);
      for (const [name, data] of fetched) {
        cardPool.set(name.toLowerCase(), data);
      }
    }

    // --- Per-card rule checks ---
    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;

      if (BASIC_LANDS.has(key)) continue;

      const cardData = cardPool.get(key);

      if (!cardData) {
        errors.push(`"${displayName}" was not found in Revised, The Dark, or Fallen Empires.`);
        continue;
      }

      const canonicalName = cardData.name;

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Old Fashioned Type 2.`);
        continue;
      }

      if (totalQty > MAX_COPIES) {
        const location = sideQty > 0
          ? `${mainQty} main, ${sideQty} sideboard`
          : `${totalQty}`;
        errors.push(
          `${canonicalName} — maximum ${MAX_COPIES} copies allowed across main and sideboard (found ${location}).`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
