import { memo } from "react";
import useQuestionTypeText from "../useQuestionTypeText";
import { QUESTION_BUILDER_GAPS } from "./shared";

/** What still needs fixing in a question, shown once the user tries to continue. */
function QuestionCardValidation({ showValidation, validationErrors }: QuestionCardValidationProps) {
  const text = useQuestionTypeText();

  if (!showValidation || validationErrors.length === 0) {
    return null;
  }

  return (
    <ul role="alert" className={`flex flex-col ${QUESTION_BUILDER_GAPS.validation} rounded-input border border-danger/30 bg-danger-soft px-4 py-3`}>
      {validationErrors.map((issue, index) => (
        <li key={`${issue.key}-${index}`} className="text-body-sm text-danger">
          {text.issue(issue)}
        </li>
      ))}
    </ul>
  );
}

export default memo(QuestionCardValidation);
