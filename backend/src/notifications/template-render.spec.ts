import { renderTemplate, wrapEmailHtml } from './template-render';

describe('renderTemplate (design §8.6)', () => {
  const at = '2026-11-02T04:30:00.000Z'; // 10:30 in Dhaka

  it('fills variables and leaves missing ones empty', () => {
    expect(renderTemplate('Hi {{name}}, code {{ otp }}{{missing}}.', { name: 'Rina', otp: '123456' }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toBe(
      'Hi Rina, code 123456.',
    );
  });

  it('shows dates in the recipient language and the organisation time zone, with Bangla digits', () => {
    const en = renderTemplate('{{exam_start_at}}', { exam_start_at: at }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false });
    const bn = renderTemplate('{{exam_start_at}}', { exam_start_at: at }, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false });
    expect(en).toContain('10:30');
    expect(bn).toContain('১০:৩০');
    expect(bn).toMatch(/২০২৬/);
    // A 24-hour clock in both languages: 20:00, never "৮:০০ PM".
    const evening = { exam_start_at: '2026-11-02T14:00:00.000Z' };
    expect(renderTemplate('{{exam_start_at}}', evening, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false })).toContain('২০:০০');
    expect(renderTemplate('{{exam_start_at}}', evening, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false })).not.toMatch(/PM|AM/);
    expect(renderTemplate('{{exam_start_at}}', evening, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toContain('20:00');
  });

  it('shows school dates (`*_on`) as the day and month, never shifted by a time zone', () => {
    expect(renderTemplate('{{absent_on}}', { absent_on: '2026-10-21' }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toBe('21 Oct');
    expect(renderTemplate('{{absent_on}}', { absent_on: '2026-10-21' }, { locale: 'en', timeZone: 'America/Los_Angeles', html: false })).toBe('21 Oct');
    expect(renderTemplate('{{absent_on}}', { absent_on: '2026-10-21' }, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false })).toMatch(/^২১ /);
    expect(renderTemplate('{{note_on}}', { note_on: 'soon' }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toBe('soon');
  });

  it('shows numbers with Bangla digits in Bangla', () => {
    expect(renderTemplate('{{n}}', { n: 1250 }, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false })).toBe('১,২৫০');
    expect(renderTemplate('{{n}}', { n: 1250 }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toBe('1,250');
  });

  it('translates known codes such as a member role', () => {
    expect(renderTemplate('{{role}}', { role: 'TEACHER' }, { locale: 'bn', timeZone: 'Asia/Dhaka', html: false })).toBe('শিক্ষক');
    expect(renderTemplate('{{role}}', { role: 'TEACHER' }, { locale: 'en', timeZone: 'Asia/Dhaka', html: false })).toBe('teacher');
  });

  it('escapes variables in email HTML but keeps the template markup', () => {
    expect(renderTemplate('<b>{{name}}</b>', { name: '<script>x</script>' }, { locale: 'en', timeZone: 'Asia/Dhaka', html: true })).toBe(
      '<b>&lt;script&gt;x&lt;/script&gt;</b>',
    );
  });

  it('wraps an email body in the layout with the language set', () => {
    const html = wrapEmailHtml('<p>Hi</p>', 'bn');
    expect(html).toContain('lang="bn"');
    expect(html).toContain('<p>Hi</p>');
  });
});
