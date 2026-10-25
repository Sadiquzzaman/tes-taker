import InputSearchSVG from "@/component/svg/InputSearch";

const NormalInput = ({
  value,
  onChange,
  placeholder = "Search",
  parentClassName = "",
  inputClassName = "",
  afterIcon = <InputSearchSVG />,
  beforeIcon = null,
  afterText = null,
  type = "text",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  parentClassName?: string;
  inputClassName?: string;
  afterIcon?: React.ReactNode;
  beforeIcon?: React.ReactNode;
  afterText?: React.ReactNode;
  type?: string;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (type === "number" && !/^\d*$/.test(val)) return;

    onChange({
      ...e,
      target: {
        ...e.target,
        value: val,
      },
    });
  };

  return (
    <div
      className={`w-full h-7 flex items-center gap-2 px-2 py-[6px] border border-border rounded-md ${parentClassName}`}
    >
      {beforeIcon}

      <input
        type="text"
        inputMode={type === "number" ? "numeric" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={`
          w-full
          bg-transparent
          text-caption
         
          font-medium
          text-ink
          placeholder:text-ink-muted
          placeholder:font-normal
          align-middle
          focus:outline-none
          ${inputClassName}
        `}
      />

      {afterIcon}
      {afterText}
    </div>
  );
};

export default NormalInput;
