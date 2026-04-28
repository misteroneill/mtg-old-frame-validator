import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { AAA } from '../../js/formats/aaa.js';

const DB = {
  'llanowar elves':      card('Llanowar Elves',      'common',   'Creature — Elf Druid'),
  'contract from below': card('Contract from Below', 'rare',     'Sorcery'),
  'jeweled bird':        card('Jeweled Bird',        'common',   'Artifact Creature — Bird'),
  'ancestral recall':    card('Ancestral Recall',    'rare',     'Instant'),
  'sol ring':            card('Sol Ring',            'uncommon', 'Artifact'),
  'aurochs':             card('Aurochs',             'common',   'Creature — Aurochs'),
  'plague rats':         card('Plague Rats',         'common',   'Creature — Rat'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('AAA', () => {
  it('accepts a valid 60-card deck', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await AAA.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(16, 'Llanowar Elves')],
    );
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in Alpha–Alliances card pool', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Alpha to Alliances'))).toBe(true);
  });

  it('allows ante cards — Contract from Below is legal (up to 1 as restricted)', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Contract from Below')]);
    const { valid, errors } = await AAA.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects more than 1 copy of Contract from Below (restricted)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Contract from Below')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('Contract from Below') && e.includes('restricted'))).toBe(true);
  });

  it('allows ante card Jeweled Bird (restricted to 1)', async () => {
    const d = deck([entry(59, 'Forest'), entry(1, 'Jeweled Bird')]);
    const { valid, errors } = await AAA.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects more than 1 copy of Jeweled Bird (restricted)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Jeweled Bird')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('Jeweled Bird') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 1 copy of Ancestral Recall (restricted)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Ancestral Recall')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('Ancestral Recall') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 4 copies of an unrestricted card', async () => {
    const d = deck([entry(55, 'Forest'), entry(5, 'Llanowar Elves')]);
    const { errors } = await AAA.validate(d);
    expect(errors.some(e => e.includes('Llanowar Elves') && e.includes('4 copies'))).toBe(true);
  });

  it('allows unlimited copies of Aurochs creatures', async () => {
    const d = deck([entry(40, 'Forest'), entry(20, 'Aurochs')]);
    const { valid, errors } = await AAA.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('allows unlimited copies of Rat creatures', async () => {
    const d = deck([entry(40, 'Forest'), entry(20, 'Plague Rats')]);
    const { valid, errors } = await AAA.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
