import {
  BANGLADESH_NATIONAL_BANDS,
  GradeBand,
  gradeForPercentage,
  GRADING_SCALE_ERRORS,
  normalizeGradeBands,
  validateGradeBands,
} from './grading-scale.util';

const twoBands = (): GradeBand[] => [
  { min_pct: 50, max_pct: 100, grade: 'P', gpa: null },
  { min_pct: 0, max_pct: 49.99, grade: 'F', gpa: null },
];

describe('gradeForPercentage (FND-11)', () => {
  it.each([
    [100, 'A+'],
    [80, 'A+'],
    [79.99, 'A'],
    [70, 'A'],
    [69.99, 'A-'],
    [50, 'B'],
    [40, 'C'],
    [33, 'D'],
    [32.99, 'F'],
    [0, 'F'],
  ])('%s%% is %s on the Bangladesh scale', (percentage, grade) => {
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, percentage)?.grade).toBe(grade);
  });

  it('returns the GPA with the grade', () => {
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, 64)).toEqual({ grade: 'A-', gpa: 3.5 });
  });

  it('rounds to two decimals before looking up, so nothing falls between bands', () => {
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, 79.995)?.grade).toBe('A+');
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, 79.994)?.grade).toBe('A');
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, 32.991)?.grade).toBe('F');
  });

  it('keeps percentages within 0–100 (negative marking, bonus marks)', () => {
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, -12)?.grade).toBe('F');
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, 104)?.grade).toBe('A+');
  });

  it('has no grade without a percentage', () => {
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, null)).toBeNull();
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, undefined)).toBeNull();
    expect(gradeForPercentage(BANGLADESH_NATIONAL_BANDS, Number.NaN)).toBeNull();
  });
});

describe('validateGradeBands', () => {
  it('accepts the Bangladesh scale and bands in any order', () => {
    expect(validateGradeBands(BANGLADESH_NATIONAL_BANDS)).toBeNull();
    expect(validateGradeBands([...BANGLADESH_NATIONAL_BANDS].reverse())).toBeNull();
    expect(validateGradeBands([{ min_pct: 0, max_pct: 100, grade: 'P', gpa: null }])).toBeNull();
  });

  it('rejects no bands and too many bands', () => {
    expect(validateGradeBands([])).toEqual({ code: GRADING_SCALE_ERRORS.EMPTY });
    const many = Array.from({ length: 21 }, (_, i) => ({ min_pct: i, max_pct: i + 0.99, grade: `G${i}`, gpa: null }));
    expect(validateGradeBands(many)?.code).toBe(GRADING_SCALE_ERRORS.TOO_MANY);
  });

  it('rejects a gap and an overlap between bands', () => {
    const gap = twoBands();
    gap[1].max_pct = 49.98;
    expect(validateGradeBands(gap)).toEqual({ code: GRADING_SCALE_ERRORS.GAP_OR_OVERLAP, band: 0 });
    const overlap = twoBands();
    overlap[1].max_pct = 50;
    expect(validateGradeBands(overlap)?.code).toBe(GRADING_SCALE_ERRORS.GAP_OR_OVERLAP);
  });

  it('requires the bands to start at 0% and end at 100%', () => {
    const start = twoBands();
    start[1].min_pct = 1;
    expect(validateGradeBands(start)).toEqual({ code: GRADING_SCALE_ERRORS.START, band: 1 });
    const end = twoBands();
    end[0].max_pct = 99.99;
    expect(validateGradeBands(end)).toEqual({ code: GRADING_SCALE_ERRORS.END, band: 0 });
  });

  it('rejects the same grade twice, ignoring case and spaces', () => {
    const bands = twoBands();
    bands[1].grade = ' p ';
    expect(validateGradeBands(bands)).toEqual({ code: GRADING_SCALE_ERRORS.DUPLICATE_GRADE, band: 1 });
  });

  it.each<[string, Partial<GradeBand>]>([
    ['an empty grade', { grade: '  ' }],
    ['a grade longer than 5 characters', { grade: 'Merit+' }],
    ['more than two decimals', { max_pct: 49.999 }],
    ['a percentage above 100', { min_pct: 0, max_pct: 101 }],
    ['from above to', { min_pct: 49.99, max_pct: 10 }],
    ['a negative GPA', { gpa: -1 }],
    ['a GPA above 9.99', { gpa: 10 }],
  ])('rejects a band with %s', (_label, change) => {
    const bands = twoBands();
    bands[1] = { ...bands[1], ...change };
    expect(validateGradeBands(bands)).toEqual({ code: GRADING_SCALE_ERRORS.BAND_INVALID, band: 1 });
  });
});

describe('normalizeGradeBands', () => {
  it('orders highest first and trims grades', () => {
    expect(normalizeGradeBands([{ min_pct: 0, max_pct: 49.99, grade: ' F ', gpa: null }, { min_pct: 50, max_pct: 100, grade: 'P', gpa: 4 }])).toEqual([
      { min_pct: 50, max_pct: 100, grade: 'P', gpa: 4 },
      { min_pct: 0, max_pct: 49.99, grade: 'F', gpa: null },
    ]);
  });
});
