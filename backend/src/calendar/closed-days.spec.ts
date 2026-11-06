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

  it('keeps a weekly off day closed on the dates it covered after it is opened, never reaching back further', () => {
    // Fridays (5) were off until Friday 6 Nov, when Friday became a school day: 30 Oct and 6 Nov stay
    // closed, 13 Nov is a school day. Sunday (7) was off only up to 1 Nov.
    const history = [
      { days: [5, 7], until: '2026-11-01' },
      { days: [5], until: '2026-11-06' },
    ];
    const days = closedDaysBetween('2026-10-30', '2026-11-13', [], [], history);
    expect(days.map((d) => `${d.date}:${d.reason}`)).toEqual(['2026-10-30:WEEKLY_OFF', '2026-11-01:WEEKLY_OFF', '2026-11-06:WEEKLY_OFF']);
  });

  it('keeps a day closed when it was off at any time on that date, even if changed twice that day', () => {
    // Saturday 14 Nov: made an off day in the morning, opened again after the class.
    const history = [
      { days: [5], until: '2026-11-14' },
      { days: [5, 6], until: '2026-11-14' },
    ];
    expect(closedDaysBetween('2026-11-14', '2026-11-21', [5], [], history).map((d) => d.date)).toEqual(['2026-11-14', '2026-11-20']);
  });

  it('adding an off day still closes past dates at once', () => {
    expect(closedDaysBetween('2026-11-02', '2026-11-08', [1], [], [{ days: [5], until: '2026-11-06' }]).map((d) => d.date)).toEqual([
      '2026-11-02',
      '2026-11-06',
    ]);
  });

  it('keeps a removed holiday closed on its days up to the date it was removed', () => {
    const removed = { date_from: '2026-11-09', date_to: '2026-11-11', name: 'Exams', removed_on: '2026-11-10' };
    expect(closedDaysBetween('2026-11-08', '2026-11-12', [], [removed]).map((d) => d.date)).toEqual(['2026-11-09', '2026-11-10']);
  });
});
