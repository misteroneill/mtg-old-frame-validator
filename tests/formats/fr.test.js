import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { ForgottenRealms } from '../../js/formats/fr.js';

const DB = {
  'nameless race':     card('Nameless Race',     'common', 'Creature'),
  'an-zerrin ruins':   card('An-Zerrin Ruins',   'rare',   'Enchantment'),
  'apocalypse chime':  card('Apocalypse Chime',  'rare',   'Artifact'),
  'hymn to tourach':   card('Hymn to Tourach',   'common', 'Sorcery'),
  'maze of ith':       card('Maze of Ith',       'uncommon','Land'),
  'serrated arrows':   card('Serrated Arrows',   'common', 'Artifact'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('ForgottenRealms', () => {
  it('accepts a valid 60-card deck', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Nameless Race')]);
    const { valid, errors } = await ForgottenRealms.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Nameless Race')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Nameless Race')],
      [entry(16, 'Nameless Race')],
    );
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in DRK/FEM/HML', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Counterfeit Card')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('"Counterfeit Card"') && e.includes('The Dark'))).toBe(true);
  });

  it('rejects An-Zerrin Ruins (banned)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'An-Zerrin Ruins')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('An-Zerrin Ruins') && e.includes('banned'))).toBe(true);
  });

  it('rejects Apocalypse Chime (banned)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Apocalypse Chime')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('Apocalypse Chime') && e.includes('banned'))).toBe(true);
  });

  it('rejects more than 1 copy of Hymn to Tourach (restricted)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Hymn to Tourach')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('Hymn to Tourach') && e.includes('restricted'))).toBe(true);
  });

  it('rejects more than 4 copies of an unrestricted card', async () => {
    const d = deck([entry(55, 'Forest'), entry(5, 'Nameless Race')]);
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('Nameless Race') && e.includes('4 copies'))).toBe(true);
  });

  it('counts copies across main and sideboard', async () => {
    const d = deck(
      [entry(57, 'Forest'), entry(1, 'Maze of Ith')],
      [entry(1, 'Maze of Ith')],
    );
    const { errors } = await ForgottenRealms.validate(d);
    expect(errors.some(e => e.includes('Maze of Ith') && e.includes('1 main, 1 sideboard'))).toBe(true);
  });
});
