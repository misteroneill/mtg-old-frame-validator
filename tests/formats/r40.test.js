import { vi, describe, it, expect, beforeEach } from 'vitest';
import { entry, deck, card, forests } from '../helpers.js';

vi.mock('../../js/scryfall.js', () => ({
  batchGetCardsInSet: vi.fn(),
  batchGetCardsInAnySets: vi.fn(),
}));

import { batchGetCardsInSet } from '../../js/scryfall.js';
import { R40 } from '../../js/formats/r40.js';

const DB = {
  'llanowar elves':   card('Llanowar Elves', 'common',   'Creature — Elf Druid'),
  'serra angel':      card('Serra Angel',    'rare',     'Creature — Angel'),
  'hypnotic specter': card('Hypnotic Specter','uncommon','Creature — Specter'),
  'lightning bolt':   card('Lightning Bolt', 'common',   'Instant'),
  'kird ape':         card('Kird Ape',       'common',   'Creature — Ape'),
  'sol ring':         card('Sol Ring',       'uncommon', 'Artifact'),
  'balance':          card('Balance',        'rare',     'Sorcery'),
  'mind twist':       card('Mind Twist',     'rare',     'Sorcery'),
};

beforeEach(() => {
  vi.mocked(batchGetCardsInSet).mockImplementation(async (names) =>
    new Map(names.map(n => [n, DB[n] ?? null]))
  );
});

describe('R40', () => {
  it('accepts a valid 40-card deck with basic lands', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Llanowar Elves')]);
    const { valid, errors } = await R40.validate(d);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rejects deck with fewer than 40 cards', async () => {
    const d = deck([entry(4, 'Llanowar Elves')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('at least 40 cards'))).toBe(true);
  });

  it('rejects sideboard presence', async () => {
    const d = deck(
      [entry(36, 'Forest'), entry(4, 'Llanowar Elves')],
      [entry(1, 'Llanowar Elves')],
    );
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('does not use a sideboard'))).toBe(true);
  });

  it('rejects card not in Revised card pool', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Not A Card')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('"Not A Card"') && e.includes('Revised Edition'))).toBe(true);
  });

  it('rejects banned card', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Mind Twist')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Mind Twist') && e.includes('banned'))).toBe(true);
  });

  it('rejects restricted card with more than 1 copy', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Balance')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Balance') && e.includes('restricted'))).toBe(true);
  });

  it('accepts 1 copy of a restricted card', async () => {
    const d = deck([entry(38, 'Forest'), entry(1, 'Sol Ring'), entry(1, 'Balance')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Balance') || e.includes('Sol Ring'))).toBe(false);
  });

  it('rejects more than 3 copies of the same rare', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Serra Angel')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Serra Angel') && e.includes('maximum 3 copies'))).toBe(true);
  });

  it('rejects more than 5 rares total', async () => {
    // 6 copies of Serra Angel (also triggers >3-copies error, but total-rare error too)
    const d = deck([entry(34, 'Forest'), entry(3, 'Serra Angel'), entry(3, 'Balance')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('at most 5 rares'))).toBe(true);
  });

  it('rejects more than 3 copies of the same uncommon', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Hypnotic Specter')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Hypnotic Specter') && e.includes('maximum 3 copies'))).toBe(true);
  });

  it('rejects more than 10 uncommons total', async () => {
    // 11 uncommons: 3+3+3 Hypnotic Specter... need 11 total
    const d = deck([entry(29, 'Forest'), entry(3, 'Hypnotic Specter'), entry(3, 'Sol Ring'), entry(5, 'Lightning Bolt')]);
    const { errors } = await R40.validate(d);
    // Lightning Bolt counts as uncommon (upgraded), 3+3+5=11 uncommons
    expect(errors.some(e => e.includes('at most 10 uncommons'))).toBe(true);
  });

  it('treats Lightning Bolt as upgraded to uncommon', async () => {
    const d = deck([entry(36, 'Forest'), entry(4, 'Lightning Bolt')]);
    const { errors } = await R40.validate(d);
    expect(errors.some(e => e.includes('Lightning Bolt') && e.includes('upgraded to uncommon'))).toBe(true);
  });
});
