export type ExamCategory = "academic" | "ielts";

export interface IELTSModule {
  id: string;
  label: string;
  value: string;
  moduleKey: string;
}

export const EXAM_CATEGORY_ACADEMIC: ExamCategory = "academic";
export const EXAM_CATEGORY_IELTS: ExamCategory = "ielts";

export const IELTS_MODULES: IELTSModule[] = [
  {
    id: "ielts.reading",
    label: "Reading",
    value: "ielts-reading",
    moduleKey: "ielts.reading",
  },
  {
    id: "ielts.writing",
    label: "Writing",
    value: "ielts-writing",
    moduleKey: "ielts.writing",
  },
  {
    id: "ielts.listening",
    label: "Listening",
    value: "ielts-listening",
    moduleKey: "ielts.listening",
  },
  {
    id: "ielts.speaking",
    label: "Speaking",
    value: "ielts-speaking",
    moduleKey: "ielts.speaking",
  },
];

export const EXAM_CATEGORIES = [
  { value: EXAM_CATEGORY_ACADEMIC, label: "Academic" },
  { value: EXAM_CATEGORY_IELTS, label: "IELTS" },
] as const;

export const getModuleLabel = (moduleKey: string | null | undefined): string => {
  if (!moduleKey) return "";
  const module = IELTS_MODULES.find((m) => m.moduleKey === moduleKey);
  return module?.label ?? "";
};
