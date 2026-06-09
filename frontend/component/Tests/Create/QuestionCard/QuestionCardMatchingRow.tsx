import QuestionCardMatchingConnectorIconSVG from "@/component/svg/QuestionCardMatchingConnectorIconSVG";
import TrashIcon from "@/component/svg/TrashIcon";
import { memo, type ChangeEvent } from "react";
import { QUESTION_BUILDER_GAPS, resizeTextarea } from "./shared";

type QuestionCardMatchingRowProps = {
  activateCard: () => void;
  index: number;
  leftOption: QuestionOption;
  onLeftChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onRemove: () => void;
  onRightChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rightOption: QuestionOption;
  setLeftInputRef: (element: HTMLTextAreaElement | null) => void;
  setRightInputRef: (element: HTMLTextAreaElement | null) => void;
};

function QuestionCardMatchingRow({
  activateCard,
  index,
  leftOption,
  onLeftChange,
  onRemove,
  onRightChange,
  rightOption,
  setLeftInputRef,
  setRightInputRef,
}: QuestionCardMatchingRowProps) {
  return (
    <div
      className={`group flex items-center ${QUESTION_BUILDER_GAPS.matchingRow} rounded-[2px] px-0 py-1 hover:bg-[#ED86001A] focus-within:bg-[#ED86001A]`}
    >
      <div className={`flex min-w-0 flex-1 items-center ${QUESTION_BUILDER_GAPS.matchingSide}`}>
        <div
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white text-[14px] leading-4 ${
            leftOption.text.trim() ? "text-[#232A25]" : "text-[rgba(35,42,37,0.5)]"
          }`}
        >
          {index + 1}
        </div>
        <textarea
          ref={setLeftInputRef}
          value={leftOption.text}
          onChange={(event) => {
            resizeTextarea(event.currentTarget);
            onLeftChange(event);
          }}
          onFocus={activateCard}
          placeholder="Add a choice"
          rows={1}
          className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[#232A25] outline-none placeholder:text-[rgba(116,119,117,0.5)]"
        />
      </div>
      <div className="flex shrink-0 items-center justify-center">
        <QuestionCardMatchingConnectorIconSVG />
      </div>
      <div className={`flex min-w-0 flex-1 items-center ${QUESTION_BUILDER_GAPS.matchingSide}`}>
        <div
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white text-[14px] leading-4 ${
            rightOption.text.trim() ? "text-[#232A25]" : "text-[rgba(35,42,37,0.5)]"
          }`}
        >
          {index + 1}
        </div>
        <textarea
          ref={setRightInputRef}
          value={rightOption.text}
          onChange={(event) => {
            resizeTextarea(event.currentTarget);
            onRightChange(event);
          }}
          onFocus={activateCard}
          placeholder="Add a choice"
          rows={1}
          className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[#232A25] outline-none placeholder:text-[rgba(116,119,117,0.5)]"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#D24B44] opacity-0 transition-all duration-150 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Delete matching pair ${index + 1}`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

export default memo(QuestionCardMatchingRow);
