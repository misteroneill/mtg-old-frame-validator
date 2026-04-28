/**
 * Atlantic 93/94 (ATL) format validator.
 * Rules: https://sentineloldschoolmtg.com/atlantic-93-94/
 *
 * Card pool: Limited Edition Alpha (lea), Limited Edition Beta (leb),
 * Arabian Nights (arn), Antiquities (atq), Legends (leg), The Dark (drk),
 * Fallen Empires (fem). Reprint policy (CE/ICE, etc.) is left to each
 * community; this validator checks only that the card name was printed in a
 * legal set.
 *
 * Basic lands from any old frame set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Max 4 copies of any unrestricted card across main + sideboard combined
 *   - Restricted cards: max 1 copy across main + sideboard combined
 *   - Banned cards: not permitted at all
 */

import { batchGetCardsInAnySets } from '../scryfall.js';
import { BASIC_LANDS, buildCombined, checkSizes, copyLimitError } from './shared.js';

const LEGAL_SETS = ['lea', 'leb', 'arn', 'atq', 'leg', 'drk', 'fem'];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 1;

const BANNED = new Set([
  'Bronze Tablet',
  'Demonic Attorney',
  'Jeweled Bird',
  'Rebirth',
  'Tempest Efreet',
]);

const ANTE_BANNED = new Set([
  'Contract from Below',
  'Darkpact',
]);

const RESTRICTED = new Set([
  'Ancestral Recall',
  'Balance',
  'Black Lotus',
  'Braingeyser',
  'Chaos Orb',
  'Channel',
  'Demonic Tutor',
  'Library of Alexandria',
  'Mana Drain',
  'Mind Twist',
  'Mox Emerald',
  'Mox Jet',
  'Mox Pearl',
  'Mox Ruby',
  'Mox Sapphire',
  'Regrowth',
  'Sol Ring',
  'Strip Mine',
  'Time Walk',
  'Timetwister',
  'Wheel of Fortune',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const ATL = {
  id:   'atl',
  name: 'Atlantic 93/94 (ATL)',

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
        errors.push(
          `"${displayName}" was not found in Alpha, Beta, Arabian Nights, Antiquities, Legends, The Dark, or Fallen Empires.`
        );
        continue;
      }

      const canonicalName = cardData.name;

      if (BANNED.has(canonicalName) || ANTE_BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Atlantic 93/94.`);
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
