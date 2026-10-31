/**
 * How many SMS parts (= credits, FND-13) a message takes (design §8.6). GSM-7 text: 160 characters
 * for one part, 153 per part when longer (extension characters count twice). Anything else (Bangla)
 * is UCS-2: 70 for one part, 67 per part.
 */
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f';

export function countSmsSegments(text: string): number {
  if (text.length === 0) return 1;
  let gsmLength = 0;
  let isGsm = true;
  for (const char of text) {
    if (GSM_BASIC.includes(char)) gsmLength += 1;
    else if (GSM_EXTENDED.includes(char)) gsmLength += 2;
    else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) return gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  // UCS-2 counts UTF-16 code units (an emoji is two).
  const units = text.length;
  return units <= 70 ? 1 : Math.ceil(units / 67);
}
