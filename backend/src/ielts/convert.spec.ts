import { convertExam, OldQuestion } from './convert';

let order = 0;
const q = (extra: Partial<OldQuestion>): OldQuestion => ({
  id: `q${++order}`,
  module_key: 'ielts.reading',
  section_id: null,
  parent_id: null,
  category: 'ielts',
  sub_type: 'short-answer',
  sort_order: order,
  question: 'What?',
  instruction: null,
  passage_text: null,
  options_json: null,
  matching_options_json: null,
  answer_json: { type: 'text', value: ['answer'] },
  image_url: null,
  audio_url: null,
  ...extra,
});

describe('Converting academic-builder IELTS exams', () => {
  beforeEach(() => {
    order = 0;
  });

  it('makes passages, groups runs of one kind, and maps answers to keys', () => {
    const passage = q({ id: 'p1', sub_type: null, passage_text: 'Glass was first made…', question: 'Passage' });
    const options = [{ id: 'o1', text: 'one' }, { id: 'o2', text: 'two' }, { id: 'o3', text: 'three' }];
    const result = convertExam(
      [
        passage,
        q({ parent_id: 'p1', question: 'Where?', answer_json: { type: 'text', value: [' Egypt ', 'egypt'] } }),
        q({ parent_id: 'p1', question: 'When?' }),
        q({ parent_id: 'p1', sub_type: 'multiple-choice', question: 'Which?', options_json: options, answer_json: { type: 'optionId', value: ['o2'] } }),
        q({ parent_id: 'p1', sub_type: 'true-false-not-given', question: 'Claim', options_json: [{ id: 't', text: 'True' }, { id: 'f', text: 'False' }, { id: 'n', text: 'Not given' }], answer_json: { type: 'optionId', value: ['n'] } }),
        q({ parent_id: 'p1', sub_type: 'matching-ordering', question: 'Match', matching_options_json: { left: [{ id: 'l1', text: 'Para A' }, { id: 'l2', text: 'Para B' }], right: [{ id: 'r1', text: 'Heading 1' }, { id: 'r2', text: 'Heading 2' }] }, answer_json: { type: 'matchingOrdering', value: ['l1::r2', 'l2::r1'] } }),
      ],
      [],
    );
    expect(result.modules).toEqual(['READING']);
    expect(result.converted).toBe(5);
    const [reading] = result.parts;
    expect(reading.content).toBe('<p>Glass was first made…</p>');
    expect(reading.groups.map((g) => [g.type, g.questions.length])).toEqual([['SHORT_ANSWER', 2], ['MCQ_SINGLE', 1], ['TFNG', 1], ['MATCH_INFO', 2]]);
    expect(reading.groups[0].questions[0].answer).toEqual({ accepted: ['Egypt', 'egypt'] });
    expect(reading.groups[1].questions[0].answer).toEqual({ keys: ['B'] });
    expect(reading.groups[2].questions[0].answer).toEqual({ keys: ['NOT GIVEN'] });
    expect(reading.groups[3].shared?.options?.map((o) => o.key)).toEqual(['A', 'B']);
    expect(reading.groups[3].questions.map((x) => x.answer)).toEqual([{ keys: ['B'] }, { keys: ['A'] }]);
  });

  it('puts Writing tasks and Speaking parts in their parts, and Listening sections in parts', () => {
    const result = convertExam(
      [
        q({ module_key: 'ielts.writing', sub_type: 'writing-task-1', question: 'Describe the chart.', image_url: 'https://x/chart.png', answer_json: null }),
        q({ module_key: 'ielts.writing', sub_type: 'writing-task-2', question: 'Discuss.', answer_json: null }),
        q({ module_key: 'ielts.speaking', sub_type: 'speaking-part-2', question: 'Describe a place.', answer_json: null }),
        q({ module_key: 'ielts.listening', section_id: 's2', audio_url: 'https://x/part2.mp3', question: 'Name?' }),
      ],
      [
        { id: 's1', module_key: 'ielts.listening', header_text: null, instruction: null, sort_order: 1 },
        { id: 's2', module_key: 'ielts.listening', header_text: null, instruction: 'Write ONE WORD.', sort_order: 2 },
      ],
    );
    expect(result.modules).toEqual(['LISTENING', 'WRITING', 'SPEAKING']);
    const find = (module: string, no: number) => result.parts.find((p) => p.module === module && p.part_no === no);
    expect(find('WRITING', 1)?.content).toContain('Picture: https://x/chart.png');
    expect(find('SPEAKING', 2)?.content).toBe('<p>Describe a place.</p>');
    expect(find('LISTENING', 2)?.content).toContain('Recording (upload it again): https://x/part2.mp3');
    expect(find('LISTENING', 2)?.groups[0].instruction).toBe('Write ONE WORD.');
  });

  it('skips what the new format cannot hold, with why', () => {
    const result = convertExam(
      [
        q({ module_key: 'ielts.listening', sub_type: 'true-false-not-given', options_json: [{ id: 't', text: 'True' }], answer_json: { type: 'optionId', value: ['t'] } }),
        q({ sub_type: 'essay' }),
        q({ answer_json: null }),
        q({ sub_type: 'multiple-choice', options_json: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }], answer_json: { type: 'optionId', value: ['missing'] } }),
      ],
      [],
    );
    expect(result.converted).toBe(0);
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'TFNG is not used in LISTENING',
      '"essay" questions have no IELTS type',
      'no right answer',
      'the right option is missing',
    ]);
  });

  it('stops at 40 numbers in a module', () => {
    const many = Array.from({ length: 42 }, () => q({}));
    const result = convertExam(many, []);
    expect(result.converted).toBe(40);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].reason).toBe('READING already has 40 questions');
  });
});
