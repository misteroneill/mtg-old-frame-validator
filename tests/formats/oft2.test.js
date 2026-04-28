import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { OFT2 } from '../../js/formats/oft2.js';

const DB = {
  'llanowar elves': card('Llanowar Elves', 'common', 'Creature — Elf Druid'),
  'balance':        card('Balance',        'rare',   'Sorcery'),
  'sol ring':       card('Sol Ring',       'uncommon','Artifact'),
  'mind twist':     card('Mind Twist',     'rare',   'Sorcery'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('OFT2', () => {
  it('accepts a valid 60-card deck', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await OFT2.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(16, 'Llanowar Elves')],
    );
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in Revised/Dark/FE pool', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Revised'))).toBe(true);
  });

  it('rejects banned card (Balance)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Balance')]);
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('Balance') && e.includes('banned'))).toBe(true);
  });

  it('rejects banned card (Sol Ring)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Sol Ring')]);
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('Sol Ring') && e.includes('banned'))).toBe(true);
  });

  it('has no restricted list — allows 4 copies of non-banned card', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { errors } = await OFT2.validate(d);
    expect(errors).toEqual([]);
  });

  it('rejects more than 4 copies', async () => {
    const d = deck([entry(55, 'Forest'), entry(5, 'Llanowar Elves')]);
    const { errors } = await OFT2.validate(d);
    expect(errors.some(e => e.includes('Llanowar Elves') && e.includes('4 copies'))).toBe(true);
  });
});
