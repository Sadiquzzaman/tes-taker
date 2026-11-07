import { lateScore } from './homework-penalty';

describe('lateScore (HW-04)', () => {
  it('takes nothing off work on time, or when the organisation has no penalty', () => {
    expect(lateScore(8, { type: 'PER_DAY', percent: 10 }, null)).toEqual({ penalty: 0, final: 8 });
    expect(lateScore(8, { type: 'PER_DAY', percent: 10 }, 0)).toEqual({ penalty: 0, final: 8 });
    expect(lateScore(8, { type: 'NONE', percent: 0 }, 600)).toEqual({ penalty: 0, final: 8 });
  });

  it('takes a percent off per started day late, at most everything', () => {
    expect(lateScore(8, { type: 'PER_DAY', percent: 10 }, 30)).toEqual({ penalty: 0.8, final: 7.2 });
    expect(lateScore(8, { type: 'PER_DAY', percent: 10 }, 24 * 60 + 1)).toEqual({ penalty: 1.6, final: 6.4 });
    expect(lateScore(8, { type: 'PER_DAY', percent: 40 }, 5 * 24 * 60)).toEqual({ penalty: 8, final: 0 });
  });

  it('takes a fixed percent off once, however late', () => {
    expect(lateScore(9, { type: 'FIXED', percent: 25 }, 3 * 24 * 60)).toEqual({ penalty: 2.25, final: 6.75 });
  });
});
