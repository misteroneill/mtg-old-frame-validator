export const card = (name, rarity = 'common', type_line = 'Instant') => ({ name, rarity, type_line });
export const entry = (qty, name) => ({ qty, name });
export const deck = (mainboard, sideboard = []) => ({ mainboard, sideboard });

// N copies of Basic Forest as filler (skips API lookup)
export const forests = (n) => [entry(n, 'Forest')];
