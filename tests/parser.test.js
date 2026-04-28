import { describe, it, expect } from 'vitest';
import { parseDeckList } from '../js/parser.js';

describe('parseDeckList', () => {
  it('parses basic qty name lines into mainboard', () => {
    const { mainboard, sideboard } = parseDeckList('4 Lightning Bolt\n2 Forest');
    expect(mainboard).toEqual([
      { qty: 4, name: 'Lightning Bolt' },
      { qty: 2, name: 'Forest' },
    ]);
    expect(sideboard).toEqual([]);
  });

  it('strips trailing set/collector suffix', () => {
    const { mainboard } = parseDeckList('4 Lightning Bolt (3ED) 163');
    expect(mainboard[0].name).toBe('Lightning Bolt');
  });

  it('strips trailing set/collector suffix with foil flag', () => {
    const { mainboard } = parseDeckList('4 Lightning Bolt (3ED) 163 *F*');
    expect(mainboard[0].name).toBe('Lightning Bolt');
  });

  it('switches to sideboard on "Sideboard" header', () => {
    const text = '4 Lightning Bolt\nSideboard\n2 Pyroblast';
    const { mainboard, sideboard } = parseDeckList(text);
    expect(mainboard).toHaveLength(1);
    expect(sideboard).toEqual([{ qty: 2, name: 'Pyroblast' }]);
  });

  it('switches to sideboard on "// Sideboard" header', () => {
    const { sideboard } = parseDeckList('4 Forest\n// Sideboard\n1 Red Elemental Blast');
    expect(sideboard).toHaveLength(1);
  });

  it('switches to sideboard on "Side" header', () => {
    const { sideboard } = parseDeckList('4 Forest\nSide\n1 Pyroblast');
    expect(sideboard).toHaveLength(1);
  });

  it('switches to sideboard on "Side Board" header', () => {
    const { sideboard } = parseDeckList('4 Forest\nSide Board\n1 Pyroblast');
    expect(sideboard).toHaveLength(1);
  });

  it('ignores the "Deck" section header', () => {
    const { mainboard } = parseDeckList('Deck\n4 Forest');
    expect(mainboard).toEqual([{ qty: 4, name: 'Forest' }]);
  });

  it('ignores blank lines', () => {
    const { mainboard } = parseDeckList('\n4 Forest\n\n2 Island\n');
    expect(mainboard).toHaveLength(2);
  });

  it('ignores comment lines (// prefix not a section header)', () => {
    const { mainboard } = parseDeckList('// My deck\n4 Forest');
    expect(mainboard).toEqual([{ qty: 4, name: 'Forest' }]);
  });

  it('ignores lines that do not match qty name format', () => {
    const { mainboard } = parseDeckList('Forest\n4 Island');
    expect(mainboard).toEqual([{ qty: 4, name: 'Island' }]);
  });

  it('handles qty of 1', () => {
    const { mainboard } = parseDeckList('1 Black Lotus');
    expect(mainboard[0].qty).toBe(1);
  });

  it('returns empty arrays for empty input', () => {
    const result = parseDeckList('');
    expect(result.mainboard).toEqual([]);
    expect(result.sideboard).toEqual([]);
  });

  it('section header matching is case-insensitive', () => {
    const { sideboard } = parseDeckList('4 Forest\nsIDEBOARD\n1 Pyroblast');
    expect(sideboard).toHaveLength(1);
  });

  it('can switch back to mainboard on "Main" header', () => {
    const text = '4 Forest\nSideboard\n2 Pyroblast\nMain\n4 Island';
    const { mainboard, sideboard } = parseDeckList(text);
    expect(mainboard.find(e => e.name === 'Island')).toBeTruthy();
    expect(sideboard.find(e => e.name === 'Pyroblast')).toBeTruthy();
  });
});
