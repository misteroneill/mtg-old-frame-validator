/**
 * X-Point Old School 93/94 (Xpts) format validator.
 * Rules: https://xpointoldschool.com/rules-points/
 *
 * Base rules are identical to Atlantic 93/94 (ATL): same legal sets
 * (lea, leb, arn, atq, leg, drk, fem), same banned and restricted lists.
 *
 * Additional constraint: the total point value of all cards across the main
 * deck and sideboard combined must not exceed 10. Point values are assigned
 * to specific powerful cards; all other legal cards cost 0 points.
 *
 * Reprint policy per xpointoldschool.com: same art, same frame, all languages;
 * Alpha proxies, CE/IE, WCD, and M30 are permitted. No custom proxies.
 * The validator checks only that the card name was printed in a legal set.
 */

import { batchGetCardsInAnySets } from '../scryfall.js';

const LEGAL_SETS = ['lea', 'leb', 'arn', 'atq', 'leg', 'drk', 'fem'];

const MIN_DECK_SIZE         = 60;
const MAX_SIDEBOARD_SIZE    = 15;
const MAX_COPIES            = 4;
const MAX_RESTRICTED_COPIES = 1;
const MAX_POINTS            = 10;

// Point values per card (canonical Scryfall name → points).
// Each copy of a card contributes its point value; e.g. 4 Hymn to Tourach = 8 pts.
const POINTS = new Map([
  ['Ancestral Recall',    6],
  ['Mind Twist',          4],
  ['Black Lotus',         3],
  ['Demonic Tutor',       3],
  ['Library of Alexandria', 3],
  ['Balance',             2],
  ['Braingeyser',         2],
  ['Hymn to Tourach',     2],
  ['Land Tax',            2],
  ['Mox Emerald',         2],
  ['Mox Jet',             2],
  ['Mox Pearl',           2],
  ['Mox Ruby',            2],
  ['Mox Sapphire',        2],
  ['Sol Ring',            2],
  ['Time Walk',           2],
  ['Timetwister',         2],
  ['Wheel of Fortune',    2],
  ['Armageddon',          1],
  ['Mana Drain',          1],
  ['Maze of Ith',         1],
  ["Mishra's Factory",    1],
  ["Mishra's Workshop",   1],
  ['Moat',                1],
  ['Recall',              1],
  ['Regrowth',            1],
  ['The Abyss',           1],
]);

// Identical to ATL banned list.
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

// Identical to ATL restricted list.
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

export const Xpts = {
  id:   'xpt',
  name: 'X-Point Old School 93/94 (Xpts)',

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

    // --- Per-card rule checks + points accumulation ---
    let totalPoints = 0;
    const pointsBreakdown = [];

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

      // Banned check
      if (BANNED.has(canonicalName) || ANTE_BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in X-Point Old School 93/94 (Xpts).`);
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

      // Accumulate points (each copy of a pointed card costs its value)
      const pts = POINTS.get(canonicalName);
      if (pts) {
        const contribution = pts * totalQty;
        totalPoints += contribution;
        const label = totalQty > 1 ? `${canonicalName} (${pts}×${totalQty})` : `${canonicalName} (${pts})`;
        pointsBreakdown.push(label);
      }
    }

    // --- Points cap check ---
    if (totalPoints > MAX_POINTS) {
      errors.push(
        `Deck exceeds the ${MAX_POINTS}-point limit (${totalPoints} points: ${pointsBreakdown.join(', ')}).`
      );
    }

    return { valid: errors.length === 0, errors };
  },
};
