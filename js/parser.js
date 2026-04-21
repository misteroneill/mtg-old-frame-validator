/**
 * Parses a deck list in Moxfield plain text format.
 *
 * Supported line forms:
 *   4 Lightning Bolt
 *   4 Lightning Bolt (3ED) 163
 *   4 Lightning Bolt (3ED) 163 *F*
 *
 * Section headers (case-insensitive):
 *   Deck / Mainboard / Main Board
 *   Sideboard / Side Board
 *   // Deck, // Sideboard, etc.
 *
 * @param {string} text
 * @returns {{ mainboard: Array<{qty: number, name: string}>, sideboard: Array<{qty: number, name: string}> }}
 */
export function parseDeckList(text) {
  const mainboard = [];
  const sideboard = [];
  let section = 'mainboard';

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    if (!line) continue;

    // Detect section headers (with or without leading //)
    const header = line.replace(/^\/\/\s*/, '').toLowerCase();
    if (/^(sideboard|side board|side)$/.test(header)) {
      section = 'sideboard';
      continue;
    }
    if (/^(deck|mainboard|main board|main)$/.test(header)) {
      section = 'mainboard';
      continue;
    }
    // Skip pure comment lines (// something that isn't a section name)
    if (line.startsWith('//')) continue;

    // Parse card line: "<qty> <name> [optional (SET) number [flags]]"
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const qty = parseInt(match[1], 10);
    // Strip trailing "(SETCODE) collector_number [flags]" — set codes are 2-6 uppercase alphanumeric chars
    let name = match[2].replace(/\s+\([A-Z0-9]{2,6}\).*$/, '').trim();

    if (!name || qty < 1) continue;

    (section === 'sideboard' ? sideboard : mainboard).push({ qty, name });
  }

  return { mainboard, sideboard };
}
