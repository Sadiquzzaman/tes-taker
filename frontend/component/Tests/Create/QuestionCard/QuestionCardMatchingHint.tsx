import { memo } from "react";

function QuestionCardMatchingHint() {
  return (
    <p className="text-body font-normal text-danger">
      Write the sentences in order (Left-Right), they will be shuffled automatically
    </p>
  );
}

export default memo(QuestionCardMatchingHint);
