import { useEffect, useRef } from "react";

type NotmalTextFeildProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  parentClassName?: string;
  inputClassName?: string;
  rows?: number;
  maxRows?: number;
  disabled?: boolean;
};

const resizeTextarea = (element: HTMLTextAreaElement | null, rows: number, maxRows: number) => {
  if (!element) {
    return;
  }

  const styles = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 16;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const minHeight = lineHeight * rows + paddingTop + paddingBottom;
  const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;

  element.style.height = "auto";

  const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);

  element.style.height = `${nextHeight}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
};

const NotmalTextFeild = ({
  value,
  onChange,
  placeholder = "",
  parentClassName = "",
  inputClassName = "",
  rows = 1,
  maxRows = 4,
  disabled = false,
}: NotmalTextFeildProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextarea(textareaRef.current, rows, maxRows);
  }, [maxRows, rows, value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    resizeTextarea(event.currentTarget, rows, maxRows);
    onChange(event);
  };

  return (
    <div
      className={`flex w-full min-h-[36px] items-start rounded-md border border-[#C6CFCF] px-2 py-[6px] ${parentClassName}`}
    >
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        rows={rows}
        disabled={disabled}
        className={`w-full resize-none bg-transparent text-[12px] font-[500] leading-[16px] text-[#232A25] placeholder:font-[400] placeholder:text-[#989eaf] align-middle focus:outline-none ${inputClassName}`}
      />
    </div>
  );
};

export default NotmalTextFeild;
