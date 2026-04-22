/**
 * Format registry.
 *
 * To add a new format:
 *   1. Create js/formats/<id>.js exporting a validator object with the shape:
 *        { id: string, name: string, validate(deck): Promise<{ valid: boolean, errors: string[] }> }
 *   2. Import it here and add it to FORMATS.
 *   3. Add a corresponding <option> to the <select> in index.html.
 */

import { R40             } from './r40.js';
import { FE40            } from './fe40.js';
import { ForgottenRealms } from './forgotten-realms.js';

export const FORMATS = {
  r40:               R40,
  fe40:              FE40,
  'forgotten-realms': ForgottenRealms,
};

/**
 * @param {string} id
 * @returns {{ id: string, name: string, validate: Function } | undefined}
 */
export function getFormat(id) {
  return FORMATS[id];
}
