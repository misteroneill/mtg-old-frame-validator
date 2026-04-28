import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { ATL } from '../../js/formats/atl.js';

const DB = {
  'llanowar elves':    card('Llanowar Elves',    'common',   'Creature — Elf Druid'),
  'bronze tablet':     card('Bronze Tablet',     'rare',     'Artifact'),
  'contract from below': card('Contract from Below', 'rare', 'Sorcery'),
  'darkpact':          card('Darkpact',          'rare',     'Sorcery'),
  'ancestral recall':  card('Ancestral Recall',  'rare',     'Instant'),
  'sol ring':          card('Sol Ring',          'uncommon', 'Artifact'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('ATL', () => {
  it('accepts a valid 60-card deck', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await ATL.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(16, 'Llanowar Elves')],
    );
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in legal sets', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Alpha'))).toBe(true);
  });

  it('rejects BANNED card (Bronze Tablet)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Bronze Tablet')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('Bronze Tablet') && e.includes('banned'))).toBe(true);
  });

  it('rejects ANTE_BANNED card (Contract from Below)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Contract from Below')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('Contract from Below') && e.includes('banned'))).toBe(true);
  });

  it('rejects ANTE_BANNED card (Darkpact)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Darkpact')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('Darkpact') && e.includes('banned'))).toBe(true);
  });

  it('rejects more than 1 copy of a restricted card', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Ancestral Recall')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('Ancestral Recall') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 4 copies of an unrestricted card', async () => {
    const d = deck([entry(55, 'Forest'), entry(5, 'Llanowar Elves')]);
    const { errors } = await ATL.validate(d);
    expect(errors.some(e => e.includes('Llanowar Elves') && e.includes('4 copies'))).toBe(true);
  });
});
