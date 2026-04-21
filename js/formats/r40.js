/**
 * Revised 40 (R40) format validator.
 *
 * Rules: https://northernpaladins.com/r40/
 *
 * Card pool: Revised Edition (3rd Edition / 3ed) including FWB/FBB foreign
 * printings and Summer Magic — all of which share the Revised card pool.
 * Legality is determined by whether the card exists in the 3ed Scryfall set.
 *
 * Deck construction:
 *   - Minimum 40 cards, no maximum
 *   - No sideboard
 *   - Up to 5 rares, max 3 copies of the same rare
 *   - Up to 10 uncommons, max 3 copies of the same uncommon
 *   - Any number of the same common (exceptions: restricted list)
 *   - Restricted (max 1): Balance, Braingeyser, Channel, Demonic Tutor,
 *                         Fireball, Regrowth, Sol Ring, Wheel of Fortune
 *   - Banned: Contract from Below, Darkpact, Demonic Attorney, Mind Twist
 *   - Upgraded to uncommon (max 3, counts toward uncommon limit):
 *       Kird Ape, Lightning Bolt
 */

import { batchGetCardsInSet } from '../scryfall.js';

const LEGAL_SET = '3ed';

const MIN_DECK_SIZE = 40;
const MAX_RARES = 5;
const MAX_COPIES_OF_RARE = 3;
const MAX_UNCOMMONS = 10;
const MAX_COPIES_OF_UNCOMMON = 3;

// Canonical names (as Scryfall returns them) for rule lookups.
// Comparisons are done against the name returned by Scryfall so that
// user capitalisation does not matter.
const RESTRICTED = new Set([
  'Balance',
  'Braingeyser',
  'Channel',
  'Demonic Tutor',
  'Fireball',
  'Regrowth',
  'Sol Ring',
  'Wheel of Fortune',
]);

const BANNED = new Set([
  'Contract from Below',
  'Darkpact',
  'Demonic Attorney',
  'Mind Twist',
]);

// Commons that count as uncommons in R40
const UPGRADED_TO_UNCOMMON = new Set([
  'Kird Ape',
  'Lightning Bolt',
]);

// Module-level card pool cache: persists across validate() calls within a session.
// The Revised card pool never changes, so a card looked up once is known for the
// lifetime of the page. Keyed by lowercase card name; values are Scryfall card
// objects (or null when a name is not in the Revised pool).
const cardPool = new Map();

export const R40 = {
  id: 'r40',
  name: 'Revised 40 (R40)',

  /**
   * @param {{ mainboard: Array<{qty:number, name:string}>, sideboard: Array<{qty:number, name:string}> }} deck
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validate(deck) {
    const errors = [];
    const { mainboard, sideboard } = deck;

    // --- No sideboard ---
    if (sideboard.length > 0) {
      const total = sideboard.reduce((s, c) => s + c.qty, 0);
      errors.push(
        `Revised 40 does not use a sideboard (found ${total} sideboard card${total !== 1 ? 's' : ''}).`
      );
    }

    // --- Minimum deck size ---
    const totalCards = mainboard.reduce((s, c) => s + c.qty, 0);
    if (totalCards < MIN_DECK_SIZE) {
      errors.push(
        `Deck must contain at least ${MIN_DECK_SIZE} cards (found ${totalCards}).`
      );
    }

    if (mainboard.length === 0) {
      return { valid: errors.length === 0, errors };
    }

    // --- Populate card pool for any names not yet seen this session ---
    // Collect unique names absent from the module-level cache, then fetch them
    // all in one POST to /cards/collection rather than one request per card.
    const unknownNames = [
      ...new Set(mainboard.map(c => c.name.toLowerCase())),
    ].filter(n => !cardPool.has(n));

    if (unknownNames.length > 0) {
      const fetched = await batchGetCardsInSet(unknownNames, LEGAL_SET);
      for (const [name, data] of fetched) {
        cardPool.set(name.toLowerCase(), data);
      }
    }

    // --- Per-card rule checks ---
    let totalRares = 0;
    let totalUncommons = 0;

    for (const { qty, name } of mainboard) {
      const cardData = cardPool.get(name.toLowerCase());
      const canonicalName = cardData ? cardData.name : name;

      // Banned check
      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in Revised 40.`);
        continue; // skip further checks for this card
      }

      // Legal card pool check
      if (!cardData) {
        errors.push(`"${name}" was not found in the Revised Edition card pool.`);
        continue;
      }

      const isRestricted = RESTRICTED.has(canonicalName);
      const isUpgraded   = UPGRADED_TO_UNCOMMON.has(canonicalName);

      // Determine effective rarity
      let rarity = cardData.rarity; // 'common' | 'uncommon' | 'rare' | 'mythic'
      if (isUpgraded) rarity = 'uncommon';

      // Per-card copy limit
      if (isRestricted && qty > 1) {
        errors.push(
          `${canonicalName} is restricted in Revised 40 — maximum 1 copy allowed (found ${qty}).`
        );
      } else if (rarity === 'rare' && qty > MAX_COPIES_OF_RARE) {
        errors.push(
          `${canonicalName} is rare — maximum ${MAX_COPIES_OF_RARE} copies allowed (found ${qty}).`
        );
      } else if (rarity === 'uncommon' && qty > MAX_COPIES_OF_UNCOMMON) {
        const label = isUpgraded ? `${canonicalName} is upgraded to uncommon` : `${canonicalName} is uncommon`;
        errors.push(
          `${label} — maximum ${MAX_COPIES_OF_UNCOMMON} copies allowed (found ${qty}).`
        );
      }

      // Accumulate totals (use actual qty even if over limit, to report accurate total)
      if (rarity === 'rare' || rarity === 'mythic') {
        totalRares += qty;
      } else if (rarity === 'uncommon') {
        totalUncommons += qty;
      }
    }

    // --- Total rare / uncommon limits ---
    if (totalRares > MAX_RARES) {
      errors.push(
        `Deck may include at most ${MAX_RARES} rares total (found ${totalRares}).`
      );
    }
    if (totalUncommons > MAX_UNCOMMONS) {
      errors.push(
        `Deck may include at most ${MAX_UNCOMMONS} uncommons total (found ${totalUncommons}). ` +
        `Note: Kird Ape and Lightning Bolt count as uncommons.`
      );
    }

    return { valid: errors.length === 0, errors };
  },
};
