import { DEFAULT_WEIGHTS, mean, positions, validWeights, weightedScore } from './score-calc';

describe('score formula (Epic 3)', () => {
  it("matches the spec's example: 0.5×78 + 0.2×90 + 0.2×95 + 0.1×80 = 84", () => {
    expect(weightedScore({ exams_pct: 78, homework_pct: 90, attendance_pct: 95, behaviour_pct: 80 }, DEFAULT_WEIGHTS)).toBe(84);
  });

  it('leaves out a part with no data (or weight 0) and scales the rest up to 100%', () => {
    // No behaviour yet: (0.5×78 + 0.2×90 + 0.2×95) ÷ 0.9
    expect(weightedScore({ exams_pct: 78, homework_pct: 90, attendance_pct: 95, behaviour_pct: null }, DEFAULT_WEIGHTS)).toBe(84.44);
    expect(weightedScore({ exams_pct: 60, homework_pct: 100, attendance_pct: null, behaviour_pct: null }, { exams_pct: 100, homework_pct: 0, attendance_pct: 0, behaviour_pct: 0 })).toBe(60);
    expect(weightedScore({ exams_pct: null, homework_pct: null, attendance_pct: null, behaviour_pct: null }, DEFAULT_WEIGHTS)).toBeNull();
    expect(weightedScore({ exams_pct: null, homework_pct: 50, attendance_pct: null, behaviour_pct: null }, { exams_pct: 100, homework_pct: 0, attendance_pct: 0, behaviour_pct: 0 })).toBeNull();
  });

  it('takes whole-percent weights adding up to 100', () => {
    expect(validWeights(DEFAULT_WEIGHTS)).toBe(true);
    expect(validWeights({ exams_pct: 100, homework_pct: 0, attendance_pct: 0, behaviour_pct: 0 })).toBe(true);
    expect(validWeights({ exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 20 })).toBe(false);
    expect(validWeights({ exams_pct: 50.5, homework_pct: 19.5, attendance_pct: 20, behaviour_pct: 10 })).toBe(false);
    expect(validWeights({ exams_pct: 110, homework_pct: -10, attendance_pct: 0, behaviour_pct: 0 })).toBe(false);
  });

  it('averages to two decimals', () => {
    expect(mean([])).toBeNull();
    expect(mean([80, 70, 71])).toBe(73.67);
  });

  it('ranks by score, then exams %, sharing a position on a full tie (PRF-10)', () => {
    const ranked = positions([
      { id: 'a', score: 80, exams: 70 },
      { id: 'b', score: 90, exams: 60 },
      { id: 'c', score: 80, exams: 75 },
      { id: 'd', score: 80, exams: 70 },
      { id: 'e', score: null, exams: 90 },
      { id: 'f', score: 50, exams: null },
    ]);
    expect(Object.fromEntries(ranked)).toEqual({ b: 1, c: 2, a: 3, d: 3, f: 5 });
  });
});
