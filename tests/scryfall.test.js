import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Each test gets a fresh module so the internal cache and rate-limit timer are reset.
let batchGetCardsInSet, batchGetCardsInAnySets, getCardInSet;
let fetchMock;

const makeCollectionResponse = (cards) => ({
  ok: true,
  json: async () => ({ data: cards, not_found: [] }),
});

const makeErrorResponse = () => ({ ok: false });

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('../js/scryfall.js');
  batchGetCardsInSet = mod.batchGetCardsInSet;
  batchGetCardsInAnySets = mod.batchGetCardsInAnySets;
  getCardInSet = mod.getCardInSet;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('batchGetCardsInSet', () => {
  it('returns found cards mapped by name', async () => {
    fetchMock.mockResolvedValue(
      makeCollectionResponse([{ name: 'Lightning Bolt', type_line: 'Instant' }])
    );
    const result = await batchGetCardsInSet(['lightning bolt'], '3ed');
    expect(result.get('lightning bolt').name).toBe('Lightning Bolt');
  });

  it('returns null for cards not in the response', async () => {
    fetchMock.mockResolvedValue(makeCollectionResponse([]));
    const result = await batchGetCardsInSet(['missing card'], '3ed');
    expect(result.get('missing card')).toBeNull();
  });

  it('serves subsequent calls for the same card from cache without fetching', async () => {
    fetchMock.mockResolvedValue(
      makeCollectionResponse([{ name: 'Sol Ring', type_line: 'Artifact' }])
    );
    await batchGetCardsInSet(['sol ring'], '3ed');
    await batchGetCardsInSet(['sol ring'], '3ed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null entries when the API call fails', async () => {
    fetchMock.mockResolvedValue(makeErrorResponse());
    const result = await batchGetCardsInSet(['bad card'], '3ed');
    expect(result.get('bad card')).toBeNull();
  });

  it('returns null entries on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await batchGetCardsInSet(['bad card'], '3ed');
    expect(result.get('bad card')).toBeNull();
  });
});

describe('batchGetCardsInAnySets', () => {
  it('resolves a card found in the first set', async () => {
    fetchMock.mockResolvedValue(
      makeCollectionResponse([{ name: 'Lightning Bolt', type_line: 'Instant' }])
    );
    const result = await batchGetCardsInAnySets(['lightning bolt'], ['3ed', 'lea']);
    expect(result.get('lightning bolt').name).toBe('Lightning Bolt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls through to second set when not found in first', async () => {
    fetchMock
      .mockResolvedValueOnce(makeCollectionResponse([]))
      .mockResolvedValueOnce(
        makeCollectionResponse([{ name: 'Dark Ritual', type_line: 'Instant' }])
      );
    const result = await batchGetCardsInAnySets(['dark ritual'], ['3ed', 'lea']);
    expect(result.get('dark ritual').name).toBe('Dark Ritual');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when card is not found in any set', async () => {
    fetchMock.mockResolvedValue(makeCollectionResponse([]));
    const result = await batchGetCardsInAnySets(['no such card'], ['3ed', 'lea']);
    expect(result.get('no such card')).toBeNull();
  });

  it('stops searching once all cards are resolved', async () => {
    fetchMock.mockResolvedValue(
      makeCollectionResponse([{ name: 'Forest', type_line: 'Basic Land — Forest' }])
    );
    await batchGetCardsInAnySets(['forest'], ['3ed', 'lea', 'leb']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getCardInSet', () => {
  it('returns the card on a successful exact-name fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Serra Angel', type_line: 'Creature — Angel' }),
    });
    const card = await getCardInSet('Serra Angel', '3ed');
    expect(card.name).toBe('Serra Angel');
  });

  it('returns null when both exact and fuzzy fetches fail', async () => {
    fetchMock.mockResolvedValue(makeErrorResponse());
    const card = await getCardInSet('No Such Card', '3ed');
    expect(card).toBeNull();
  });

  it('serves the second call from cache', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Sol Ring', type_line: 'Artifact' }),
    });
    await getCardInSet('Sol Ring', '3ed');
    await getCardInSet('Sol Ring', '3ed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
