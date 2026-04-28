/**
 * Alpha to Alliances Ante (AAA) format validator.
 * Rules: https://musiccityos.com/formats/ante/
 *
 * Uses the Alpha to Alliances (A2A) rules with all nine ante cards un-banned.
 * Two ante cards are restricted to one copy; the remaining seven are legal
 * at the standard four-copy limit.
 *
 * See a2a.js for the full card pool, promo card, and Aurochs/Rat rules.
 */

import { batchGetCardsInAnySets } from '../scryfall.js';

const LEGAL_SETS = [
  'ice', '4ed', 'leg', '3ed', 'all', '2ed', 'leb',
  'fem', 'hml', 'chr', 'arn', 'atq', 'drk', 'lea', 'ced', 'cei',
];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 1;

const LEGAL_PROMOS = new Map([
  ['arena',              'Arena'],
  ['giant badger',       'Giant Badger'],
  ['nalathni dragon',    'Nalathni Dragon'],
  ['sewers of estark',   'Sewers of Estark'],
  ['windseeker centaur', 'Windseeker Centaur'],
  ['mana crypt',         'Mana Crypt'],
]);

// No cards are banned; all nine ante cards are legal in this format.
const BANNED = new Set();

const RESTRICTED = new Set([
  'Ancestral Recall',
  'Balance',
  'Black Lotus',
  'Braingeyser',
  'Chaos Orb',
  'Channel',
  // Ante cards restricted to 1 in AAA
  'Contract from Below',
  'Demonic Consultation',
  'Demonic Tutor',
  // Ante card restricted to 1 in AAA
  'Jeweled Bird',
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

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const AAA = {
  id:   'aaa',
  name: 'Alpha to Alliances Ante (AAA)',

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
          `"${displayName}" was not found in the Alpha to Alliances card pool.`
        );
        continue;
      }

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Alpha to Alliances Ante.`);
        continue;
      }

      // Aurochs and Rat creatures may be run in unlimited quantities
      if (cardData) {
        const typeLine = cardData.type_line ?? '';
        if (/\bAurochs\b/.test(typeLine) || /\bRat\b/.test(typeLine)) {
          continue;
        }
      }

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
