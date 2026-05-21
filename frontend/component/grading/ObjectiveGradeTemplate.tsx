import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import IncorrectFilledIconSVG from "../svg/IncorrectFilledIconSVG";
import { resizeTextarea } from "@/utils/grading/resizeTextarea";

const ObjectiveGradeTemplate = ({
  answer,
  correctOptionId,
  explanation = "",
  maxMarks,
  number,
  onExplanationChange,
  options,
  question,
  score,
}: ObjectiveGradeTemplateProps) => {
  const optionList = options.map((option) => ({
    ...option,
    isRightAnswer: option.id === correctOptionId,
    isSelected: option.id === answer,
  }));

  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-[#E5E5E5] p-4">
      <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
        {number}. {question}
      </p>

      <div className="flex flex-col gap-2">
        {optionList.map((option) => {
          const isCorrect = option.isRightAnswer && option.isSelected;
          const isWrong = !option.isRightAnswer && option.isSelected;
          const colorCode = isCorrect ? "#49734F" : isWrong ? "#D24B44" : "#232A25";

          return (
            <div className="flex gap-2" key={option.id}>
              {(isCorrect || isWrong) && (
                <div
                  className="flex h-4 min-w-4 items-center justify-center rounded-full border"
                  style={{ borderColor: colorCode }}
                >
                  <div
                    className="flex h-3 w-3 items-center justify-center rounded-full"
                    style={{ backgroundColor: colorCode }}
                  />
                </div>
              )}
              {option.isRightAnswer && !isCorrect && !isWrong && <CorrectFilledIconSVG width={16} />}
              {!option.isRightAnswer && !isWrong && (
                <div className="flex h-4 min-w-4 items-center justify-center rounded-full border border-[#232A25]" />
              )}
              <p
                className="text-[16px] font-[400] leading-[16px] tracking-[-0.02em]"
                style={{ color: isWrong ? "#D24B44" : "#232A25" }}
              >
                {option.text}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="flex h-8 w-12 items-center justify-center rounded-[2px] bg-[#EFF0F3]">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">{score}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <p className="mr-1 text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Your answer</p>
          {correctOptionId === answer ? (
            <>
              <CorrectFilledIconSVG width={16} className="mt-[2px]" />
              <p className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#49734F]">Correct</p>
            </>
          ) : (
            <>
              <IncorrectFilledIconSVG width={16} className="mt-[2px]" />
              <p className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#D24B44]">Incorrect</p>
            </>
          )}
        </div>
      </div>

      {onExplanationChange && (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-[500] leading-[125%] tracking-[-0.02em] text-[#232A25]">Explanation</p>
          <textarea
            rows={1}
            value={explanation}
            onChange={(event) => {
              resizeTextarea(event.target);
              onExplanationChange(event.target.value);
            }}
            placeholder="Write explanation"
            className="min-h-10 w-full resize-none rounded-[8px] border border-[#E5E5E5] px-2 py-[10px] text-[14px] font-[400] leading-5 text-[#232A25] placeholder:text-[#747775] focus:outline-none"
            ref={resizeTextarea}
          />
        </div>
      )}
    </div>
  );
};

export default ObjectiveGradeTemplate;
