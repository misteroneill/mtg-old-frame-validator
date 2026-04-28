import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInSet } from '../../js/scryfall.js';
import { FE40 } from '../../js/formats/fe40.js';

const DB = {
  'elven fortress':      card('Elven Fortress',      'common',   'Instant'),
  'hymn to tourach':     card('Hymn to Tourach',     'common',   'Sorcery'),
  'dwarven catapult':    card('Dwarven Catapult',    'uncommon', 'Instant'),
  'hand of justice':     card('Hand of Justice',     'rare',     'Creature — Avatar'),
  'icatian javelineers': card('Icatian Javelineers', 'common',   'Creature — Human Soldier'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInSet).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('FE40', () => {
  it('accepts a valid 40-card deck', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Elven Fortress')]);
    const { valid, errors } = await FE40.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck with fewer than 40 cards', async () => {
    const d = deck([entry(4, 'Elven Fortress')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('at least 40 cards'))).toBe(true);
  });

  it('rejects sideboard with more than 5 cards', async () => {
    const d = deck(
      [entry(36, 'Forest'), entry(4, 'Elven Fortress')],
      [entry(6, 'Elven Fortress')],
    );
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('at most 5'))).toBe(true);
  });

  it('accepts sideboard of exactly 5 cards', async () => {
    // Use basic lands in the sideboard so they don't push the card over its 4-copy limit
    const d = deck(
      [entry(36, 'Forest'), entry(4, 'Elven Fortress')],
      [entry(5, 'Forest')],
    );
    const { valid, errors } = await FE40.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects card not in Fallen Empires', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Fallen Empires'))).toBe(true);
  });

  it('rejects banned card (Hymn to Tourach)', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Hymn to Tourach')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('Hymn to Tourach') && e.includes('banned'))).toBe(true);
  });

  it('rejects more than 4 copies of a regular card', async () => {
    const d = deck([entry(35, 'Forest'), entry(5, 'Elven Fortress')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('Elven Fortress') && e.includes('4 copies'))).toBe(true);
  });

  it('rejects more than 2 copies of a restricted card', async () => {
    const d = deck([entry(37, 'Forest'), entry(3, 'Dwarven Catapult')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('Dwarven Catapult') && e.includes('restricted'))).toBe(true);
  });

  it('accepts exactly 2 copies of a restricted card', async () => {
    const d = deck([entry(38, 'Forest'), entry(2, 'Hand of Justice')]);
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('Hand of Justice'))).toBe(false);
  });

  it('counts copies across main and sideboard combined', async () => {
    const d = deck(
      [entry(38, 'Forest'), entry(2, 'Dwarven Catapult')],
      [entry(1, 'Dwarven Catapult')],
    );
    const { errors } = await FE40.validate(d);
    expect(errors.some(e => e.includes('Dwarven Catapult') && e.includes('1 sideboard'))).toBe(true);
  });
});
