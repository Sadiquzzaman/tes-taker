/**
 * A minimal iCalendar (RFC 5545) writer for the calendar subscription link (CAL-07). No package:
 * VEVENTs with UTC times, escaped text and lines folded at 75 octets.
 */

export interface IcalEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  cancelled?: boolean;
}

/** "20261107T100000Z" */
export const icalTime = (instant: Date) => instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escapes text values: backslash, semicolon, comma and new lines. */
export const icalText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line to 75 octets per line (continuation lines start with a space), never splitting a character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** The whole calendar, CRLF line ends. */
export function icalCalendar(name: string, events: IcalEvent[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Instructor//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icalText(name)}`];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${icalTime(now)}`,
      `DTSTART:${icalTime(event.start)}`,
      `DTEND:${icalTime(event.end)}`,
      `SUMMARY:${icalText(event.summary)}`,
    );
    if (event.location) lines.push(`LOCATION:${icalText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${icalText(event.description)}`);
    if (event.cancelled) lines.push('STATUS:CANCELLED');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
