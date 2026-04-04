import InputSearchSVG from "@/component/svg/InputSearch";

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
          className="flex items-center gap-1 bg-[#EFF0F3] text-[#232A25] text-[14px] px-4 py-[6px] rounded-[32px]"
        >
          {tag}
          <button type="button" onClick={() => removeTag(index)} className="text-xs leading-none">
            <svg
              className="mt-[2px]"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.58325 7.00016C1.58325 8.43675 2.15393 9.8145 3.16976 10.8303C4.18558 11.8461 5.56333 12.4168 6.99992 12.4168C8.43651 12.4168 9.81426 11.8461 10.8301 10.8303C11.8459 9.8145 12.4166 8.43675 12.4166 7.00016C12.4166 5.56357 11.8459 4.18582 10.8301 3.17C9.81426 2.15418 8.43651 1.5835 6.99992 1.5835C5.56333 1.5835 4.18558 2.15418 3.16976 3.17C2.15393 4.18582 1.58325 5.56357 1.58325 7.00016Z"
                stroke="#747775"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8.625 5.375L5.375 8.625" stroke="#747775" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.375 5.375L8.625 8.625" stroke="#747775" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ))}
      <input
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
