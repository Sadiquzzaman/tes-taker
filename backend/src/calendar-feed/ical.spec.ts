import { foldLine, icalCalendar, icalText, icalTime } from './ical';

describe('iCal writer (CAL-07)', () => {
  it('writes UTC times and escapes text', () => {
    expect(icalTime(new Date('2026-11-07T10:00:00.000Z'))).toBe('20261107T100000Z');
    expect(icalText('Math; Room 2, Lab\\A\nline')).toBe('Math\\; Room 2\\, Lab\\\\A\\nline');
  });

  it('folds long lines at 75 octets without splitting a Bangla character', () => {
    const line = `SUMMARY:${'গণিত '.repeat(30)}`;
    const folded = foldLine(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    folded.forEach((part, index) => {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
      if (index > 0) expect(part.startsWith(' ')).toBe(true);
    });
    expect(folded.map((part, index) => (index ? part.slice(1) : part)).join('')).toBe(line);
  });

  it('writes a calendar with cancelled events marked', () => {
    const text = icalCalendar(
      'Rina — Instructor',
      [{ uid: 'a@instructor', start: new Date('2026-11-07T10:00:00Z'), end: new Date('2026-11-07T11:30:00Z'), summary: 'Math', location: 'Room 201', cancelled: true }],
      new Date('2026-11-01T00:00:00Z'),
    );
    expect(text.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Instructor//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Rina — Instructor',
      'BEGIN:VEVENT',
      'UID:a@instructor',
      'DTSTAMP:20261101T000000Z',
      'DTSTART:20261107T100000Z',
      'DTEND:20261107T113000Z',
      'SUMMARY:Math',
      'LOCATION:Room 201',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });
});
