import { closedDaysBetween } from './closed-days';

describe('closedDaysBetween', () => {
  it('lists weekly off days and holidays in order, a holiday on an off day once', () => {
    // 1–14 Dec 2026: Fridays are 4 and 11 Dec.
    const days = closedDaysBetween('2026-12-01', '2026-12-14', [5], [
      { date_from: '2026-12-10', date_to: '2026-12-12', name: 'Winter break' },
      { date_from: '2026-12-12', date_to: '2026-12-12', name: 'Overlap' },
    ]);
    expect(days).toEqual([
      { date: '2026-12-04', reason: 'WEEKLY_OFF' },
      { date: '2026-12-10', reason: 'HOLIDAY', holiday_name: 'Winter break' },
      { date: '2026-12-11', reason: 'HOLIDAY', holiday_name: 'Winter break' },
      { date: '2026-12-12', reason: 'HOLIDAY', holiday_name: 'Winter break' },
    ]);
  });

  it('handles several off days, ranges across a year end, and an empty range', () => {
    const days = closedDaysBetween('2026-12-31', '2027-01-03', [5, 6], [{ date_from: '2026-12-31', date_to: '2027-01-01', name: null }]);
    expect(days.map((d) => `${d.date}:${d.reason}`)).toEqual(['2026-12-31:HOLIDAY', '2027-01-01:HOLIDAY', '2027-01-02:WEEKLY_OFF']);
    expect(closedDaysBetween('2027-01-03', '2027-01-01', [5], [])).toEqual([]);
  });
});
