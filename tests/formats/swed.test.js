import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { Swedish } from '../../js/formats/swed.js';

const DB = {
  'llanowar elves':      card('Llanowar Elves',      'common',   'Creature — Elf Druid'),
  'contract from below': card('Contract from Below', 'rare',     'Sorcery'),
  'bronze tablet':       card('Bronze Tablet',       'rare',     'Artifact'),
  'ancestral recall':    card('Ancestral Recall',    'rare',     'Instant'),
  'sol ring':            card('Sol Ring',            'uncommon', 'Artifact'),
  'tempest efreet':      card('Tempest Efreet',      'rare',     'Creature — Efreet'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('Swedish', () => {
  it('accepts a valid 60-card deck', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await Swedish.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(16, 'Llanowar Elves')],
    );
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in the legal sets', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Alpha'))).toBe(true);
  });

  it('allows ante cards — Contract from Below is not banned', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Contract from Below')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('banned'))).toBe(false);
  });

  it('allows Bronze Tablet (unrestricted ante card, max 4)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Bronze Tablet')]);
    const { valid, errors } = await Swedish.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects more than 1 copy of Ancestral Recall (restricted)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Ancestral Recall')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('Ancestral Recall') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 1 copy of Tempest Efreet (restricted ante card)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Tempest Efreet')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('Tempest Efreet') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 4 copies of an unrestricted card', async () => {
    const d = deck([entry(55, 'Forest'), entry(5, 'Llanowar Elves')]);
    const { errors } = await Swedish.validate(d);
    expect(errors.some(e => e.includes('Llanowar Elves') && e.includes('4 copies'))).toBe(true);
  });
});
