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
import { ForgottenRealms } from './fr.js';
import { OFT2            } from './oft2.js';
import { ATL             } from './atl.js';
import { A2A             } from './a2a.js';
import { AAA             } from './aaa.js';
import { Xpts            } from './xpts.js';
import { SevenPts        } from './7pts.js';
import { Swedish         } from './swe.js';
import { EC              } from './ec.js';

export const FORMATS = {
  r40:   R40,
  fe40:  FE40,
  fr:    ForgottenRealms,
  oft2:  OFT2,
  atl:   ATL,
  a2a:   A2A,
  aaa:   AAA,
  xpt:   Xpts,
  '7pt': SevenPts,
  swe:  Swedish,
  ec:    EC,
};

/**
 * @param {string} id
 * @returns {{ id: string, name: string, validate: Function } | undefined}
 */
export function getFormat(id) {
  return FORMATS[id];
}
