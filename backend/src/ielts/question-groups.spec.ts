import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { GroupInput, groupProblem, IeltsGroupTypeEnum, numbersTaken, wordCount } from './question-groups';

const { LISTENING, READING } = IeltsModuleEnum;
const abcd = [{ key: 'A', text: 'one' }, { key: 'B', text: 'two' }, { key: 'C', text: 'three' }, { key: 'D', text: 'four' }];

describe('IELTS question groups', () => {
  const group = (extra: Partial<GroupInput>): GroupInput => ({ type: IeltsGroupTypeEnum.SHORT_ANSWER, instruction: 'Answer the questions.', questions: [], ...extra });

  it('counts words without numbers', () => {
    expect(wordCount(' 25 Sea  Road ')).toBe(2);
    expect(wordCount('colour')).toBe(1);
    expect(wordCount('1990')).toBe(0);
  });

  it('gives "Choose TWO letters" two numbers', () => {
    expect(numbersTaken('MCQ_MULTI', { keys: ['B', 'D'] })).toBe(2);
    expect(numbersTaken('MCQ_SINGLE', { keys: ['B'] })).toBe(1);
    expect(numbersTaken('NOTE_COMPLETION', { accepted: ['x'] })).toBe(1);
  });

  it('accepts written answers within the word limit', () => {
    const g = group({ type: IeltsGroupTypeEnum.NOTE_COMPLETION, word_limit: 2, shared: { text: 'Hotel on [[1]]' }, questions: [{ answer: { accepted: ['Sea Road', 'sea rd'] } }] });
    expect(groupProblem(LISTENING, g)).toBeNull();
    expect(groupProblem(LISTENING, { ...g, questions: [{ answer: { accepted: ['the Sea Road'] } }] })).toMatch(/word limit/);
    expect(groupProblem(LISTENING, { ...g, questions: [{ answer: { accepted: [] } }] })).toMatch(/accepted answers/);
    expect(groupProblem(LISTENING, { ...g, questions: [{ answer: { keys: ['A'] } }] })).toMatch(/accepted answers/);
    expect(groupProblem(LISTENING, { ...g, word_limit: 6 })).toMatch(/1 to 5/);
  });

  it('checks choices against the question’s options, the shared list or the fixed set', () => {
    const mcq = group({ type: IeltsGroupTypeEnum.MCQ_SINGLE, questions: [{ prompt: 'Why?', options: abcd, answer: { keys: ['C'] } }] });
    expect(groupProblem(LISTENING, mcq)).toBeNull();
    expect(groupProblem(LISTENING, { ...mcq, questions: [{ prompt: 'Why?', options: abcd, answer: { keys: ['E'] } }] })).toMatch(/one of the choices/);
    expect(groupProblem(LISTENING, { ...mcq, questions: [{ prompt: 'Why?', options: abcd, answer: { keys: ['A', 'B'] } }] })).toMatch(/one right answer/);
    expect(groupProblem(LISTENING, { ...mcq, questions: [{ prompt: 'Why?', options: [abcd[0], { key: 'A', text: 'x' }], answer: { keys: ['A'] } }] })).toMatch(/different letters/);

    const multi = group({ type: IeltsGroupTypeEnum.MCQ_MULTI, questions: [{ prompt: 'Which TWO?', options: abcd, answer: { keys: ['A', 'D'] } }] });
    expect(groupProblem(READING, multi)).toBeNull();
    expect(groupProblem(READING, { ...multi, questions: [{ prompt: 'Which?', options: abcd, answer: { keys: ['A'] } }] })).toMatch(/at least two/);

    const tfng = group({ type: IeltsGroupTypeEnum.TFNG, questions: [{ prompt: 'The sky is green.', answer: { keys: ['FALSE'] } }] });
    expect(groupProblem(READING, tfng)).toBeNull();
    expect(groupProblem(READING, { ...tfng, questions: [{ prompt: 'x', answer: { keys: ['NO'] } }] })).toMatch(/one of the choices/);
    expect(groupProblem(LISTENING, tfng)).toMatch(/not used in LISTENING/);

    const headings = group({ type: IeltsGroupTypeEnum.MATCH_HEADINGS, shared: { options: [{ key: 'i', text: 'Early days' }, { key: 'ii', text: 'Later' }] }, questions: [{ prompt: 'Paragraph A', answer: { keys: ['ii'] } }] });
    expect(groupProblem(READING, headings)).toBeNull();
    expect(groupProblem(READING, { ...headings, shared: null })).toMatch(/list to choose from/);
  });

  it('lets completion use a word box', () => {
    const box = group({ type: IeltsGroupTypeEnum.SUMMARY_COMPLETION, shared: { options: abcd, text: 'It was [[1]].' }, questions: [{ answer: { keys: ['B'] } }] });
    expect(groupProblem(READING, box)).toBeNull();
    expect(groupProblem(READING, { ...box, questions: [{ answer: { accepted: ['two'] } }] })).toMatch(/choose the right answer/);
  });

  it('needs an instruction, questions and prompts where the paper shows them', () => {
    expect(groupProblem(READING, group({ instruction: ' ', questions: [{ prompt: 'Q', answer: { accepted: ['a'] } }] }))).toMatch(/instruction/);
    expect(groupProblem(READING, group({ questions: [] }))).toMatch(/1 to 40/);
    expect(groupProblem(READING, group({ questions: [{ answer: { accepted: ['a'] } }] }))).toMatch(/write the question/);
    expect(groupProblem(READING, group({ word_limit: 2, type: IeltsGroupTypeEnum.TFNG, questions: [{ prompt: 'x', answer: { keys: ['TRUE'] } }] }))).toMatch(/word limit/);
    expect(groupProblem(READING, group({ shared: { text: 'gap [[1]]' }, type: IeltsGroupTypeEnum.TFNG, questions: [{ prompt: 'x', answer: { keys: ['TRUE'] } }] }))).toMatch(/text with gaps/);
  });
});
