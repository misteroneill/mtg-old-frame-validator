/**
 * Shared utilities for format validator modules.
 */

export const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
]);

/**
 * Builds a combined main+side quantity map keyed by lowercase card name.
 * @param {Array<{qty:number, name:string}>} mainboard
 * @param {Array<{qty:number, name:string}>} sideboard
 * @returns {Map<string, {displayName:string, mainQty:number, sideQty:number}>}
 */
export function buildCombined(mainboard, sideboard) {
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
  return combined;
}

/**
 * Validates standard deck/sideboard sizes against a minimum and maximum.
 * @param {number} mainTotal
 * @param {number} sideTotal
 * @param {number} minDeck
 * @param {number} maxSideboard
 * @returns {string[]} Array of error strings (empty if valid).
 */
export function checkSizes(mainTotal, sideTotal, minDeck, maxSideboard) {
  const errors = [];
  if (mainTotal < minDeck) {
    errors.push(`Deck must contain at least ${minDeck} cards (found ${mainTotal}).`);
  }
  if (sideTotal > maxSideboard) {
    errors.push(`Sideboard may contain at most ${maxSideboard} cards (found ${sideTotal}).`);
  }
  return errors;
}

/**
 * Builds a copy-limit error string for a card that exceeds its allowed copies.
 * Uses singular "copy" when limit === 1, plural "copies" otherwise.
 * @param {string} canonicalName
 * @param {number} totalQty
 * @param {number} mainQty
 * @param {number} sideQty
 * @param {number} limit
 * @param {boolean} isRestricted
 * @returns {string}
 */
export function copyLimitError(canonicalName, totalQty, mainQty, sideQty, limit, isRestricted) {
  const location = sideQty > 0
    ? `${mainQty} main, ${sideQty} sideboard`
    : `${totalQty}`;
  const copyWord = limit === 1 ? 'copy' : 'copies';
  const reason = isRestricted
    ? `${canonicalName} is restricted — maximum ${limit} ${copyWord} allowed across main and sideboard`
    : `${canonicalName} — maximum ${limit} ${copyWord} allowed across main and sideboard`;
  return `${reason} (found ${location}).`;
}

/**
 * Returns true if the card's type line matches the given pattern.
 * @param {object} cardData  Scryfall card object
 * @param {RegExp} pattern
 * @returns {boolean}
 */
export function isCardType(cardData, pattern) {
  return pattern.test(cardData?.type_line ?? '');
}

/**
 * Returns the points contribution for a single card entry, or null if the card
 * has no point value.
 * @param {string} canonicalName
 * @param {number} totalQty
 * @param {Map<string,number>} pointsMap
 * @returns {{ contribution: number, label: string } | null}
 */
export function getPointsContribution(canonicalName, totalQty, pointsMap) {
  const pts = pointsMap.get(canonicalName);
  if (!pts) return null;
  const contribution = pts * totalQty;
  const label = totalQty > 1
    ? `${canonicalName} (${pts}×${totalQty})`
    : `${canonicalName} (${pts})`;
  return { contribution, label };
}

/**
 * Returns a points-cap error string if totalPoints exceeds maxPoints, else null.
 * @param {number} totalPoints
 * @param {number} maxPoints
 * @param {string[]} breakdown  Labels from getPointsContribution
 * @returns {string | null}
 */
export function checkPointsLimit(totalPoints, maxPoints, breakdown) {
  if (totalPoints <= maxPoints) return null;
  return `Deck exceeds the ${maxPoints}-point limit (${totalPoints} points: ${breakdown.join(', ')}).`;
}
