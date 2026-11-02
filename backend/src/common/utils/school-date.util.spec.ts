import { addDays, daysBetween, isoDayOf, isSchoolDate, schoolDateIn } from './school-date.util';

describe('school dates', () => {
  it("gives today's date in the organisation's time zone, not the server's", () => {
    // 20:30 UTC on 1 Nov is already 2 Nov in Dhaka (UTC+6).
    const now = new Date('2026-11-01T20:30:00Z');
    expect(schoolDateIn('Asia/Dhaka', now)).toBe('2026-11-02');
    expect(schoolDateIn('UTC', now)).toBe('2026-11-01');
    expect(schoolDateIn('Not/AZone', now)).toBe('2026-11-02');
    expect(schoolDateIn(null, now)).toBe('2026-11-02');
  });

  it('numbers days ISO-style (Friday = 5, Sunday = 7)', () => {
    expect(isoDayOf('2026-11-06')).toBe(5);
    expect(isoDayOf('2026-11-08')).toBe(7);
    expect(isoDayOf('2026-11-02')).toBe(1);
  });

  it('adds and counts days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-12-16', '2026-12-16')).toBe(1);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isSchoolDate('2026-02-28')).toBe(true);
    expect(isSchoolDate('2026-02-30')).toBe(false);
    expect(isSchoolDate('2026-2-3')).toBe(false);
    expect(isSchoolDate(20260203)).toBe(false);
  });
});
