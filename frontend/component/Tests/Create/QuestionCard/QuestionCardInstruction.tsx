import NotmalTextFeild from "@/Ui/NotmalTextFeild";
import { updateQuestionInstruction } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo } from "react";

type QuestionCardInstructionProps = {
  instruction: string;
  questionId: string;
  subjectId: string;
};

function QuestionCardInstruction({ instruction, questionId, subjectId }: QuestionCardInstructionProps) {
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Instruction</p>
      <NotmalTextFeild
        rows={1}
        maxRows={4}
        value={instruction}
        onChange={(event) =>
          dispatch(
            updateQuestionInstruction({
              subjectId,
              questionId,
              instruction: event.target.value,
            }),
          )
        }
        placeholder="Add instruction (optional)"
        parentClassName="rounded-[8px] border-[#E5E5E5] bg-white px-3 py-2"
        inputClassName="text-[14px] font-[400] leading-[20px] text-[#232A25] placeholder:text-[#747775]"
      />
    </div>
  );
}

export default memo(QuestionCardInstruction);