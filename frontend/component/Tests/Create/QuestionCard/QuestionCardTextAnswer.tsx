import { updateQuestionAnswerValue } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo } from "react";
import { QUESTION_BUILDER_GAPS } from "./shared";

function QuestionCardTextAnswer({
  answerValues,
  activateCard,
  placeholder,
  parentPassageId,
  questionId,
  showAlternativeAnswerInput,
  subjectId,
}: QuestionCardTextAnswerProps) {
  const dispatch = useAppDispatch();
  const primaryAnswerValue = answerValues[0] ?? "";
  const alternativeAnswerValue = answerValues[1] ?? "";
  const isAlternativeAnswerEnabled = Boolean(primaryAnswerValue.trim());

  return (
    <div className={`flex flex-col ${QUESTION_BUILDER_GAPS.textAnswerStack}`}>
      <div
        className={`box-border flex items-center justify-center ${QUESTION_BUILDER_GAPS.textAnswerInput} rounded-input border border-ink px-3 py-2.5`}
      >
        <input
          type="text"
          value={primaryAnswerValue}
          onChange={(event) =>
            dispatch(
              updateQuestionAnswerValue({
                subjectId,
                questionId,
                index: 0,
                value: event.target.value,
                parentPassageId,
              }),
            )
          }
          onFocus={activateCard}
          placeholder={placeholder}
          className="h-5 w-full bg-transparent text-body font-normal text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
      {showAlternativeAnswerInput ? (
        <div
          className={`box-border flex items-center justify-center ${QUESTION_BUILDER_GAPS.textAnswerInput} rounded-input px-3 py-2.5 ${
            isAlternativeAnswerEnabled
              ? "border border-ink"
              : "border border-dashed border-[#D6D7D4] bg-[#F7F7F5]"
          }`}
        >
          <input
            type="text"
            value={alternativeAnswerValue}
            onChange={(event) =>
              dispatch(
                updateQuestionAnswerValue({
                  subjectId,
                  questionId,
                  index: 1,
                  value: event.target.value,
                  parentPassageId,
                }),
              )
            }
            onFocus={activateCard}
            disabled={!isAlternativeAnswerEnabled}
            placeholder="Add alternative answer"
            className={`h-5 w-full bg-transparent text-body font-normal outline-none ${
              isAlternativeAnswerEnabled
                ? "text-ink placeholder:text-ink-muted"
                : "cursor-not-allowed text-[#B0B0AD] placeholder:text-[#B0B0AD]"
            }`}
          />
        </div>
      ) : null}
    </div>
  );
}

export default memo(QuestionCardTextAnswer);
