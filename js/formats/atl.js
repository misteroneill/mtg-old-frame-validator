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

// Ante cards that are banned outright (not restricted) in non-ante play
const ANTE_BANNED = new Set([
  'Contract From Below',
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

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
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
        errors.push(
          `"${displayName}" was not found in Alpha, Beta, Arabian Nights, Antiquities, Legends, The Dark, or Fallen Empires.`
        );
        continue;
      }

      const canonicalName = cardData.name;

      // Banned check (outright banned)
      if (BANNED.has(canonicalName) || ANTE_BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Atlantic 93/94.`);
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
