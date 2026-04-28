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

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
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

    // --- Populate card pool for unknown non-basic, non-promo cards ---
    const toFetch = [...combined.keys()].filter(
      name => !BASIC_LANDS.has(name) && !LEGAL_PROMOS.has(name) && !cardPool.has(name)
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

      const cardData      = cardPool.get(key);
      const promoName     = LEGAL_PROMOS.get(key);
      const canonicalName = cardData ? cardData.name : promoName;

      if (!canonicalName) {
        errors.push(
          `"${displayName}" was not found in Alpha, Beta, Unlimited, CE, IE, Arabian Nights, Antiquities, Revised, Legends, The Dark, or Fallen Empires.`
        );
        continue;
      }

      // Banned check
      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Eternal Central 93/94.`);
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
