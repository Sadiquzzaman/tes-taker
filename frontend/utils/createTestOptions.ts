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
export const CREATE_TEST_GRADED_MULTIPLE_CHOICE_ALT_SUBTYPE_ID = "multiple-choice-alt";
export const CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID = "essay";

export type CreateTestQuestionSubtypeOption = {
  id: string;
  label: string;
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
      },
      {
        id: "multiple-response",
        label: "Multiple Response",
        isSupported: false,
      },
      {
        id: "true-false",
        label: "True / False",
        isSupported: false,
      },
      {
        id: "fill-in-the-blanks",
        label: "Fill in the Blanks",
        isSupported: false,
      },
      {
        id: "matching-ordering",
        label: "Matching /Ordering",
        isSupported: false,
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
      },
      {
        id: "essay",
        label: "Essay",
        isSupported: true,
      },
      {
        id: "fill-in-the-gaps",
        label: "Fill in the gaps",
        isSupported: false,
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

export const isCreateTestQuestionCreationSupported = (
  categoryId: CreateTestQuestionCategory,
  subtypeId: string,
) => Boolean(getCreateTestQuestionSubtype(categoryId, subtypeId)?.isSupported);

export const testAudienceOptions = [
  { label: "Anyone with the link", value: "anyone" },
  { label: "Group or class", value: "selected_class" },
  // { label: "Specific students", value: "specific_students" },
];
