import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';

/**
 * Reading the cells of a schedule CSV (ATT-16). People type days, times and choices in English or
 * Bangla, with Bangla or Latin digits; each reader returns null when it cannot understand the cell.
 */

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const latinDigits = (value: string) => value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
const clean = (value: string | undefined) => latinDigits((value ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');

/** ISO day by name: English (full or 3 letters, "thur"/"thurs" too) and Bangla (with or without "বার"). */
const DAY_NAMES: Record<string, number> = {
  mon: 1, monday: 1, সোম: 1,
  tue: 2, tues: 2, tuesday: 2, মঙ্গল: 2,
  wed: 3, wednesday: 3, বুধ: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, বৃহস্পতি: 4,
  fri: 5, friday: 5, শুক্র: 5,
  sat: 6, saturday: 6, শনি: 6,
  sun: 7, sunday: 7, রবি: 7,
};

/** "Sat;Mon", "sat mon", "শনি, সোম", "6;1" → [6, 1] (ISO, in the order written, no repeats); null if any part is unknown. */
export function parseDays(cell: string | undefined): number[] | null {
  const parts = clean(cell).split(/[;,/|\s]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const days: number[] = [];
  for (const part of parts) {
    const name = part.replace(/বার$/, '').replace(/\.$/, '');
    const day = /^[1-7]$/.test(name) ? Number(name) : DAY_NAMES[name];
    if (!day) return null;
    if (!days.includes(day)) days.push(day);
  }
  return days;
}

/** "16:00", "4:00 PM", "4 pm", "৪:৩০ pm", "16.00" → "HH:MM" (24-hour); null otherwise. */
export function parseTime(cell: string | undefined): string | null {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(clean(cell));
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const half = match[3]?.replace(/\./g, '');
  if (minutes > 59) return null;
  if (half) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (half === 'pm' ? 12 : 0);
  } else if (match[2] === undefined || hours > 23) {
    // A bare "4" is ambiguous (4 AM or 4 PM); ask for minutes or AM/PM.
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const CLASS_TYPES: Record<string, SectionClassTypeEnum> = {
  in_person: SectionClassTypeEnum.IN_PERSON, 'in person': SectionClassTypeEnum.IN_PERSON, 'in-person': SectionClassTypeEnum.IN_PERSON,
  offline: SectionClassTypeEnum.IN_PERSON, সরাসরি: SectionClassTypeEnum.IN_PERSON,
  online: SectionClassTypeEnum.ONLINE, অনলাইন: SectionClassTypeEnum.ONLINE,
};

/** "In person" / "online" (English or Bangla); undefined for an empty cell (no change), null if unknown. */
export function parseClassType(cell: string | undefined): SectionClassTypeEnum | null | undefined {
  const value = clean(cell);
  if (!value) return undefined;
  return CLASS_TYPES[value] ?? null;
}

const MODES: Record<string, SectionAttendanceModeEnum> = {
  self_checkin: SectionAttendanceModeEnum.SELF_CHECKIN, 'self check-in': SectionAttendanceModeEnum.SELF_CHECKIN,
  'self checkin': SectionAttendanceModeEnum.SELF_CHECKIN, 'check-in': SectionAttendanceModeEnum.SELF_CHECKIN,
  'নিজে চেক-ইন': SectionAttendanceModeEnum.SELF_CHECKIN,
  paper_register: SectionAttendanceModeEnum.PAPER_REGISTER, 'paper register': SectionAttendanceModeEnum.PAPER_REGISTER,
  paper: SectionAttendanceModeEnum.PAPER_REGISTER, 'কাগজের খাতা': SectionAttendanceModeEnum.PAPER_REGISTER, খাতা: SectionAttendanceModeEnum.PAPER_REGISTER,
};

/** "Self check-in" / "paper register" (English or Bangla); undefined for an empty cell, null if unknown. */
export function parseMode(cell: string | undefined): SectionAttendanceModeEnum | null | undefined {
  const value = clean(cell);
  if (!value) return undefined;
  return MODES[value] ?? null;
}

const DEFAULT_WORDS = ['default', 'ডিফল্ট', '-'];

/**
 * Grace period: a whole number 0–60 ("10" or "10 min"), or "default" for the organisation's (null);
 * undefined for an empty cell (no change); NaN if not understood.
 */
export function parseGrace(cell: string | undefined): number | null | undefined {
  const value = clean(cell);
  if (!value) return undefined;
  if (DEFAULT_WORDS.includes(value)) return null;
  const match = /^(\d{1,2})\s*(?:min|mins|minutes|মিনিট)?$/.exec(value);
  const minutes = match ? Number(match[1]) : Number.NaN;
  return minutes >= 0 && minutes <= 60 ? minutes : Number.NaN;
}

/** Text matched case-insensitively with spaces collapsed (class, section and branch names). */
export const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === (b ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
