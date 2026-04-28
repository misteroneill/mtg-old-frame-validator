/**
 * Eternal Central 93/94 (EC) format validator.
 * Rules: https://www.eternalcentral.com/9394rules/
 *
 * Card pool: Alpha (lea), Beta (leb), Unlimited (2ed), CE (ced), IE (cei),
 * Arabian Nights (arn), Antiquities (atq), Revised (3ed), Legends (leg),
 * The Dark (drk), Fallen Empires (fem). Non-foil reprints with original art
 * and original frame in any language are also permitted; the validator checks
 * only that the card name was printed in a legal set.
 *
 * Three 1994 promo cards are also legal: Arena, Sewers of Estark, Nalathni Dragon.
 * Basic lands from any old frame set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Max 4 copies of any unrestricted card across main + sideboard combined
 *   - Restricted cards: max 1 copy across main + sideboard combined
 *   - All 7 ante cards are banned
 */

import { batchGetCardsInAnySets } from '../scryfall.js';
import { BASIC_LANDS, buildCombined, checkSizes, copyLimitError } from './shared.js';

// Sets ordered to maximise resolution rate; larger sets tried first.
const LEGAL_SETS = ['leg', '3ed', '2ed', 'leb', 'fem', 'lea', 'drk', 'arn', 'atq', 'ced', 'cei'];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 1;

// 1994 promo cards legal in EC but not found under any legal set code.
// Map from lowercase name → canonical name.
const LEGAL_PROMOS = new Map([
  ['arena',            'Arena'],
  ['sewers of estark', 'Sewers of Estark'],
  ['nalathni dragon',  'Nalathni Dragon'],
]);

// All 7 ante cards are banned outright.
const BANNED = new Set([
  'Bronze Tablet',
  'Contract from Below',
  'Darkpact',
  'Demonic Attorney',
  'Jeweled Bird',
  'Rebirth',
  'Tempest Efreet',
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
  'Recall',
  'Regrowth',
  'Sol Ring',
  'Time Vault',
  'Time Walk',
  'Timetwister',
  'Wheel of Fortune',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const EC = {
  id:   'ec',
  name: 'Eternal Central 93/94 (EC)',

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
      name => !BASIC_LANDS.has(name) && !LEGAL_PROMOS.has(name) && !cardPool.has(name)
    );
    if (toFetch.length > 0) {
      const fetched = await batchGetCardsInAnySets(toFetch, LEGAL_SETS);
      for (const [name, data] of fetched) cardPool.set(name.toLowerCase(), data);
    }

    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;
      if (BASIC_LANDS.has(key)) continue;

      const cardData      = cardPool.get(key);
      const promoName     = LEGAL_PROMOS.get(key);
      const canonicalName = cardData ? cardData.name : promoName;

      if (!canonicalName) {
        errors.push(
          `"${displayName}" was not found in Alpha, Beta, Unlimited, CE, IE, Arabian Nights, Antiquities, Revised, Legends, The Dark, or Fallen Empires.`
        );
        continue;
      }

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Eternal Central 93/94.`);
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
