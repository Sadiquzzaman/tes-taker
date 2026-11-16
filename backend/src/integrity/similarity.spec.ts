import { compare, words } from './similarity';

describe('Plagiarism similarity', () => {
  it('reads Bangla and English words, ignoring case and punctuation', () => {
    expect(words('Glass, first-made!').map((w) => w.text)).toEqual(['glass', 'first', 'made']);
    expect(words('আমার সোনার বাংলা।').map((w) => w.text)).toEqual(['আমার', 'সোনার', 'বাংলা']);
  });

  it('finds copied passages and how much of each text they are', () => {
    const shared = 'the industrial revolution changed the way people lived and worked in cities';
    const a = `In my view ${shared}. That is all.`;
    const b = `${shared.toUpperCase()}!`;
    const result = compare(a, b);
    expect(result.b_percent).toBe(100);
    expect(result.a_percent).toBe(66.7); // 12 of 18 words
    expect(result.a_spans).toHaveLength(1);
    expect(a.slice(result.a_spans[0].start, result.a_spans[0].end)).toBe(shared);
  });

  it('works for Bangla', () => {
    const shared = 'বাংলাদেশ একটি সুন্দর দেশ এখানে অনেক নদী আছে';
    const result = compare(`${shared} এবং পাহাড়ও আছে`, `আমি জানি ${shared}`);
    expect(result.a_percent).toBeGreaterThan(70);
    expect(result.b_percent).toBeGreaterThan(70);
  });

  it('does not match texts that only share a few words', () => {
    const result = compare('the cat sat on the mat today', 'a dog sat on the mat yesterday');
    expect([result.a_percent, result.b_percent]).toEqual([0, 0]);
    expect(compare('', 'anything').a_percent).toBe(0);
  });
});
