import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { SevenPts } from '../../js/formats/7pts.js';

const DB = {
  'llanowar elves':   card('Llanowar Elves',   'common',   'Creature — Elf Druid'),
  'amulet of quoz':   card('Amulet of Quoz',   'rare',     'Artifact'),
  'ancestral recall': card('Ancestral Recall', 'rare',     'Instant'),
  'black lotus':      card('Black Lotus',      'rare',     'Artifact'),
  'sol ring':         card('Sol Ring',         'uncommon', 'Artifact'),
  'hymn to tourach':  card('Hymn to Tourach',  'common',   'Sorcery'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('SevenPts (7pts)', () => {
  it('accepts a valid 60-card singleton deck', async () => {
    const d = deck([
      entry(56, 'Forest'),
      entry(1, 'Llanowar Elves'),
      entry(1, 'Sol Ring'),
      entry(1, 'Hymn to Tourach'),
      entry(1, 'Ancestral Recall'),
    ]);
    const { valid, errors } = await SevenPts.validate(d);
    // Ancestral Recall = 4pts, Hymn to Tourach = 1pt, Sol Ring = 2pt = 7pts total (at limit)
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck that is not exactly 60 cards (too few)', async () => {
    const d = deck([entry(59, 'Forest')]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('exactly 60 cards'))).toBe(true);
  });

  it('rejects deck that is not exactly 60 cards (too many)', async () => {
    const d = deck([entry(61, 'Forest')]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('exactly 60 cards'))).toBe(true);
  });

  it('rejects any sideboard', async () => {
    const d = deck(
      [entry(60, 'Forest')],
      [entry(1, 'Llanowar Elves')],
    );
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('does not allow a sideboard'))).toBe(true);
  });

  it('rejects sideboard of 1 card with singular wording', async () => {
    const d = deck(
      [entry(60, 'Forest')],
      [entry(1, 'Llanowar Elves')],
    );
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('1 card') && !e.includes('cards'))).toBe(true);
  });

  it('rejects card not in Alpha, Beta, Arabian Nights, Antiquities, Legends, Dark, FE', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Fake Card')]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Alpha'))).toBe(true);
  });

  it('rejects banned ante card (Amulet of Quoz)', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Amulet of Quoz')]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('Amulet of Quoz') && e.includes('banned'))).toBe(true);
  });

  it('rejects more than 1 copy of any non-basic card (singleton)', async () => {
    const d = deck([entry(58, 'Forest'), entry(2, 'Llanowar Elves')]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('Llanowar Elves') && e.includes('only 1 copy'))).toBe(true);
  });

  it('rejects deck that exceeds the 7-point limit', async () => {
    // Ancestral Recall = 4pts, Black Lotus = 2pts, Sol Ring = 2pts = 8pts
    const d = deck([
      entry(57, 'Forest'),
      entry(1, 'Ancestral Recall'),
      entry(1, 'Black Lotus'),
      entry(1, 'Sol Ring'),
    ]);
    const { errors } = await SevenPts.validate(d);
    expect(errors.some(e => e.includes('7-point limit'))).toBe(true);
  });

  it('accepts promo card Arena', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Arena')]);
    const { valid, errors } = await SevenPts.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('accepts promo card Sewers of Estark', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Sewers of Estark')]);
    const { valid, errors } = await SevenPts.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('accepts promo card Nalathni Dragon', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Nalathni Dragon')]);
    const { valid, errors } = await SevenPts.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
