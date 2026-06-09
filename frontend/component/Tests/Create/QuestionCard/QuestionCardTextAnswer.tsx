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
        className={`box-border flex items-center justify-center ${QUESTION_BUILDER_GAPS.textAnswerInput} rounded-[6px] border border-[#232A25] px-3 py-2.5`}
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
          className="h-5 w-full bg-transparent text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25] outline-none placeholder:text-[#747775]"
        />
      </div>
      {showAlternativeAnswerInput ? (
        <div
          className={`box-border flex items-center justify-center ${QUESTION_BUILDER_GAPS.textAnswerInput} rounded-[6px] px-3 py-2.5 ${
            isAlternativeAnswerEnabled
              ? "border border-[#232A25]"
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
            className={`h-5 w-full bg-transparent text-[16px] font-[400] leading-[125%] tracking-[-0.02em] outline-none ${
              isAlternativeAnswerEnabled
                ? "text-[#232A25] placeholder:text-[#747775]"
                : "cursor-not-allowed text-[#B0B0AD] placeholder:text-[#B0B0AD]"
            }`}
          />
        </div>
      ) : null}
    </div>
  );
}

export default memo(QuestionCardTextAnswer);
