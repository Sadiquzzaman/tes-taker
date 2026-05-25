export const createTestSubjectOptions = [
  { label: "Mathematics", value: "math" },
  { label: "Science", value: "science" },
  { label: "English", value: "english" },
  { label: "History", value: "history" },
  { label: "Mathematics2", value: "math2" },
  { label: "Science2", value: "science2" },
  { label: "English2", value: "english2" },
  { label: "History2", value: "history2" },
];

export const CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID = "multiple-choice";
export const CREATE_TEST_GRADED_MULTIPLE_RESPONSE_SUBTYPE_ID = "multiple-response";
export const CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID = "true-false";
export const CREATE_TEST_GRADED_FILL_IN_THE_BLANKS_SUBTYPE_ID = "fill-in-the-blanks";
export const CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID = "essay";

export const CREATE_TEST_VARIABLE_OPTION_MIN_COUNT = 3;
export const CREATE_TEST_VARIABLE_OPTION_MAX_COUNT = 5;

export type CreateTestQuestionAnswerMode = "single" | "multiple" | "none";

export type CreateTestQuestionFixedOptionTemplate = {
  image: string | null;
  text: string;
};

export type CreateTestQuestionOptionRules = {
  canAddOptions: boolean;
  canEditOptionImage: boolean;
  canEditOptionText: boolean;
  canRemoveOptions: boolean;
  canShuffleOptions: boolean;
  fixedOptions: CreateTestQuestionFixedOptionTemplate[];
  maxOptions: number;
  minOptions: number;
  useFixedOptions: boolean;
};

const createVariableOptionRules = (): CreateTestQuestionOptionRules => ({
  canAddOptions: true,
  canEditOptionImage: true,
  canEditOptionText: true,
  canRemoveOptions: true,
  canShuffleOptions: true,
  fixedOptions: [],
  maxOptions: CREATE_TEST_VARIABLE_OPTION_MAX_COUNT,
  minOptions: CREATE_TEST_VARIABLE_OPTION_MIN_COUNT,
  useFixedOptions: false,
});

const createFixedOptionRules = (
  fixedOptions: CreateTestQuestionFixedOptionTemplate[],
): CreateTestQuestionOptionRules => ({
  canAddOptions: false,
  canEditOptionImage: false,
  canEditOptionText: false,
  canRemoveOptions: false,
  canShuffleOptions: false,
  fixedOptions,
  maxOptions: fixedOptions.length,
  minOptions: fixedOptions.length,
  useFixedOptions: true,
});

const createTrueFalseOptionTemplates = (): CreateTestQuestionFixedOptionTemplate[] => [
  { image: null, text: "True" },
  { image: null, text: "False" },
  { image: null, text: "Not Given" },
];

export type CreateTestQuestionSubtypeOption = {
  answerMode: CreateTestQuestionAnswerMode;
  id: string;
  label: string;
  optionRules: CreateTestQuestionOptionRules | null;
  isSupported: boolean;
};

export type CreateTestQuestionCategoryOption = {
  id: CreateTestQuestionCategory;
  label: string;
  tabs: CreateTestQuestionSubtypeOption[];
};

export const createTestQuestionCategoryOptions: CreateTestQuestionCategoryOption[] = [
  {
    id: "graded",
    label: "Graded",
    tabs: [
      {
        id: "multiple-choice",
        label: "Multiple Choice",
        isSupported: true,
        answerMode: "single",
        optionRules: createVariableOptionRules(),
      },
      {
        id: "multiple-response",
        label: "Multiple Response",
        isSupported: true,
        answerMode: "multiple",
        optionRules: createVariableOptionRules(),
      },
      {
        id: "true-false",
        label: "True / False",
        isSupported: true,
        answerMode: "single",
        optionRules: createFixedOptionRules(createTrueFalseOptionTemplates()),
      },
      {
        id: "fill-in-the-blanks",
        label: "Fill in the Blanks",
        isSupported: true,
        answerMode: "single",
        optionRules: createVariableOptionRules(),
      },
      {
        id: "matching-ordering",
        label: "Matching /Ordering",
        isSupported: false,
        answerMode: "none",
        optionRules: null,
      },
    ],
  },
  {
    id: "ungraded",
    label: "Ungraded",
    tabs: [
      {
        id: "true-false",
        label: "True/False",
        isSupported: false,
        answerMode: "none",
        optionRules: null,
      },
      {
        id: "essay",
        label: "Essay",
        isSupported: true,
        answerMode: "none",
        optionRules: null,
      },
      {
        id: "fill-in-the-gaps",
        label: "Fill in the gaps",
        isSupported: false,
        answerMode: "none",
        optionRules: null,
      },
    ],
  },
  {
    id: "other",
    label: "Other",
    tabs: [
      {
        id: "mcq",
        label: "MCQ",
        isSupported: false,
        answerMode: "none",
        optionRules: null,
      },
    ],
  },
];

export const getCreateTestQuestionCategory = (categoryId: CreateTestQuestionCategory) =>
  createTestQuestionCategoryOptions.find((category) => category.id === categoryId) ?? null;

export const getCreateTestQuestionTabs = (categoryId: CreateTestQuestionCategory) =>
  getCreateTestQuestionCategory(categoryId)?.tabs ?? [];

export const getCreateTestDefaultCategory = (): CreateTestQuestionCategory =>
  createTestQuestionCategoryOptions[0]?.id ?? "graded";

export const getCreateTestQuestionSubtype = (categoryId: CreateTestQuestionCategory, subtypeId: string) =>
  getCreateTestQuestionTabs(categoryId).find((tab) => tab.id === subtypeId) ?? null;

export const getCreateTestQuestionOptionRules = (categoryId: CreateTestQuestionCategory, subtypeId: string) =>
  getCreateTestQuestionSubtype(categoryId, subtypeId)?.optionRules ?? null;

export const getCreateTestQuestionAnswerMode = (categoryId: CreateTestQuestionCategory, subtypeId: string) =>
  getCreateTestQuestionSubtype(categoryId, subtypeId)?.answerMode ?? "none";

export const isCreateTestQuestionCreationSupported = (
  categoryId: CreateTestQuestionCategory,
  subtypeId: string,
) => Boolean(getCreateTestQuestionSubtype(categoryId, subtypeId)?.isSupported);

export const testAudienceOptions = [
  { label: "Anyone with the link", value: "anyone" },
  { label: "Group or class", value: "selected_class" },
  // { label: "Specific students", value: "specific_students" },
];
