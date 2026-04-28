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
import { BASIC_LANDS, buildCombined, checkSizes, copyLimitError } from './shared.js';

const LEGAL_SETS = ['drk', 'fem', 'hml'];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
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

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const ForgottenRealms = {
  id:   'fr',
  name: 'Forgotten Realms (DRK/FEM/HML)',

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
      const fetched = await batchGetCardsInAnySets(toFetch, LEGAL_SETS);
      for (const [name, data] of fetched) cardPool.set(name.toLowerCase(), data);
    }

    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;
      if (BASIC_LANDS.has(key)) continue;

      const cardData = cardPool.get(key);
      if (!cardData) {
        errors.push(`"${displayName}" was not found in The Dark, Fallen Empires, or Homelands.`);
        continue;
      }

      const canonicalName = cardData.name;

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Forgotten Realms.`);
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
