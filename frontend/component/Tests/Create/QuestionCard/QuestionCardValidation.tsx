import { memo } from "react";
import { QUESTION_BUILDER_GAPS } from "./shared";

function QuestionCardValidation({ showValidation, validationErrors }: QuestionCardValidationProps) {
  if (!showValidation || validationErrors.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col ${QUESTION_BUILDER_GAPS.validation} rounded-[8px] border border-[#F3C7C4] bg-[#FFF4F3] px-4 py-3`}
    >
      {validationErrors.map((error) => (
        <p key={error} className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#D24B44]">
          {error}
        </p>
      ))}
    </div>
  );
}

export default memo(QuestionCardValidation);
