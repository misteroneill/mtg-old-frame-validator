/**
 * Alpha to Alliances (A2A) format validator.
 * Rules: https://musiccityos.com/formats/alpha-alliances/
 *
 * Card pool: Alpha (lea), Beta (leb), Unlimited (2ed), CE (ced), IE (cei),
 * Arabian Nights (arn), Antiquities (atq), Revised (3ed), Legends (leg),
 * The Dark (drk), Fallen Empires (fem), Fourth Edition (4ed), Ice Age (ice),
 * Chronicles (chr), Homelands (hml), Alliances (all).
 *
 * Six promotional cards are also legal: Arena, Giant Badger, Nalathni Dragon,
 * Sewers of Estark, and Windseeker Centaur (unlimited copies); Mana Crypt
 * (restricted). These are not in any legal set code so are handled separately.
 *
 * Special unlimited-copy cards: any card whose type line includes "Aurochs"
 * or "Rat" may be run in unlimited quantities.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Basic lands (any set): no copy limit
 *   - Aurochs and Rat creatures: no copy limit
 *   - Restricted cards: max 1 copy across main + sideboard combined
 *   - All other legal cards: max 4 copies across main + sideboard combined
 *   - Banned: all 9 ante cards
 */

import { batchGetCardsInAnySets } from '../scryfall.js';
import { BASIC_LANDS, buildCombined, checkSizes, copyLimitError, isCardType } from './shared.js';

const UNLIMITED_CREATURE = /\b(?:Aurochs|Rat)\b/;

// Sets ordered to maximise resolution rate and minimise round-trips.
// Large sets (Ice Age, Fourth Edition) are tried first since they reprint many
// cards from earlier sets; unique-to-small-set cards fall through to the end.
const LEGAL_SETS = [
  'ice', '4ed', 'leg', '3ed', 'all', '2ed', 'leb',
  'fem', 'hml', 'chr', 'arn', 'atq', 'drk', 'lea', 'ced', 'cei',
];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 1;

// Promo cards legal in A2A but not found in any set code.
// Map from lowercase name → canonical name.
const LEGAL_PROMOS = new Map([
  ['arena',              'Arena'],
  ['giant badger',       'Giant Badger'],
  ['nalathni dragon',    'Nalathni Dragon'],
  ['sewers of estark',   'Sewers of Estark'],
  ['windseeker centaur', 'Windseeker Centaur'],
  ['mana crypt',         'Mana Crypt'],
]);

const BANNED = new Set([
  'Amulet of Quoz',
  'Bronze Tablet',
  'Contract from Below',
  'Darkpact',
  'Demonic Attorney',
  'Jeweled Bird',
  'Rebirth',
  'Tempest Efreet',
  'Timmerian Fiends',
]);

const RESTRICTED = new Set([
  'Ancestral Recall',
  'Balance',
  'Black Lotus',
  'Braingeyser',
  'Chaos Orb',
  'Channel',
  'Demonic Consultation',
  'Demonic Tutor',
  'Library of Alexandria',
  'Mana Crypt',
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

export const A2A = {
  id:   'a2a',
  name: 'Alpha to Alliances (A2A)',

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
        errors.push(`"${displayName}" was not found in the Alpha to Alliances card pool.`);
        continue;
      }

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Alpha to Alliances.`);
        continue;
      }

      // Aurochs and Rat creatures may be run in unlimited quantities
      if (cardData && isCardType(cardData, UNLIMITED_CREATURE)) continue;

      const isRestricted = RESTRICTED.has(canonicalName);
      const limit        = isRestricted ? MAX_RESTRICTED_COPIES : MAX_COPIES;
      if (totalQty > limit) {
        errors.push(copyLimitError(canonicalName, totalQty, mainQty, sideQty, limit, isRestricted));
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
