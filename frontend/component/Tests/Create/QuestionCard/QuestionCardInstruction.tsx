import { RichTextEditor } from "@/component/RichTextEditor";
import { updateQuestionInstruction } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo } from "react";
import { QUESTION_BUILDER_GAPS } from "./shared";

function QuestionCardInstruction({
  instruction,
  parentPassageId,
  questionId,
  subjectId,
}: QuestionCardInstructionProps) {
  const dispatch = useAppDispatch();

  return (
    <div className={`flex flex-col ${QUESTION_BUILDER_GAPS.instruction}`}>
      <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Instruction</p>
      <RichTextEditor
        value={instruction}
        onChange={(html) =>
          dispatch(
            updateQuestionInstruction({
              subjectId,
              questionId,
              instruction: html,
              parentPassageId,
            }),
          )
        }
        placeholder="Add instruction (optional)"
        minHeightClassName="min-h-[40px]"
        allowImages={false}
        variant="lite"
        className="border-[#E5E5E5] bg-white"
        editorClassName="text-[14px]"
      />
    </div>
  );
}

export default memo(QuestionCardInstruction);
