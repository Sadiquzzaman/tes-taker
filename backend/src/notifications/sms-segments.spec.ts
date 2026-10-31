import { countSmsSegments } from './sms-segments';

describe('countSmsSegments (design §8.6)', () => {
  it('fits 160 GSM characters in one part and uses 153 per part after that', () => {
    expect(countSmsSegments('a'.repeat(160))).toBe(1);
    expect(countSmsSegments('a'.repeat(161))).toBe(2);
    expect(countSmsSegments('a'.repeat(306))).toBe(2);
    expect(countSmsSegments('a'.repeat(307))).toBe(3);
  });

  it('counts GSM extension characters twice', () => {
    expect(countSmsSegments('{'.repeat(80))).toBe(1);
    expect(countSmsSegments('{'.repeat(81))).toBe(2);
  });

  it('fits 70 Bangla characters in one part and uses 67 per part after that', () => {
    expect(countSmsSegments('ক'.repeat(70))).toBe(1);
    expect(countSmsSegments('ক'.repeat(71))).toBe(2);
    expect(countSmsSegments('ক'.repeat(134))).toBe(2);
    expect(countSmsSegments('ক'.repeat(135))).toBe(3);
  });

  it('treats a message with one Bangla character as Unicode', () => {
    expect(countSmsSegments(`${'a'.repeat(69)}ক`)).toBe(1);
    expect(countSmsSegments(`${'a'.repeat(70)}ক`)).toBe(2);
  });

  it('counts an empty message as one part', () => {
    expect(countSmsSegments('')).toBe(1);
  });
});
