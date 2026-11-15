import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsOption } from './entities/ielts-question-group.entity';
import { IeltsAnswerKey } from './entities/ielts-question.entity';
import { PART_COUNT } from './ielts-templates';
import { GroupInput, groupProblem, IeltsGroupTypeEnum, MODULE_NUMBERS, numbersTaken } from './question-groups';

/** An academic-builder IELTS question, as stored in exam_questions. */
export interface OldQuestion {
  id: string;
  module_key: string | null;
  section_id: string | null;
  parent_id: string | null;
  category: string | null;
  sub_type: string | null;
  sort_order: number;
  question: string;
  instruction: string | null;
  passage_text: string | null;
  options_json: { id: string; text: string }[] | null;
  matching_options_json: { left: { id: string; text: string }[]; right: { id: string; text: string }[] } | null;
  answer_json: { type: string; value: string[] } | null;
  image_url: string | null;
  audio_url: string | null;
}

export interface OldSection {
  id: string;
  module_key: string | null;
  header_text: string | null;
  instruction: string | null;
  sort_order: number;
}

export interface ConvertedPart {
  module: IeltsModuleEnum;
  part_no: number;
  content: string | null;
  groups: GroupInput[];
}

export interface Conversion {
  modules: IeltsModuleEnum[];
  parts: ConvertedPart[];
  /** Questions that do not fit the new format, with why; the teacher adds them again. */
  skipped: { question_id: string; reason: string }[];
  converted: number;
}

const MODULE_OF: Record<string, IeltsModuleEnum> = {
  'ielts.listening': IeltsModuleEnum.LISTENING,
  'ielts.reading': IeltsModuleEnum.READING,
  'ielts.writing': IeltsModuleEnum.WRITING,
  'ielts.speaking': IeltsModuleEnum.SPEAKING,
};

const TYPE_OF: Record<string, IeltsGroupTypeEnum> = {
  'multiple-choice': IeltsGroupTypeEnum.MCQ_SINGLE,
  'multiple-response': IeltsGroupTypeEnum.MCQ_MULTI,
  'true-false-not-given': IeltsGroupTypeEnum.TFNG,
  'yes-no-not-given': IeltsGroupTypeEnum.YNNG,
  'matching-ordering': IeltsGroupTypeEnum.MATCH_INFO,
  'fill-in-the-blanks': IeltsGroupTypeEnum.SENTENCE_COMPLETION,
  'sentence-completion': IeltsGroupTypeEnum.SENTENCE_COMPLETION,
  'summary-completion': IeltsGroupTypeEnum.SUMMARY_COMPLETION,
  'table-completion': IeltsGroupTypeEnum.TABLE_COMPLETION,
  'diagram-label': IeltsGroupTypeEnum.DIAGRAM_LABEL,
  'short-answer': IeltsGroupTypeEnum.SHORT_ANSWER,
};

const letter = (i: number) => String.fromCharCode(65 + i);
const DEFAULT_INSTRUCTION = 'Answer the questions below.';

/** Plain text kept safe for the rich-text passage (the screen sanitises it again). */
const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('');

/** One old question as questions of a group, or why it cannot be. */
function convertQuestion(q: OldQuestion, type: IeltsGroupTypeEnum): { shared?: IeltsOption[]; questions: GroupInput['questions'] } | string {
  const answer = q.answer_json;
  if (!answer?.value?.length) return 'no right answer';
  const options = q.options_json ?? [];
  const keyOf = (id: string) => {
    const i = options.findIndex((o) => o.id === id);
    return i < 0 ? null : letter(i);
  };
  switch (type) {
    case IeltsGroupTypeEnum.MCQ_SINGLE:
    case IeltsGroupTypeEnum.MCQ_MULTI: {
      const keys = answer.value.map(keyOf);
      if (!options.length || keys.some((k) => !k)) return 'the right option is missing';
      return { questions: [{ prompt: q.question, options: options.map((o, i) => ({ key: letter(i), text: o.text })), answer: { keys: keys as string[] } }] };
    }
    case IeltsGroupTypeEnum.TFNG:
    case IeltsGroupTypeEnum.YNNG: {
      const chosen = options.find((o) => o.id === answer.value[0])?.text ?? answer.value[0];
      const key = chosen.trim().toUpperCase().replace(/\s+/g, ' ');
      return { questions: [{ prompt: q.question, answer: { keys: [key] } }] };
    }
    case IeltsGroupTypeEnum.MATCH_INFO: {
      const m = q.matching_options_json;
      if (!m?.left?.length || !m.right?.length) return 'the matching lists are missing';
      const right = new Map(m.right.map((o, i) => [o.id, letter(i)]));
      const pairs = new Map(answer.value.map((p) => p.split('::') as [string, string]));
      const questions = m.left.map((l) => ({ prompt: l.text, answer: { keys: [right.get(pairs.get(l.id) ?? '') ?? ''] } as IeltsAnswerKey }));
      if (questions.some((x) => 'keys' in x.answer && !x.answer.keys[0])) return 'a matching pair is missing';
      return { shared: m.right.map((o, i) => ({ key: letter(i), text: o.text })), questions };
    }
    default:
      return { questions: [{ prompt: q.question, answer: { accepted: answer.value.map((v) => v.trim()).filter(Boolean) } }] };
  }
}

/**
 * Turns an academic-builder IELTS exam into the new format (P10-08): Reading passages become
 * passages 1–3, Listening sections parts 1–4, Writing tasks and Speaking parts their parts, and
 * runs of questions of one kind become question groups. Anything the paper's rules refuse is
 * skipped with a reason; numbers stop at 40 per module. Recordings were links, not uploads, so
 * Listening parts note the link and need the recording uploaded again.
 */
export function convertExam(questions: OldQuestion[], sections: OldSection[]): Conversion {
  const skipped: Conversion['skipped'] = [];
  const parts = new Map<string, ConvertedPart>();
  const part = (module: IeltsModuleEnum, no: number) => {
    const key = `${module}:${no}`;
    if (!parts.has(key)) parts.set(key, { module, part_no: no, content: null, groups: [] });
    return parts.get(key) as ConvertedPart;
  };
  const sectionOrder = new Map(
    [...sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => [s.id, s]),
  );
  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
  const used: Partial<Record<IeltsModuleEnum, number>> = {};

  // Writing and Speaking: the task or questions go into the part.
  for (const q of sorted) {
    const module = MODULE_OF[q.module_key ?? ''];
    const sub = q.sub_type ?? '';
    const task = sub.match(/^(writing-task|speaking-part)-(\d)$/);
    if (!task) continue;
    const target = task[1] === 'writing-task' ? IeltsModuleEnum.WRITING : IeltsModuleEnum.SPEAKING;
    if (module && module !== target) continue;
    const p = part(target, Number(task[2]));
    p.content = `${p.content ?? ''}${paragraphs(q.question)}${q.image_url ? `<p>Picture: ${q.image_url}</p>` : ''}`;
  }

  // Reading passages: each top-level passage is a passage, its children the questions.
  const passages = sorted.filter((q) => MODULE_OF[q.module_key ?? ''] === IeltsModuleEnum.READING && !q.parent_id && q.passage_text);
  passages.forEach((p, i) => {
    const target = part(IeltsModuleEnum.READING, Math.min(i + 1, PART_COUNT[IeltsModuleEnum.READING]));
    target.content = `${target.content ?? ''}${paragraphs(p.passage_text as string)}`;
  });
  const partOf = (q: OldQuestion, module: IeltsModuleEnum): ConvertedPart => {
    if (module === IeltsModuleEnum.READING) {
      const at = passages.findIndex((p) => p.id === q.parent_id);
      return part(module, Math.min(Math.max(at, 0) + 1, PART_COUNT[module]));
    }
    // Listening: each builder section is a part, in order.
    const sectionIds = [...sectionOrder.values()].filter((s) => MODULE_OF[s.module_key ?? ''] === module).map((s) => s.id);
    const at = q.section_id ? sectionIds.indexOf(q.section_id) : 0;
    return part(module, Math.min(Math.max(at, 0) + 1, PART_COUNT[module]));
  };

  let converted = 0;
  let previous: { part: ConvertedPart; type: IeltsGroupTypeEnum; parent: string | null } | null = null;
  for (const q of sorted) {
    const module = MODULE_OF[q.module_key ?? ''];
    if (!module || module === IeltsModuleEnum.WRITING || module === IeltsModuleEnum.SPEAKING) continue;
    if (!q.parent_id && q.passage_text) continue;
    if ((q.sub_type ?? '').startsWith('writing-') || (q.sub_type ?? '').startsWith('speaking-')) continue;
    const type = TYPE_OF[q.sub_type ?? ''];
    if (!type) {
      skipped.push({ question_id: q.id, reason: `"${q.sub_type ?? 'unknown'}" questions have no IELTS type` });
      continue;
    }
    const built = convertQuestion(q, type);
    if (typeof built === 'string') {
      skipped.push({ question_id: q.id, reason: built });
      continue;
    }
    const target = partOf(q, module);
    if (module === IeltsModuleEnum.LISTENING && q.audio_url && !target.content?.includes(q.audio_url)) {
      target.content = `${target.content ?? ''}<p>Recording (upload it again): ${q.audio_url}</p>`;
    }
    const taken = built.questions.reduce((n, x) => n + numbersTaken(type, x.answer), 0);
    if ((used[module] ?? 0) + taken > MODULE_NUMBERS) {
      skipped.push({ question_id: q.id, reason: `${module} already has 40 questions` });
      continue;
    }
    // A run of one kind (same passage, no shared list) becomes one group, like the real paper.
    const extend = previous && previous.part === target && previous.type === type && previous.parent === q.parent_id && !built.shared;
    const group: GroupInput = extend
      ? (target.groups[target.groups.length - 1] as GroupInput)
      : {
          type,
          instruction: q.instruction?.trim() || sectionOrder.get(q.section_id ?? '')?.instruction?.trim() || DEFAULT_INSTRUCTION,
          ...(built.shared ? { shared: { options: built.shared } } : {}),
          questions: [],
        };
    const candidate: GroupInput = { ...group, questions: [...group.questions, ...built.questions] };
    const problem = groupProblem(module, candidate);
    if (problem) {
      skipped.push({ question_id: q.id, reason: problem });
      continue;
    }
    if (extend) target.groups[target.groups.length - 1] = candidate;
    else target.groups.push(candidate);
    used[module] = (used[module] ?? 0) + taken;
    converted += 1;
    previous = { part: target, type, parent: q.parent_id };
  }

  const list = [...parts.values()];
  const modules = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING, IeltsModuleEnum.WRITING, IeltsModuleEnum.SPEAKING].filter((m) => list.some((p) => p.module === m));
  return { modules, parts: list, skipped, converted };
}
