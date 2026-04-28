/**
 * Old School 93/94 (Swedish) format validator.
 * Rules: https://oldschool-mtg.blogspot.com/p/banrestriction.html
 *
 * Card pool: Alpha (lea), Beta (leb), Unlimited (2ed), Arabian Nights (arn),
 * Antiquities (atq), Legends (leg), The Dark (drk), Summer Magic (sum).
 * English-only printings are required by the rules; this cannot be enforced
 * by a card-name validator.
 *
 * Basic lands from any old frame set are unrestricted.
 *
 * Deck construction:
 *   - Minimum 60 cards mainboard
 *   - 0–15 card sideboard
 *   - Max 4 copies of any unrestricted card across main + sideboard combined
 *   - Restricted cards: max 1 copy across main + sideboard combined
 *   - No cards are banned; all 7 ante cards are legal for deck construction
 *     but must be physically removed from the deck before non-ante play
 *
 * Note: Contract from Below, Darkpact, and Tempest Efreet are on the
 * restricted list (max 1 copy). The other four ante cards — Bronze Tablet,
 * Demonic Attorney, Jeweled Bird, and Rebirth — are unrestricted (max 4).
 */

import { batchGetCardsInAnySets } from '../scryfall.js';

const LEGAL_SETS = ['lea', 'leb', '2ed', 'arn', 'atq', 'leg', 'drk', 'sum'];

const MIN_DECK_SIZE      = 60;
const MAX_SIDEBOARD_SIZE = 15;
const MAX_COPIES         = 4;
const MAX_RESTRICTED_COPIES = 1;

const RESTRICTED = new Set([
  'Ancestral Recall',
  'Balance',
  'Black Lotus',
  'Braingeyser',
  'Channel',
  'Chaos Orb',
  'Contract from Below',
  'Darkpact',
  'Demonic Tutor',
  'Library of Alexandria',
  'Mana Drain',
  'Mind Twist',
  "Mishra's Workshop",
  'Mox Emerald',
  'Mox Jet',
  'Mox Pearl',
  'Mox Ruby',
  'Mox Sapphire',
  'Regrowth',
  'Sol Ring',
  'Strip Mine',
  'Tempest Efreet',
  'Time Walk',
  'Timetwister',
  'Wheel of Fortune',
]);

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const Swedish = {
  id:   'swed',
  name: 'Old School 93/94 (Swedish)',

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
          `"${displayName}" was not found in Alpha, Beta, Unlimited, Arabian Nights, Antiquities, Legends, The Dark, or Summer Magic.`
        );
        continue;
      }

      const canonicalName = cardData.name;

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
