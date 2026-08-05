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
/** Legacy subtype kept for hydrating older exams only — not offered in the builder. */
export const CREATE_TEST_GRADED_ANSWER_BOX_SUBTYPE_ID = "answer-box";
export const CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID = "matching-ordering";
export const CREATE_TEST_PASSAGE_HYBRID_SUBTYPE_ID = "hybrid-question";
export const CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID = "essay";
export const CREATE_TEST_UNGRADED_FILL_IN_THE_GAPS_SUBTYPE_ID = "fill-in-the-gaps";

export const CREATE_TEST_VARIABLE_OPTION_MIN_COUNT = 3;
export const CREATE_TEST_VARIABLE_OPTION_MAX_COUNT = 5;

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

const createMatchingOrderingOptionRules = (): CreateTestQuestionOptionRules => ({
  canAddOptions: true,
  canEditOptionImage: false,
  canEditOptionText: true,
  canRemoveOptions: true,
  canShuffleOptions: false,
  fixedOptions: [],
  maxOptions: CREATE_TEST_VARIABLE_OPTION_MAX_COUNT,
  minOptions: 2,
  useFixedOptions: false,
});

const createTrueFalseOptionTemplates = (): CreateTestQuestionFixedOptionTemplate[] => [
  { image: null, text: "True" },
  { image: null, text: "False" },
  { image: null, text: "Not Given" },
];

const createYesNoNotGivenOptionTemplates = (): CreateTestQuestionFixedOptionTemplate[] => [
  { image: null, text: "Yes" },
  { image: null, text: "No" },
  { image: null, text: "Not Given" },
];

const createObjectiveQuestionTabs = (): CreateTestQuestionSubtypeOption[] => [
  {
    id: CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID,
    label: "Multiple Choice",
    isSupported: true,
    answerMode: "single",
    answerInputMode: "none",
    optionRules: createVariableOptionRules(),
    headerPayload: "Write your question here",
  },
  {
    id: CREATE_TEST_GRADED_MULTIPLE_RESPONSE_SUBTYPE_ID,
    label: "Multiple Response",
    isSupported: true,
    answerMode: "multiple",
    answerInputMode: "none",
    optionRules: createVariableOptionRules(),
    headerPayload: "Write your question here",
  },
  {
    id: CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID,
    label: "True / False",
    isSupported: true,
    answerMode: "single",
    answerInputMode: "none",
    optionRules: createFixedOptionRules(createTrueFalseOptionTemplates()),
    headerPayload: "Write your question here",
  },
  {
    id: CREATE_TEST_GRADED_FILL_IN_THE_BLANKS_SUBTYPE_ID,
    label: "Fill in the Blanks",
    isSupported: true,
    answerMode: "none",
    answerInputMode: "correct-answer",
    answerInputPlaceholder: "Enter expected answer",
    supportsAlternativeAnswers: true,
    optionRules: null,
    headerPayload: "Write your question here (Use ______ for blank spot)",
  },
  {
    id: CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
    label: "Matching/ Ordering",
    isSupported: true,
    answerMode: "none",
    answerInputMode: "none",
    optionRules: createMatchingOrderingOptionRules(),
    headerPayload: "Write your question here",
  },
];

export const createTestQuestionCategoryOptions: CreateTestQuestionCategoryOption[] = [
  {
    id: "graded",
    label: "Graded",
    tabs: createObjectiveQuestionTabs(),
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
        answerInputMode: "none",
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
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write your question here (Use ______ for blank spot)",
      },
    ],
  },
  {
    id: "passage-question",
    label: "Passage / CQ",
    tabs: [
      // {
      //   id: CREATE_TEST_PASSAGE_HYBRID_SUBTYPE_ID,
      //   label: "Hybrid Question",
      //   isSupported: false,
      //   answerMode: "none",
      //   answerInputMode: "none",
      //   optionRules: null,
      //   headerPayload: "Write your question here",
      // },
      ...createObjectiveQuestionTabs(),
      {
        id: CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID,
        label: "Essay",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write your question here (e.g. ক / খ / গ / ঘ)",
      },
    ],
  },
  {
    id: "ielts",
    label: "IELTS",
    tabs: [
      {
        id: CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID,
        label: "Multiple Choice",
        isSupported: true,
        answerMode: "single",
        answerInputMode: "none",
        optionRules: createVariableOptionRules(),
        headerPayload: "Write your question here",
      },
      {
        id: CREATE_TEST_GRADED_MULTIPLE_RESPONSE_SUBTYPE_ID,
        label: "Multiple Response",
        isSupported: true,
        answerMode: "multiple",
        answerInputMode: "none",
        optionRules: createVariableOptionRules(),
        headerPayload: "Write your question here",
      },
      {
        id: CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID,
        label: "True / False / Not Given",
        isSupported: true,
        answerMode: "single",
        answerInputMode: "none",
        optionRules: createFixedOptionRules(createTrueFalseOptionTemplates()),
        headerPayload: "Write your question here",
      },
      {
        id: "yes-no-not-given",
        label: "Yes / No / Not Given",
        isSupported: true,
        answerMode: "single",
        answerInputMode: "none",
        optionRules: createFixedOptionRules(createYesNoNotGivenOptionTemplates()),
        headerPayload: "Write your question here",
      },
      {
        id: CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
        label: "Matching / Ordering",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: createMatchingOrderingOptionRules(),
        headerPayload: "Write your question here",
      },
      {
        id: CREATE_TEST_GRADED_FILL_IN_THE_BLANKS_SUBTYPE_ID,
        label: "Fill in the Blanks",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write your question here (Use ______ for blank spot)",
      },
      {
        id: "sentence-completion",
        label: "Sentence Completion",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write your question here",
      },
      {
        id: "summary-completion",
        label: "Summary Completion",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write summary instruction here",
      },
      {
        id: "table-completion",
        label: "Table Completion",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write table instruction here",
      },
      {
        id: "diagram-label",
        label: "Diagram Label",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write diagram instruction here",
      },
      {
        id: "short-answer",
        label: "Short Answer",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "correct-answer",
        answerInputPlaceholder: "Enter expected answer",
        supportsAlternativeAnswers: true,
        optionRules: null,
        headerPayload: "Write your question here",
      },
      {
        id: "writing-task-1",
        label: "Writing Task 1",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write task 1 prompt here",
      },
      {
        id: "writing-task-2",
        label: "Writing Task 2",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write task 2 prompt here",
      },
      {
        id: "speaking-part-1",
        label: "Speaking Part 1",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write speaking part 1 prompt here",
      },
      {
        id: "speaking-part-2",
        label: "Speaking Part 2",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write speaking part 2 prompt here",
      },
      {
        id: "speaking-part-3",
        label: "Speaking Part 3",
        isSupported: true,
        answerMode: "none",
        answerInputMode: "none",
        optionRules: null,
        headerPayload: "Write speaking part 3 prompt here",
      },
    ],
  },
];

export const isCreateTestObjectiveCategory = (categoryId: CreateTestQuestionCategory) =>
  categoryId === "graded" || categoryId === "passage-question" || categoryId === "ielts";

/** Auto-scored subtypes under graded, Passage / CQ, or IELTS */
export const isCreateTestAutoScoredSubType = (subType: string) =>
  subType === CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID ||
  subType === CREATE_TEST_GRADED_MULTIPLE_RESPONSE_SUBTYPE_ID ||
  subType === CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID ||
  subType === "true-false-not-given" ||
  subType === CREATE_TEST_GRADED_FILL_IN_THE_BLANKS_SUBTYPE_ID ||
  subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID ||
  subType === "yes-no-not-given" ||
  subType === "sentence-completion" ||
  subType === "summary-completion" ||
  subType === "table-completion" ||
  subType === "diagram-label" ||
  subType === "short-answer" ||
  /* legacy exams */ subType === CREATE_TEST_GRADED_ANSWER_BOX_SUBTYPE_ID;

/** Essay (and similar) children under Passage / CQ or IELTS that need manual grading */
export const isCreateTestPassageManualSubType = (subType: string) =>
  subType === CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID;

/** IELTS writing and speaking subtypes that need manual grading */
export const isCreateTestIeltsManualSubType = (subType: string) =>
  subType === "writing-task-1" ||
  subType === "writing-task-2" ||
  subType === "speaking-part-1" ||
  subType === "speaking-part-2" ||
  subType === "speaking-part-3";

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
