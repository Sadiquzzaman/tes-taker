import { memo } from "react";
import { QUESTION_BUILDER_GAPS } from "./shared";

function QuestionCardValidation({ showValidation, validationErrors }: QuestionCardValidationProps) {
  if (!showValidation || validationErrors.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col ${QUESTION_BUILDER_GAPS.validation} rounded-input border border-danger/30 bg-danger-soft px-4 py-3`}
    >
      {validationErrors.map((error) => (
        <p key={error} className="text-body-sm font-normal text-danger">
          {error}
        </p>
      ))}
    </div>
  );
}

export default memo(QuestionCardValidation);
