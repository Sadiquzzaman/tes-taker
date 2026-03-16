import InputSearchSVG from "@/component/svg/InputSearch";

const NormalInput = ({
  value,
  onChange,
  placeholder = "Search",
  parentClassName = "",
  inputClassName = "",
  afterIcon = <InputSearchSVG />,
  beforeIcon = null,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  parentClassName?: string;
  inputClassName?: string;
  afterIcon?: React.ReactNode;
  beforeIcon?: React.ReactNode;
}) => {
  return (
    <div
      className={`w-full h-7 flex items-center gap-2 px-2 py-[6px] border border-[#C6CFCF] rounded-md ${parentClassName}`}
    >
      {beforeIcon}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`
              w-full
              bg-transparent
              text-[12px]
              leading-[16px]
              font-[500]
              text-[#232A25]
              placeholder:text-[#989eaf]
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

export default NormalInput;
