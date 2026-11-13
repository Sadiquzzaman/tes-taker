import { sameJson } from './report-cards.service';

describe('report card snapshots', () => {
  it('compare equal whatever the key order, as jsonb gives them back', () => {
    expect(sameJson({ b: 1, a: { d: [1, { y: 2, x: null }], c: 'x' } }, { a: { c: 'x', d: [1, { x: null, y: 2 }] }, b: 1 })).toBe(true);
    expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameJson({ a: 1 }, { a: 1, b: null })).toBe(false);
  });
});
