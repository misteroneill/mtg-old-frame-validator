import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInAnySets } from '../../js/scryfall.js';
import { Xpts } from '../../js/formats/xpts.js';

const DB = {
  'llanowar elves':    card('Llanowar Elves',    'common',   'Creature — Elf Druid'),
  'hymn to tourach':   card('Hymn to Tourach',   'common',   'Sorcery'),
  'ancestral recall':  card('Ancestral Recall',  'rare',     'Instant'),
  'black lotus':       card('Black Lotus',       'rare',     'Artifact'),
  'sol ring':          card('Sol Ring',          'uncommon', 'Artifact'),
  'bronze tablet':     card('Bronze Tablet',     'rare',     'Artifact'),
  'contract from below': card('Contract from Below','rare',  'Sorcery'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInAnySets).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('Xpts', () => {
  it('accepts a valid 60-card deck with 0 points', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await Xpts.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck under 60 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('at least 60 cards'))).toBe(true);
  });

  it('rejects sideboard over 15 cards', async () => {
    const d = deck(
      [entry(56, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(16, 'Llanowar Elves')],
    );
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('at most 15'))).toBe(true);
  });

  it('rejects card not in legal sets', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Fake Card')]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('"Fake Card"') && e.includes('Alpha'))).toBe(true);
  });

  it('rejects banned card (Bronze Tablet)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Bronze Tablet')]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('Bronze Tablet') && e.includes('banned'))).toBe(true);
  });

  it('rejects ANTE_BANNED card (Contract from Below)', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Contract from Below')]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('Contract from Below') && e.includes('banned'))).toBe(true);
  });

  it('rejects more than 1 copy of a restricted card', async () => {
    const d = deck([entry(56, 'Forest'), entry(4, 'Ancestral Recall')]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('Ancestral Recall') && e.includes('restricted'))).toBe(true);
  });

  it('rejects deck that exceeds the 10-point limit', async () => {
    // Ancestral Recall = 6pts + Black Lotus = 3pts + Sol Ring = 2pts = 11pts (but AR is restricted to 1)
    // Use 1 Ancestral Recall (6pts) + 1 Black Lotus (3pts) + 2 Sol Ring (2×2=4pts) = 13pts
    // But Sol Ring is restricted... use Hymn to Tourach (2pts each, up to 4 copies)
    // 4× Hymn to Tourach = 8pts, 1 Black Lotus = 3pts, 1 Ancestral Recall = 6pts → 17pts total, but restricted
    // Use only unrestricted pointed cards: 4× Hymn to Tourach (8pts) + 4× Hymn... hmm, Hymn is only 2pts
    // Simplest: 1 Ancestral Recall (6pts, restricted) + 4 Hymn to Tourach (8pts) = 14pts
    // But Ancestral Recall is restricted, so: 1 AR (6) + 4 HtT (8) = 14pts total
    const d = deck([
      entry(51, 'Forest'),
      entry(1, 'Ancestral Recall'),
      entry(4, 'Hymn to Tourach'),
    ]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('10-point limit'))).toBe(true);
  });

  it('accepts deck exactly at the 10-point limit', async () => {
    // 4× Hymn to Tourach = 8pts + 1 Black Lotus = 3pts is 11, over
    // 4× Hymn to Tourach = 8pts + 1 Sol Ring = 2pts = 10pts (Sol Ring is restricted, max 1)
    const d = deck([
      entry(55, 'Forest'),
      entry(4, 'Hymn to Tourach'),
      entry(1, 'Sol Ring'),
    ]);
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('point limit'))).toBe(false);
  });

  it('counts points across main and sideboard', async () => {
    // 4× Hymn in main (8pts) + 1 Sol Ring in side (2pts) = 10pts total (at limit, valid)
    const d = deck(
      [entry(55, 'Forest'), entry(4, 'Hymn to Tourach')],
      [entry(1, 'Sol Ring')],
    );
    const { errors } = await Xpts.validate(d);
    expect(errors.some(e => e.includes('point limit'))).toBe(false);
  });
});
