import { AttendanceStatusEnum } from './entities/attendance-record.entity';
import { isBlankMark, parseMark, parseMarkColumn, sameRoll, studentColumns } from './paper-register-csv';

describe('paper register CSV cells (ATT-17)', () => {
  it('reads status letters and words in English and Bangla', () => {
    expect(['P', 'p', 'Present', 'উ', 'উপস্থিত'].map(parseMark)).toEqual(Array(5).fill(AttendanceStatusEnum.PRESENT));
    expect(['L', 'late', 'দে', 'দেরি'].map(parseMark)).toEqual(Array(4).fill(AttendanceStatusEnum.LATE));
    expect(['A', ' a ', 'Absent', 'অ', 'অনুপস্থিত'].map(parseMark)).toEqual(Array(5).fill(AttendanceStatusEnum.ABSENT));
    expect(['Leave', 'LV', 'ছু', 'ছুটি'].map(parseMark)).toEqual(Array(4).fill(AttendanceStatusEnum.LEAVE));
  });

  it('treats empty cells and dashes as blank, and anything else as unknown', () => {
    expect(['', '  ', '-', '—', undefined].map(parseMark)).toEqual([null, null, null, null, null]);
    expect(isBlankMark(' - ')).toBe(true);
    expect(isBlankMark('P')).toBe(false);
    expect(['X', 'H', 'yes', '1', 'PA'].map(parseMark)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it('reads date headers however a spreadsheet rewrote them, using the month to tell day from month', () => {
    const month = '2026-11';
    const day = (header: string) => parseMarkColumn(header, month);
    for (const header of ['2026-11-07', '7/11/2026', '11/7/2026', '07-11-26', '07-Nov-26', '7 Nov', 'Nov 7, 2026', '7 November 2026', '7', '০৭', '৭ নভেম্বর']) {
      expect([header, day(header)]).toEqual([header, { date: '2026-11-07', time: null }]);
    }
    // Both numbers could be the month: day first, as written in Bangladesh.
    expect(day('11/11/2026')).toEqual({ date: '2026-11-11', time: null });
    expect(day('25/11/2026')).toEqual({ date: '2026-11-25', time: null });
    // Another month's date is still a date (the service reports it as outside the month).
    expect(day('2026-12-05')).toEqual({ date: '2026-12-05', time: null });
    expect(day('5/12/2026')).toEqual({ date: '2026-12-05', time: null });
  });

  it('reads a start time after the date, and rejects headers that are not dates', () => {
    expect(parseMarkColumn('2026-11-07 16:00', '2026-11')).toEqual({ date: '2026-11-07', time: '16:00' });
    expect(parseMarkColumn('7/11/2026 4:00 PM', '2026-11')).toEqual({ date: '2026-11-07', time: '16:00' });
    expect(parseMarkColumn('2026-11-07 ১৬:৩০', '2026-11')).toEqual({ date: '2026-11-07', time: '16:30' });
    for (const header of ['', 'notes', '2026-11-31', '32', 'Saturday', '2026-11-07 25:00']) {
      expect([header, parseMarkColumn(header, '2026-11')]).toEqual([header, null]);
    }
  });

  it('finds the roll and name columns and compares roll numbers loosely', () => {
    expect(studentColumns(['\uFEFFroll_no', 'name', '2026-11-07'])).toEqual({ roll: 0, name: 1 });
    expect(studentColumns(['নাম', 'রোল', '৭'])).toEqual({ roll: 1, name: 0 });
    expect(studentColumns(['Roll No', 'Student Name'])).toEqual({ roll: 0, name: 1 });
    expect(studentColumns(['2026-11-07'])).toEqual({ roll: -1, name: -1 });
    expect(sameRoll('07', '7')).toBe(true);
    expect(sameRoll('০৭', '7')).toBe(true);
    expect(sameRoll('A-12', 'a-12')).toBe(true);
    expect(sameRoll('', '')).toBe(false);
    expect(sameRoll('12', '21')).toBe(false);
  });
});
