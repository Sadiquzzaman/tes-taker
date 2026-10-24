import CopyIconSVG from "@/component/svg/CopyIconSVG";
import ShuffleIcon from "@/component/svg/ShuffleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import TriangleDownFilledIconSVG from "@/component/svg/TriangleDownFilledIconSVG";
import TriangleUpFilledIconSVG from "@/component/svg/TriangleUpFilledIconSVG";
import {
  changeQuestionSubtype,
  deleteQuestion,
  duplicateQuestion,
  moveQuestionToSubject,
  shuffleOptions,
  updateQuestionPoints,
} from "@/lib/features/createTestSlice";
import { previewQuestionSubtypeConversion } from "@/lib/features/create-test/changeQuestionSubtype";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import useGetAllSubject from "@/hooks/api/subject/useGetAllSubject";
import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID,
  createTestQuestionCategoryOptions,
  isCreateTestObjectiveCategory,
} from "@/utils/createTestOptions";
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { QUESTION_BUILDER_GAPS } from "./shared";

function QuestionCardFooter({
  canShuffleOptions,
  points,
  parentPassageId,
  questionId,
  questionSubType,
  questionType,
  showDeleteButton = true,
  showDuplicateButton = true,
  subjectId,
}: QuestionCardFooterProps) {
  const dispatch = useAppDispatch();
  const subjects = useAppSelector((state) => state.createTest.subjects);
  const isModelTest = useAppSelector((state) => state.createTest.formState.isModelTest);
  const subjectCatalog = useAppSelector((state) => state.subject.subjects);
  useGetAllSubject();

  const isMatchingOrdering =
    isCreateTestObjectiveCategory(questionType) && questionSubType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;
  const subtypeOptions =
    createTestQuestionCategoryOptions.find((category) => category.id === questionType)?.tabs.filter((tab) => tab.isSupported) ??
    [];
  let pointsLabel: ReactNode = "Points";
  const showSubjectPicker = isModelTest && !parentPassageId;

  const subjectOptions = useMemo(() => {
    const catalogSubjectOptions = subjectCatalog.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));
    const stateSubjectOptions = subjects.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));

    return [...catalogSubjectOptions, ...stateSubjectOptions].filter(
      (option, index, options) => options.findIndex((item) => item.id === option.id) === index,
    );
  }, [subjectCatalog, subjects]);

  const findQuestion = () => {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      return null;
    }
    if (parentPassageId) {
      const passage = subject.questions.find((item) => item.id === parentPassageId);
      if (passage && "childQuestions" in passage) {
        return passage.childQuestions.find((child) => child.id === questionId) ?? null;
      }
      return null;
    }
    return subject.questions.find((item) => item.id === questionId) ?? null;
  };

  if (questionType === "ungraded" && questionSubType === CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID) {
    pointsLabel = "Max Points";
  }

  if (isMatchingOrdering) {
    pointsLabel = (
      <span>
        Points per <span className="font-bold text-warning">match</span>
      </span>
    );
  }

  const updatePoints = useCallback(
    (nextPoints: number) => {
      dispatch(
        updateQuestionPoints({
          subjectId,
          questionId,
          points: nextPoints,
          parentPassageId,
        }),
      );
    },
    [dispatch, parentPassageId, questionId, subjectId],
  );

  const handleSubjectChange = useCallback(
    (nextSubjectId: string) => {
      if (!nextSubjectId || nextSubjectId === subjectId) {
        return;
      }
      const selected = subjectOptions.find((option) => option.id === nextSubjectId);
      if (!selected) {
        return;
      }
      dispatch(
        moveQuestionToSubject({
          sourceSubjectId: subjectId,
          targetSubject: selected,
          questionId,
        }),
      );
    },
    [dispatch, questionId, subjectId, subjectOptions],
  );

  return (
    <div className={`flex items-center justify-between ${QUESTION_BUILDER_GAPS.footerOuter}`}>
      <div className={`flex flex-wrap items-center ${QUESTION_BUILDER_GAPS.footerGroup}`}>
        <label className="flex items-center gap-2 text-body-sm text-ink">
          <span>Type</span>
          <select
            className="h-8 rounded-input border border-border bg-surface px-2 text-body-sm"
            value={questionSubType}
            onChange={(event) => {
              const nextSubType = event.target.value;
              if (nextSubType === questionSubType) {
                return;
              }
              const question = findQuestion();
              if (!question || !("text" in question)) {
                return;
              }
              const preview = previewQuestionSubtypeConversion(question as QuestionItem, nextSubType);
              if (preview.warningMessage && !window.confirm(preview.warningMessage)) {
                event.target.value = questionSubType;
                return;
              }
              dispatch(
                changeQuestionSubtype({
                  subjectId,
                  questionId,
                  parentPassageId,
                  nextSubType,
                }),
              );
            }}
          >
            {subtypeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {showSubjectPicker ? (
          <label className="flex items-center gap-2 text-body-sm text-ink">
            <span>Subject</span>
            <select
              className="h-8 max-w-[160px] rounded-input border border-border bg-surface px-2 text-body-sm"
              value={subjectId}
              onChange={(event) => handleSubjectChange(event.target.value)}
            >
              {subjectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="text-body-sm font-normal text-ink">{pointsLabel}</p>
        <div className="flex items-center justify-between border border-border bg-surface">
          <input
            type="text"
            inputMode="numeric"
            value={points || ""}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "+" || (event.shiftKey && event.key === "=")) {
                event.preventDefault();
                updatePoints(points + 1);
              } else if (
                (event.key === "ArrowDown" || event.key === "-" || (event.shiftKey && event.key === "_")) &&
                points > 0
              ) {
                event.preventDefault();
                updatePoints(points - 1);
              }
            }}
            onChange={(event) => {
              updatePoints(+event.target.value);
            }}
            className="h-8 w-12 rounded-sm bg-surface px-2 text-body-sm leading-4 text-ink outline-none"
          />
          <div className="flex-col">
            <button
              onClick={() => updatePoints(points + 1)}
              className="flex h-4 w-4 items-center justify-center border-l border-b-[.5px] border-border text-ink-muted"
            >
              <TriangleUpFilledIconSVG width={7} />
            </button>
            <button
              onClick={() => updatePoints(points - 1)}
              className="flex h-4 w-4 items-center justify-center border-l border-t-[.5px] border-border text-ink-muted"
            >
              <TriangleDownFilledIconSVG width={7} />
            </button>
          </div>
        </div>
      </div>

      <div className={`flex items-center ${QUESTION_BUILDER_GAPS.footerGroup}`}>
        {isMatchingOrdering ? (
          <div className="group relative">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-input bg-primary text-ink-inverse"
              aria-label="Shuffle is mandatory for matching"
            >
              <ShuffleIcon />
            </button>
            <div className="pointer-events-none absolute bottom-[calc(100%+12px)] right-0 hidden w-[186px] rounded-sm bg-ink px-2 py-1 text-caption font-normal text-ink-inverse shadow-[0px_5px_2.5px_rgba(0,0,0,0.1)] group-hover:block">
              Shuffle can&apos;t be turned off and is mandatory for matching.
            </div>
          </div>
        ) : canShuffleOptions ? (
          <button
            type="button"
            onClick={() => dispatch(shuffleOptions({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-input text-ink transition-colors duration-150 hover:bg-primary hover:text-ink-inverse"
            aria-label="Shuffle options"
          >
            <ShuffleIcon />
          </button>
        ) : null}
        {showDuplicateButton ? (
          <button
            type="button"
            onClick={() => dispatch(duplicateQuestion({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-input text-ink transition-colors duration-150 hover:bg-primary hover:text-ink-inverse"
            aria-label="Duplicate question"
          >
            <CopyIconSVG />
          </button>
        ) : null}
        {showDeleteButton ? (
          <button
            type="button"
            onClick={() => dispatch(deleteQuestion({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-input text-ink transition-colors duration-150 hover:bg-primary hover:text-ink-inverse"
            aria-label="Delete question"
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default memo(QuestionCardFooter);
