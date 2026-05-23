import InputSearchSVG from "@/component/svg/InputSearch";
import TagRemoveIconSVG from "@/component/svg/TagRemoveIconSVG";
import { RefObject } from "react";

const TagInput = ({
  value,
  onChange,
  tags,
  removeTag,
  addTag,
  placeholder = "Search",
  parentClassName = "",
  inputClassName = "",
  afterIcon = <InputSearchSVG />,
  beforeIcon = null,
  invalidTagIndices = [],
  onTagClick,
  inputRef,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tags: string[];
  addTag: () => void;
  removeTag: (index: number) => void;
  placeholder?: string;
  parentClassName?: string;
  inputClassName?: string;
  afterIcon?: React.ReactNode;
  beforeIcon?: React.ReactNode;
  invalidTagIndices?: number[];
  onTagClick?: (index: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === " " || e.key === ",") && value.trim() !== "") {
      e.preventDefault();
      addTag();
    }
  };
  return (
    <div
      className={`w-full min-h-[44px] flex flex-wrap items-center gap-2 px-2 py-[6px] border border-[#C6CFCF] rounded-md ${parentClassName}`}
    >
      {beforeIcon}
      {tags.map((tag, index) => (
        <div
          key={index}
          className={`flex items-center gap-1 text-[#232A25] text-[14px] px-4 py-[6px] rounded-[32px] ${
            invalidTagIndices.includes(index) ? "bg-[#FDECEC]" : "bg-[#EFF0F3]"
          }`}
        >
          <button
            type="button"
            onClick={() => onTagClick?.(index)}
            className={`text-left ${onTagClick ? "cursor-pointer" : "cursor-default"}`}
          >
            {tag}
          </button>
          <button type="button" onClick={() => removeTag(index)} className="text-xs leading-none">
            <TagRemoveIconSVG width={14} />
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="text"
        placeholder={tags.length === 0 ? placeholder : ""}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className={`
          flex-1
          min-w-[120px]
          bg-transparent
          text-[14px]
          placeholder:text-[#747775]
          leading-[16px]
          font-[500]
          text-[#232A25]
          placeholder:font-[400]
          align-middle
          focus:outline-none
          ${inputClassName}
        `}
      />
      {afterIcon}
    </div>
  );
};

export default TagInput;
