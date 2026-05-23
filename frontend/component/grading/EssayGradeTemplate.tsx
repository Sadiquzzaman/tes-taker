import { resizeTextarea } from "@/utils/grading/resizeTextarea";

const EssayGradeTemplate = ({
  answer,
  explanation = "",
  maxMarks,
  number,
  onExplanationChange,
  question,
  score,
}: EssayGradeTemplateProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-[#E5E5E5] p-4">
      <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
        {number}. {question}
      </p>
      <p className="text-[16px] font-[400] leading-[120%] tracking-[-0.02em] text-[#747775]">{answer}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="flex h-8 w-12 items-center justify-center rounded-[2px] bg-[#EFF0F3]">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">{score}</p>
          </div>
        </div>
        <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
          Max marks: <span className="ml-1 font-[500]">{maxMarks}</span>
        </p>
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

export default EssayGradeTemplate;
