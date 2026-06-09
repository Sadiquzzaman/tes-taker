import CopyIconSVG from "@/component/svg/CopyIconSVG";
import ShuffleIcon from "@/component/svg/ShuffleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import TriangleDownFilledIconSVG from "@/component/svg/TriangleDownFilledIconSVG";
import TriangleUpFilledIconSVG from "@/component/svg/TriangleUpFilledIconSVG";
import {
  deleteQuestion,
  duplicateQuestion,
  shuffleOptions,
  updateQuestionPoints,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID,
  isCreateTestObjectiveCategory,
} from "@/utils/createTestOptions";
import { memo, useCallback, type ReactNode } from "react";
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
  const isMatchingOrdering =
    isCreateTestObjectiveCategory(questionType) && questionSubType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;
  let pointsLabel: ReactNode = "Points";

  if (questionType === "ungraded" && questionSubType === CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID) {
    pointsLabel = "Max Points";
  }

  if (isMatchingOrdering) {
    pointsLabel = (
      <span>
        Points per <span className="font-[700] text-[#ED8600]">match</span>
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

  return (
    <div className={`flex items-center justify-between ${QUESTION_BUILDER_GAPS.footerOuter}`}>
      <div className={`flex items-center ${QUESTION_BUILDER_GAPS.footerGroup}`}>
        <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">{pointsLabel}</p>
        <div className="flex items-center justify-between border border-[#E5E5E5] bg-white">
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
            className="h-8 w-12 rounded-[2px] bg-white px-2 text-[14px] leading-4 tracking-[-0.02em] text-[#232A25] outline-none"
          />
          <div className="flex-col">
            <button
              onClick={() => updatePoints(points + 1)}
              className="flex h-4 w-4 items-center justify-center border-l border-b-[.5px] border-[#E5E5E5] text-[#747775]"
            >
              <TriangleUpFilledIconSVG width={7} />
            </button>
            <button
              onClick={() => updatePoints(points - 1)}
              className="flex h-4 w-4 items-center justify-center border-l border-t-[.5px] border-[#E5E5E5] text-[#747775]"
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
              className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#49734F] text-[#FFFFFF]"
              aria-label="Shuffle is mandatory for matching"
            >
              <ShuffleIcon />
            </button>
            <div className="pointer-events-none absolute bottom-[calc(100%+12px)] right-0 hidden w-[186px] rounded-[4px] bg-[#232A25] px-2 py-1 text-[12px] font-[400] leading-[14px] tracking-[-0.01em] text-white shadow-[0px_5px_2.5px_rgba(0,0,0,0.1)] group-hover:block">
              Shuffle can&apos;t be turned off and is mandatory for matching.
            </div>
          </div>
        ) : canShuffleOptions ? (
          <button
            type="button"
            onClick={() => dispatch(shuffleOptions({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
            aria-label="Shuffle options"
          >
            <ShuffleIcon />
          </button>
        ) : null}
        {showDuplicateButton ? (
          <button
            type="button"
            onClick={() => dispatch(duplicateQuestion({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
            aria-label="Duplicate question"
          >
            <CopyIconSVG />
          </button>
        ) : null}
        {showDeleteButton ? (
          <button
            type="button"
            onClick={() => dispatch(deleteQuestion({ subjectId, questionId, parentPassageId }))}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150 hover:bg-[#D24B44] hover:text-[#FFFFFF]"
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
