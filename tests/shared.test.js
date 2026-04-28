import { describe, it, expect } from 'vitest';
import {
  BASIC_LANDS,
  buildCombined,
  checkSizes,
  copyLimitError,
  isCardType,
  getPointsContribution,
  checkPointsLimit,
} from '../js/formats/shared.js';

describe('BASIC_LANDS', () => {
  it('contains all five basic land names', () => {
    expect(BASIC_LANDS.has('plains')).toBe(true);
    expect(BASIC_LANDS.has('island')).toBe(true);
    expect(BASIC_LANDS.has('swamp')).toBe(true);
    expect(BASIC_LANDS.has('mountain')).toBe(true);
    expect(BASIC_LANDS.has('forest')).toBe(true);
  });

  it('does not contain non-basic lands', () => {
    expect(BASIC_LANDS.has('lightning bolt')).toBe(false);
    expect(BASIC_LANDS.has('Plains')).toBe(false);
  });
});

describe('buildCombined', () => {
  it('tallies mainboard entries by lowercase key', () => {
    const combined = buildCombined([{ qty: 4, name: 'Lightning Bolt' }], []);
    expect(combined.get('lightning bolt')).toEqual({ displayName: 'Lightning Bolt', mainQty: 4, sideQty: 0 });
  });

  it('merges main and sideboard quantities', () => {
    const combined = buildCombined(
      [{ qty: 3, name: 'Sol Ring' }],
      [{ qty: 1, name: 'Sol Ring' }],
    );
    expect(combined.get('sol ring')).toEqual({ displayName: 'Sol Ring', mainQty: 3, sideQty: 1 });
  });

  it('preserves displayName from first occurrence', () => {
    const combined = buildCombined([{ qty: 1, name: 'Black Lotus' }], [{ qty: 1, name: 'black lotus' }]);
    expect(combined.get('black lotus').displayName).toBe('Black Lotus');
  });

  it('handles multiple distinct cards', () => {
    const combined = buildCombined(
      [{ qty: 4, name: 'Forest' }, { qty: 4, name: 'Island' }],
      [],
    );
    expect(combined.size).toBe(2);
  });

  it('returns empty map for empty deck', () => {
    expect(buildCombined([], []).size).toBe(0);
  });
});

describe('checkSizes', () => {
  it('returns no errors when deck meets minimum and sideboard within limit', () => {
    expect(checkSizes(60, 10, 60, 15)).toEqual([]);
  });

  it('returns error when deck is too small', () => {
    const errors = checkSizes(59, 0, 60, 15);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/at least 60 cards/);
    expect(errors[0]).toMatch(/found 59/);
  });

  it('returns error when sideboard exceeds maximum', () => {
    const errors = checkSizes(60, 16, 60, 15);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/at most 15/);
    expect(errors[0]).toMatch(/found 16/);
  });

  it('can return both errors simultaneously', () => {
    expect(checkSizes(0, 20, 60, 15)).toHaveLength(2);
  });
});

describe('copyLimitError', () => {
  it('uses plural "copies" when limit > 1', () => {
    const msg = copyLimitError('Lightning Bolt', 5, 5, 0, 4, false);
    expect(msg).toContain('4 copies');
    expect(msg).toContain('found 5');
  });

  it('uses singular "copy" when limit === 1', () => {
    const msg = copyLimitError('Sol Ring', 2, 2, 0, 1, true);
    expect(msg).toContain('1 copy');
    expect(msg).toContain('Sol Ring is restricted');
  });

  it('includes main/sideboard breakdown when sideboard > 0', () => {
    const msg = copyLimitError('Black Lotus', 2, 1, 1, 1, true);
    expect(msg).toContain('1 main, 1 sideboard');
  });

  it('shows plain total when sideboard is 0', () => {
    const msg = copyLimitError('Lightning Bolt', 5, 5, 0, 4, false);
    expect(msg).toContain('found 5');
    expect(msg).not.toContain('main,');
  });

  it('uses unrestricted phrasing when isRestricted is false', () => {
    const msg = copyLimitError('Lightning Bolt', 5, 5, 0, 4, false);
    expect(msg).not.toContain('is restricted');
    expect(msg).toMatch(/^Lightning Bolt —/);
  });
});

describe('isCardType', () => {
  it('returns true when type_line matches pattern', () => {
    expect(isCardType({ type_line: 'Creature — Aurochs' }, /\bAurochs\b/)).toBe(true);
    expect(isCardType({ type_line: 'Creature — Rat' }, /\bRat\b/)).toBe(true);
  });

  it('returns false when type_line does not match', () => {
    expect(isCardType({ type_line: 'Instant' }, /\bAurochs\b/)).toBe(false);
  });

  it('returns false for null cardData', () => {
    expect(isCardType(null, /\bAurochs\b/)).toBe(false);
    expect(isCardType(undefined, /\bAurochs\b/)).toBe(false);
  });
});

describe('getPointsContribution', () => {
  const POINTS = new Map([['Ancestral Recall', 4], ['Sol Ring', 2]]);

  it('returns null for card not in points map', () => {
    expect(getPointsContribution('Lightning Bolt', 1, POINTS)).toBeNull();
  });

  it('returns contribution and label for single copy', () => {
    const result = getPointsContribution('Sol Ring', 1, POINTS);
    expect(result).toEqual({ contribution: 2, label: 'Sol Ring (2)' });
  });

  it('returns multiplied contribution and label for multiple copies', () => {
    const result = getPointsContribution('Sol Ring', 2, POINTS);
    expect(result).toEqual({ contribution: 4, label: 'Sol Ring (2×2)' });
  });
});

describe('checkPointsLimit', () => {
  it('returns null when under the limit', () => {
    expect(checkPointsLimit(6, 7, ['Sol Ring (2)', 'Black Lotus (2)'])).toBeNull();
  });

  it('returns null when exactly at the limit', () => {
    expect(checkPointsLimit(7, 7, ['Sol Ring (2)'])).toBeNull();
  });

  it('returns error string when over the limit', () => {
    const err = checkPointsLimit(8, 7, ['Ancestral Recall (4)', 'Sol Ring (2)', 'Black Lotus (2)']);
    expect(err).toContain('7-point limit');
    expect(err).toContain('8 points');
    expect(err).toContain('Ancestral Recall (4)');
  });
});
