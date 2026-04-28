/**
 * 7 Points Singleton 93/94 (7pts) format validator.
 * Rules: https://7pts-singleton.com/
 *
 * Card pool: Alpha (lea), Beta (leb), Arabian Nights (arn), Antiquities (atq),
 * Legends (leg), The Dark (drk), Fallen Empires (fem). Reprints with original
 * artwork from Unlimited, Revised, 4th/5th Edition, etc. are permitted;
 * the validator checks only that the card name was printed in a legal set.
 *
 * Three 1994 promo cards are also legal: Arena, Sewers of Estark, Nalathni Dragon.
 *
 * Deck construction:
 *   - Exactly 60 cards mainboard (no more, no less)
 *   - No sideboard permitted
 *   - Basic lands: no copy limit
 *   - All other cards: singleton (max 1 copy)
 *   - Only ante cards are banned
 *   - Total point value of all cards in the deck must not exceed 7
 *
 * Note: the Ring of Ma'ruf errata allowing it to fetch cards that break the
 * 7-point limit is a gameplay rule and does not affect deck construction.
 */

import { batchGetCardsInAnySets } from '../scryfall.js';
import {
  BASIC_LANDS, buildCombined,
  getPointsContribution, checkPointsLimit,
} from './shared.js';

const LEGAL_SETS = ['lea', 'leb', 'arn', 'atq', 'leg', 'drk', 'fem'];

const EXACT_DECK_SIZE = 60;
const MAX_COPIES      = 1;
const MAX_POINTS      = 7;

// 1994 promo cards legal in this format but not found under any legal set code.
// Map from lowercase name → canonical name.
const LEGAL_PROMOS = new Map([
  ['arena',            'Arena'],
  ['sewers of estark', 'Sewers of Estark'],
  ['nalathni dragon',  'Nalathni Dragon'],
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

// Point values per card (canonical Scryfall name → points).
const POINTS = new Map([
  ['Ancestral Recall',      4],
  ['Braingeyser',           3],
  ['Control Magic',         3],
  ['Disintegrate',          3],
  ['Fireball',              3],
  ['Library of Alexandria', 3],
  ['Mind Twist',            3],
  ['Armageddon',            2],
  ['Black Lotus',           2],
  ['Demonic Tutor',         2],
  ['Earthquake',            2],
  ['Falling Star',          2],
  ['Mana Drain',            2],
  ['Moat',                  2],
  ['Mox Emerald',           2],
  ['Mox Jet',               2],
  ['Mox Pearl',             2],
  ['Mox Ruby',              2],
  ['Mox Sapphire',          2],
  ['Land Tax',              2],
  ['Sol Ring',              2],
  ['The Abyss',             2],
  ['Time Walk',             2],
  ['Amnesia',               1],
  ['Balance',               1],
  ['Black Vise',            1],
  ['Dark Ritual',           1],
  ['Drain Life',            1],
  ['Guardian Beast',        1],
  ['Hymn to Tourach',       1],
  ['Icy Manipulator',       1],
  ['Karakas',               1],
  ['Mana Vault',            1],
  ['Maze of Ith',           1],
  ['Old Man of the Sea',    1],
  ['Pestilence',            1],
  ['Pyrotechnics',          1],
  ['Recall',                1],
  ['Regrowth',              1],
  ['Steal Artifact',        1],
  ['Triskelion',            1],
  ['Winter Orb',            1],
]);

// Module-level card pool cache: persists across validate() calls within a session.
const cardPool = new Map();

export const SevenPts = {
  id:   '7pt',
  name: '7 Points Singleton 93/94 (7pts)',

  /**
   * @param {{ mainboard: Array<{qty:number, name:string}>, sideboard: Array<{qty:number, name:string}> }} deck
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validate(deck) {
    const { mainboard, sideboard } = deck;

    const mainTotal = mainboard.reduce((s, c) => s + c.qty, 0);
    const sideTotal = sideboard.reduce((s, c) => s + c.qty, 0);

    const errors = [];
    if (mainTotal !== EXACT_DECK_SIZE) {
      errors.push(`Deck must contain exactly ${EXACT_DECK_SIZE} cards (found ${mainTotal}).`);
    }
    if (sideTotal > 0) {
      errors.push(
        `7 Points Singleton 93/94 does not allow a sideboard (found ${sideTotal} card${sideTotal === 1 ? '' : 's'}).`
      );
    }

    const combined = buildCombined(mainboard, sideboard);
    if (combined.size === 0) return { valid: errors.length === 0, errors };

    const toFetch = [...combined.keys()].filter(
      name => !BASIC_LANDS.has(name) && !LEGAL_PROMOS.has(name) && !cardPool.has(name)
    );
    if (toFetch.length > 0) {
      const fetched = await batchGetCardsInAnySets(toFetch, LEGAL_SETS);
      for (const [name, data] of fetched) cardPool.set(name.toLowerCase(), data);
    }

    let totalPoints = 0;
    const pointsBreakdown = [];

    for (const [key, { displayName, mainQty, sideQty }] of combined) {
      const totalQty = mainQty + sideQty;
      if (BASIC_LANDS.has(key)) continue;

      const cardData      = cardPool.get(key);
      const promoName     = LEGAL_PROMOS.get(key);
      const canonicalName = cardData ? cardData.name : promoName;

      if (!canonicalName) {
        errors.push(
          `"${displayName}" was not found in Alpha, Beta, Arabian Nights, Antiquities, Legends, The Dark, or Fallen Empires.`
        );
        continue;
      }

      if (BANNED.has(canonicalName)) {
        errors.push(`${canonicalName} is banned in 7 Points Singleton 93/94.`);
        continue;
      }

      if (totalQty > MAX_COPIES) {
        const location = sideQty > 0
          ? `${mainQty} main, ${sideQty} sideboard`
          : `${totalQty}`;
        errors.push(`${canonicalName} — only 1 copy allowed in a singleton format (found ${location}).`);
      }

      const pts = getPointsContribution(canonicalName, totalQty, POINTS);
      if (pts) {
        totalPoints += pts.contribution;
        pointsBreakdown.push(pts.label);
      }
    }

    const pointsError = checkPointsLimit(totalPoints, MAX_POINTS, pointsBreakdown);
    if (pointsError) errors.push(pointsError);

    return { valid: errors.length === 0, errors };
  },
};
