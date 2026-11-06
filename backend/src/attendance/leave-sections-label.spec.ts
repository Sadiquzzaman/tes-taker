import { sectionsLabel } from './leave.service';

/** Found in the P3 beta walkthrough: one leave request showed "Class 9A A" in the list and "Class 10A A" in the notice. */
describe('sectionsLabel', () => {
  it('names one or two sections in full, sorted by number', () => {
    expect(sectionsLabel([])).toBe('');
    expect(sectionsLabel(['Class 10 A'])).toBe('Class 10 A');
    expect(sectionsLabel(['Class 10 A', 'Class 9 A'])).toBe('Class 9 A, Class 10 A');
  });

  it('counts the rest, the same whatever order the sections come in', () => {
    const labels = ['Class 10B A', 'Class 9B A', 'Class 10A A', 'Class 9A A'];
    expect(sectionsLabel(labels)).toBe('Class 9A A, Class 9B A +2');
    expect(sectionsLabel([...labels].reverse())).toBe('Class 9A A, Class 9B A +2');
  });

  it('ignores empty and repeated labels', () => {
    expect(sectionsLabel(['', 'Class 8 A', 'Class 8 A'])).toBe('Class 8 A');
  });
});
