import { isSchoolDate } from 'src/common/utils/school-date.util';
import { AttendanceStatusEnum } from './entities/attendance-record.entity';
import { parseTime } from './schedule-csv';

/**
 * Reading the cells of a paper register CSV (ATT-17): one row per student, one column per class day.
 * Teachers fill in letters in English or Bangla, and spreadsheet programs rewrite the date headers
 * ("2026-11-07" becomes "11/7/2026" or "07-Nov-26"), so each reader is lenient and returns null
 * when it cannot understand the cell.
 */

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const latinDigits = (value: string) => value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
const clean = (value: string | undefined | null) => latinDigits((value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase()).replace(/\s+/g, ' ');

/** Letters and words for each status, English and Bangla (the calendar letters P/L/A/LV and উ/দে/অ/ছু). */
const STATUS_WORDS: Record<string, AttendanceStatusEnum> = {
  p: AttendanceStatusEnum.PRESENT, present: AttendanceStatusEnum.PRESENT, উ: AttendanceStatusEnum.PRESENT, উপস্থিত: AttendanceStatusEnum.PRESENT,
  l: AttendanceStatusEnum.LATE, late: AttendanceStatusEnum.LATE, দে: AttendanceStatusEnum.LATE, দেরি: AttendanceStatusEnum.LATE,
  দেরিতে: AttendanceStatusEnum.LATE, বিলম্ব: AttendanceStatusEnum.LATE,
  a: AttendanceStatusEnum.ABSENT, absent: AttendanceStatusEnum.ABSENT, অ: AttendanceStatusEnum.ABSENT, অনুপস্থিত: AttendanceStatusEnum.ABSENT,
  lv: AttendanceStatusEnum.LEAVE, leave: AttendanceStatusEnum.LEAVE, ছু: AttendanceStatusEnum.LEAVE, ছুটি: AttendanceStatusEnum.LEAVE,
};

/** Cells that mean "nothing written": empty or a dash. */
const BLANK = ['', '-', '–', '—'];

/** True when the cell has nothing written in it (it leaves the record as it is). */
export const isBlankMark = (cell: string | undefined | null) => BLANK.includes(clean(cell));

/** "P", "late", "অ", "ছুটি" → the status; null for a blank cell; undefined when it is not a status. */
export function parseMark(cell: string | undefined | null): AttendanceStatusEnum | null | undefined {
  const value = clean(cell).replace(/\.$/, '');
  if (BLANK.includes(value)) return null;
  return STATUS_WORDS[value];
}

/** The letter written for a status in a file (English or Bangla); the import reads both. */
export const MARK_LETTERS: Record<'en' | 'bn', Record<AttendanceStatusEnum, string>> = {
  en: { PRESENT: 'P', LATE: 'L', ABSENT: 'A', LEAVE: 'LV' },
  bn: { PRESENT: 'উ', LATE: 'দে', ABSENT: 'অ', LEAVE: 'ছু' },
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  জানুয়ারি: 1, ফেব্রুয়ারি: 2, মার্চ: 3, এপ্রিল: 4, মে: 5, জুন: 6, জুলাই: 7, আগস্ট: 8, সেপ্টেম্বর: 9, অক্টোবর: 10, নভেম্বর: 11, ডিসেম্বর: 12,
};

/** A class-day column: its date and, when the day has more than one class, the start time. */
export interface MarkColumn {
  date: string;
  time: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A column header of the register for `month` ("YYYY-MM"): "2026-11-07", "7/11/2026", "11/7/2026",
 * "07-Nov-26", "7 Nov", "7", optionally followed by a start time ("2026-11-07 16:00"). Day and month
 * written either way round are told apart by the register's month. Returns null when the header is
 * not a date, and `{ date }` outside the month when it is a real date of another month.
 */
export function parseMarkColumn(header: string | undefined | null, month: string): MarkColumn | null {
  const [year, monthNo] = month.split('-').map(Number);
  let value = clean(header).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return null;

  // A trailing start time: "… 16:00", "… 4:00 pm", "… 4 pm".
  let time: string | null = null;
  const timed = /^(.+?)[ t]+(\d{1,2}(?:[:.]\d{2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.))?)$/.exec(value);
  if (timed && /[:.]|am|pm/.test(timed[2])) {
    time = parseTime(timed[2]);
    if (!time) return null;
    value = timed[1].trim();
  }

  const date = (y: number, m: number, d: number): MarkColumn | null => {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    return isSchoolDate(iso) ? { date: iso, time } : null;
  };
  const fullYear = (text: string) => (text.length <= 2 ? 2000 + Number(text) : Number(text));

  // A bare day of the month: "7", "07".
  if (/^\d{1,2}$/.test(value)) return date(year, monthNo, Number(value));

  // Numbers only: Y-M-D, or day and month in either order with the year last.
  const numbers = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(value);
  if (numbers) {
    const [a, b, c] = [numbers[1], numbers[2], numbers[3]];
    if (a.length === 4) return date(Number(a), Number(b), Number(c));
    if (c.length !== 2 && c.length !== 4) return null;
    const y = fullYear(c);
    const [first, second] = [Number(a), Number(b)];
    // Day first (Bangladesh), unless that cannot be the register's month and the other order can.
    if (second === monthNo || first > 12) return date(y, second, first);
    if (first === monthNo) return date(y, first, second);
    return date(y, second, first);
  }

  // With a month name: "7 Nov", "07-Nov-26", "Nov 7 2026", "7 নভেম্বর".
  const parts = value.split(/[-/. ]+/).filter(Boolean);
  const named = parts.findIndex((part) => MONTH_NAMES[part] !== undefined);
  if (named >= 0 && parts.length >= 2 && parts.length <= 3) {
    const rest = parts.filter((_, index) => index !== named);
    if (!rest.every((part) => /^\d{1,4}$/.test(part))) return null;
    const dayText = rest.find((part) => part.length <= 2 && Number(part) >= 1 && Number(part) <= 31);
    if (!dayText) return null;
    const yearText = rest.find((part) => part !== dayText);
    return date(yearText ? fullYear(yearText) : year, MONTH_NAMES[parts[named]], Number(dayText));
  }
  return null;
}

/** Header names of the two student columns (English and Bangla spellings). */
const ROLL_HEADERS = ['roll', 'roll_no', 'roll no', 'roll no.', 'roll number', 'রোল', 'রোল নং', 'রোল নম্বর', 'ক্রমিক'];
const NAME_HEADERS = ['name', 'student', 'student name', 'full name', 'full_name', 'নাম', 'শিক্ষার্থী', 'শিক্ষার্থীর নাম'];

/** Which column of the header holds the roll number and which the name (-1 when missing). */
export function studentColumns(header: string[]): { roll: number; name: number } {
  const keys = header.map((cell) => clean(cell).replace(/_/g, ' '));
  const find = (names: string[]) => keys.findIndex((key) => names.some((name) => name.replace(/_/g, ' ') === key));
  return { roll: find(ROLL_HEADERS), name: find(NAME_HEADERS) };
}

const rollKey = (value: string | null | undefined) => {
  const key = clean(value).replace(/\s/g, '');
  // Spreadsheets drop leading zeros ("07" → "7"), so numbers compare as numbers.
  return /^\d+$/.test(key) ? String(Number(key)) : key;
};

/** A roll number compared with Bangla digits as Latin, spaces and leading zeros ignored ("০৭" = "07" = "7"). */
export const sameRoll = (a: string | null | undefined, b: string | null | undefined) => rollKey(a) !== '' && rollKey(a) === rollKey(b);
