/**
 * Scryfall API client with in-memory caching and rate limiting.
 *
 * Scryfall asks for ≤10 req/sec (i.e. ≥100ms between requests).
 * We enforce 100ms between actual network calls; cached hits are free.
 */

const cache = new Map();

const DELAY_MS = 100;
let lastRequestAt = 0;

const cacheKey = (name, setCode) =>
  `${name.toLowerCase()}|${setCode.toLowerCase()}`;

async function scryfallFetch(url, options = {}) {
  const now = Date.now();
  const wait = DELAY_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
  return fetch(url, options);
}

/**
 * Look up multiple cards in a specific set with a single API call.
 * Uses Scryfall's /cards/collection endpoint (max 75 identifiers per request).
 * Results are stored in the module-level cache so subsequent single-card
 * lookups via getCardInSet() are served from cache at no cost.
 *
 * @param {string[]} cardNames
 * @param {string} setCode  e.g. '3ed'
 * @returns {Promise<Map<string, object|null>>} Map from each supplied name → card object or null.
 */
export async function batchGetCardsInSet(cardNames, setCode) {
  const result  = new Map();
  const toFetch = [];

  for (const name of cardNames) {
    const key = cacheKey(name, setCode);
    if (cache.has(key)) {
      result.set(name, cache.get(key));
    } else {
      toFetch.push(name);
    }
  }

  // Batch uncached names in groups of 75 (Scryfall's limit per request)
  for (let i = 0; i < toFetch.length; i += 75) {
    const batch       = toFetch.slice(i, i + 75);
    const identifiers = batch.map(name => ({ name, set: setCode }));

    try {
      const res = await scryfallFetch('https://api.scryfall.com/cards/collection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifiers }),
      });

      if (res.ok) {
        const body   = await res.json();
        // Index returned cards by lowercase name for O(1) lookup
        const byName = new Map(body.data.map(c => [c.name.toLowerCase(), c]));
        for (const name of batch) {
          const card = byName.get(name.toLowerCase()) ?? null;
          cache.set(cacheKey(name, setCode), card);
          result.set(name, card);
        }
      } else {
        for (const name of batch) {
          cache.set(cacheKey(name, setCode), null);
          result.set(name, null);
        }
      }
    } catch (_) {
      for (const name of batch) {
        cache.set(cacheKey(name, setCode), null);
        result.set(name, null);
      }
    }
  }

  return result;
}

/**
 * Look up multiple cards across several sets, checking each set in order.
 * A card is considered found as soon as it appears in any of the sets; the
 * card data from that first match is returned. Only names not yet resolved
 * are carried forward to the next set, so subsequent requests are smaller.
 *
 * @param {string[]} cardNames
 * @param {string[]} setCodes  e.g. ['drk', 'fem', 'hml']
 * @returns {Promise<Map<string, object|null>>} Map from each supplied name → card object or null.
 */
export async function batchGetCardsInAnySets(cardNames, setCodes) {
  const result    = new Map();
  let   remaining = [...cardNames];

  for (const setCode of setCodes) {
    if (remaining.length === 0) break;

    const fetched = await batchGetCardsInSet(remaining, setCode);
    const missed  = [];

    for (const name of remaining) {
      const data = fetched.get(name);
      if (data) {
        result.set(name, data);
      } else {
        missed.push(name);
      }
    }

    remaining = missed;
  }

  // Anything still unresolved is not in any of the legal sets
  for (const name of remaining) {
    result.set(name, null);
  }

  return result;
}

/**
 * Look up a single card in a specific set by name.
 * Tries an exact match first, then a fuzzy match.
 * Prefer batchGetCardsInSet() when looking up multiple cards.
 *
 * @param {string} cardName
 * @param {string} setCode  e.g. '3ed'
 * @returns {Promise<object|null>} Scryfall card object, or null if not found.
 */
export async function getCardInSet(cardName, setCode) {
  const key = cacheKey(cardName, setCode);
  if (cache.has(key)) return cache.get(key);

  // 1. Exact name match within the set
  const exactUrl =
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(setCode)}`;
  try {
    const res = await scryfallFetch(exactUrl);
    if (res.ok) {
      const data = await res.json();
      cache.set(key, data);
      return data;
    }
  } catch (_) { /* network error — fall through to fuzzy */ }

  // 2. Fuzzy name match within the set (handles minor capitalisation/typos)
  const fuzzyUrl =
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}&set=${encodeURIComponent(setCode)}`;
  try {
    const res = await scryfallFetch(fuzzyUrl);
    if (res.ok) {
      const data = await res.json();
      cache.set(key, data);
      return data;
    }
  } catch (_) { /* network error */ }

  cache.set(key, null);
  return null;
}
