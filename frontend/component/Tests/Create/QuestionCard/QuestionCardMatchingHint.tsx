import { memo } from "react";

function QuestionCardMatchingHint() {
  return (
    <p className="text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#D24B44]">
      Write the sentences in order (Left-Right), they will be shuffled automatically
    </p>
  );
}

export default memo(QuestionCardMatchingHint);
