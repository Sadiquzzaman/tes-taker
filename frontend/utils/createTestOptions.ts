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
export const CREATE_TEST_UNGRADED_FILL_IN_THE_GAPS_SUBTYPE_ID = "fill-in-the-gaps";

export const CREATE_TEST_VARIABLE_OPTION_MIN_COUNT = 3;
export const CREATE_TEST_VARIABLE_OPTION_MAX_COUNT = 5;

export type CreateTestQuestionAnswerMode = "single" | "multiple" | "none";
export type CreateTestQuestionAnswerInputMode = "none" | "correct-answer";

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
  answerInputMode: CreateTestQuestionAnswerInputMode;
  answerInputPlaceholder?: string;
  supportsAlternativeAnswers?: boolean;
  id: string;
  label: string;
  optionRules: CreateTestQuestionOptionRules | null;
  isSupported: boolean;
  headerPayload: string;
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
        answerInputMode: "none",
        optionRules: createVariableOptionRules(),
        headerPayload: "Write your question here",
      },
      {
        id: "multiple-response",
        label: "Multiple Response",
        isSupported: true,
        answerMode: "multiple",
        answerInputMode: "none",
        optionRules: createVariableOptionRules(),
        headerPayload: "Write your question here",
      },
      {
        id: "true-false",
        label: "True / False",
        isSupported: true,
        answerMode: "single",
        answerInputMode: "none",
        optionRules: createFixedOptionRules(createTrueFalseOptionTemplates()),
        headerPayload: "Write your question here",
      },
      {
        id: "fill-in-the-blanks",
        label: "Fill in the Blanks",
        isSupported: true,
        answerMode: "single",
        answerInputMode: "none",
        optionRules: createVariableOptionRules(),
        headerPayload: "Write your question here (Use ______ for blank spot)",
      },
      {
        id: "matching-ordering",
        label: "Matching /Ordering",
        isSupported: false,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write your question here",
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
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Write True or False",
        optionRules: null,
        headerPayload: "Write your question here",
      },
      {
        id: "essay",
        label: "Essay",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write your question here",
      },
      {
        id: CREATE_TEST_UNGRADED_FILL_IN_THE_GAPS_SUBTYPE_ID,
        label: "Fill in the Blanks",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter correct answer here",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write your question here (Use ______ for blank spot)",
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
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write your question here",
      },
    ],
  },
];

export const getCreateTestQuestionSubtype = (categoryId: CreateTestQuestionCategory, subtypeId: string) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return tab;
      }
    }
  }

  return null;
};

export const getCreateTestQuestionOptionRules = (categoryId: CreateTestQuestionCategory, subtypeId: string) => {
  const category: CreateTestQuestionCategoryOption | undefined = createTestQuestionCategoryOptions.find(
    (category) => category.id === categoryId,
  );

  if (!category) {
    return null;
  }

  const tab: CreateTestQuestionSubtypeOption | undefined = category.tabs.find((tab) => tab.id === subtypeId);

  if (!tab) {
    return null;
  }

  return tab.optionRules;
};

export const getCreateTestQuestionAnswerMode = (categoryId: CreateTestQuestionCategory, subtypeId: string) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return tab.answerMode;
      }
    }
  }

  return "none";
};

export const getCreateTestQuestionAnswerInputMode = (categoryId: CreateTestQuestionCategory, subtypeId: string) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return tab.answerInputMode;
      }
    }
  }

  return "none";
};

export const getCreateTestQuestionAnswerInputPlaceholder = (
  categoryId: CreateTestQuestionCategory,
  subtypeId: string,
) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return tab.answerInputPlaceholder ?? "Enter correct answer here";
      }
    }
  }

  return "Enter correct answer here";
};

export const getCreateTestQuestionSupportsAlternativeAnswers = (
  categoryId: CreateTestQuestionCategory,
  subtypeId: string,
) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return Boolean(tab.supportsAlternativeAnswers);
      }
    }
  }

  return false;
};

export const isCreateTestQuestionCreationSupported = (categoryId: CreateTestQuestionCategory, subtypeId: string) => {
  for (const category of createTestQuestionCategoryOptions) {
    if (category.id !== categoryId) {
      continue;
    }

    for (const tab of category.tabs) {
      if (tab.id === subtypeId) {
        return tab.isSupported;
      }
    }
  }

  return false;
};

export const testAudienceOptions = [
  { label: "Anyone with the link", value: "anyone" },
  { label: "Group or class", value: "selected_class" },
  // { label: "Specific students", value: "specific_students" },
];
