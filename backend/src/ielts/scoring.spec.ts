import { marksFor, normalise } from './scoring';

describe('IELTS scoring', () => {
  it('compares written answers without case or extra spaces, within the word limit', () => {
    expect(normalise('  Sea   Road ')).toBe('sea road');
    const key = { accepted: ['colour', 'color'] };
    expect(marksFor('NOTE_COMPLETION', key, 1, 'COLOR')).toBe(1);
    expect(marksFor('NOTE_COMPLETION', key, 1, ' colour ')).toBe(1);
    expect(marksFor('NOTE_COMPLETION', key, 1, 'colours')).toBe(0);
    expect(marksFor('NOTE_COMPLETION', { accepted: ['sea road'] }, 1, 'Sea Road')).toBe(0); // over the limit
    expect(marksFor('NOTE_COMPLETION', { accepted: ['21 Sea Road'] }, 2, '21 sea road')).toBe(1); // numbers do not count
    expect(marksFor('SHORT_ANSWER', key, null, '')).toBe(0);
    expect(marksFor('SHORT_ANSWER', key, null, null)).toBe(0);
  });

  it('marks choices, with a mark per right letter for "Choose TWO"', () => {
    expect(marksFor('TFNG', { keys: ['NOT GIVEN'] }, null, 'NOT GIVEN')).toBe(1);
    expect(marksFor('MCQ_SINGLE', { keys: ['B'] }, null, 'C')).toBe(0);
    expect(marksFor('MCQ_SINGLE', { keys: ['B'] }, null, 'B,C')).toBe(0);
    expect(marksFor('MCQ_MULTI', { keys: ['B', 'D'] }, null, 'D,B')).toBe(2);
    expect(marksFor('MCQ_MULTI', { keys: ['B', 'D'] }, null, 'B,E')).toBe(1);
    expect(marksFor('MCQ_MULTI', { keys: ['B', 'D'] }, null, 'B,D,E')).toBe(0);
    expect(marksFor('SUMMARY_COMPLETION', { keys: ['C'] }, null, 'C')).toBe(1);
  });
});
