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
import { BASIC_LANDS, buildCombined, checkSizes, copyLimitError } from './shared.js';

const LEGAL_SET = 'fem';

const MIN_DECK_SIZE      = 40;
const MAX_SIDEBOARD_SIZE = 5;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 2;

const BANNED = new Set([
  'Hymn to Tourach',
]);

const RESTRICTED = new Set([
  'Dwarven Catapult',
  'Hand of Justice',
  'Icatian Javelineers',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const FE40 = {
  id: 'fe40',
  name: 'Fallen Empires 40 (FE40)',

  /**
   * @param {{ mainboard: Array<{qty:number, name:string}>, sideboard: Array<{qty:number, name:string}> }} deck
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validate(deck) {
    const { mainboard, sideboard } = deck;

    const mainTotal = mainboard.reduce((s, c) => s + c.qty, 0);
    const sideTotal = sideboard.reduce((s, c) => s + c.qty, 0);

    const errors = checkSizes(mainTotal, sideTotal, MIN_DECK_SIZE, MAX_SIDEBOARD_SIZE);

    const combined = buildCombined(mainboard, sideboard);
    if (combined.size === 0) return { valid: errors.length === 0, errors };

    const toFetch = [...combined.keys()].filter(
      name => !BASIC_LANDS.has(name) && !cardPool.has(name)
    );
    if (toFetch.length > 0) {
      const fetched = await batchGetCardsInSet(toFetch, LEGAL_SET);
      for (const [name, data] of fetched) cardPool.set(name.toLowerCase(), data);
    }

    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;
      if (BASIC_LANDS.has(key)) continue;

      const cardData = cardPool.get(key);
      if (!cardData) {
        errors.push(`"${displayName}" was not found in the Fallen Empires card pool.`);
        continue;
      }

      const canonicalName = cardData.name;

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Fallen Empires 40.`);
        continue;
      }

      const isRestricted = RESTRICTED.has(canonicalName);
      const limit        = isRestricted ? MAX_RESTRICTED_COPIES : MAX_COPIES;
      if (totalQty > limit) {
        errors.push(copyLimitError(canonicalName, totalQty, mainQty, sideQty, limit, isRestricted));
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
