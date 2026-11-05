import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';
import { parseClassType, parseDays, parseGrace, parseMode, parseTime, sameName } from './schedule-csv';

describe('schedule CSV cells', () => {
  it('reads days in English, Bangla or ISO numbers, in the order written', () => {
    expect(parseDays('Sat;Mon')).toEqual([6, 1]);
    expect(parseDays(' saturday, monday , Wed ')).toEqual([6, 1, 3]);
    expect(parseDays('শনি;সোমবার')).toEqual([6, 1]);
    expect(parseDays('6/1 6')).toEqual([6, 1]);
    expect(parseDays('Thurs|Fri.')).toEqual([4, 5]);
    expect(parseDays('৬;১')).toEqual([6, 1]);
    for (const bad of ['', '  ', 'Sat;Funday', '8', '0']) expect([bad, parseDays(bad)]).toEqual([bad, null]);
  });

  it('reads 24-hour and AM/PM times, with Bangla digits', () => {
    expect(parseTime('16:00')).toBe('16:00');
    expect(parseTime('9:05')).toBe('09:05');
    expect(parseTime('4:30 PM')).toBe('16:30');
    expect(parseTime('4 pm')).toBe('16:00');
    expect(parseTime('12 AM')).toBe('00:00');
    expect(parseTime('12:15 p.m.')).toBe('12:15');
    expect(parseTime('১৬:০০')).toBe('16:00');
    expect(parseTime('16.30')).toBe('16:30');
    for (const bad of ['', '4', '24:00', '16:60', '13 PM', '0 AM', 'noon']) expect([bad, parseTime(bad)]).toEqual([bad, null]);
  });

  it('reads class type, mode and grace; an empty cell means no change', () => {
    expect(parseClassType('Online')).toBe(SectionClassTypeEnum.ONLINE);
    expect(parseClassType('In person')).toBe(SectionClassTypeEnum.IN_PERSON);
    expect(parseClassType('সরাসরি')).toBe(SectionClassTypeEnum.IN_PERSON);
    expect(parseClassType('')).toBeUndefined();
    expect(parseClassType('hybrid')).toBeNull();
    expect(parseMode('Paper register')).toBe(SectionAttendanceModeEnum.PAPER_REGISTER);
    expect(parseMode('self check-in')).toBe(SectionAttendanceModeEnum.SELF_CHECKIN);
    expect(parseMode('খাতা')).toBe(SectionAttendanceModeEnum.PAPER_REGISTER);
    expect(parseMode(' ')).toBeUndefined();
    expect(parseMode('roll call')).toBeNull();
    expect(parseGrace('10')).toBe(10);
    expect(parseGrace('5 min')).toBe(5);
    expect(parseGrace('০')).toBe(0);
    expect(parseGrace('Default')).toBeNull();
    expect(parseGrace('')).toBeUndefined();
    expect(parseGrace('61')).toBeNaN();
    expect(parseGrace('ten')).toBeNaN();
  });

  it('matches names without case or extra spaces', () => {
    expect(sameName(' Class  6 ', 'class 6')).toBe(true);
    expect(sameName('A', 'B')).toBe(false);
  });
});
