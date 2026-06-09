import { useEffect, useRef } from "react";

const resizeTextarea = (element: HTMLTextAreaElement | null, rows: number, maxRows?: number) => {
  if (!element) {
    return;
  }

  const styles = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 16;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const minHeight = lineHeight * rows + paddingTop + paddingBottom;
  const maxHeight = maxRows ? lineHeight * maxRows + paddingTop + paddingBottom : null;

  element.style.height = "auto";

  const baseHeight = Math.max(element.scrollHeight, minHeight);
  const nextHeight = maxHeight ? Math.min(baseHeight, maxHeight) : baseHeight;

  element.style.height = `${nextHeight}px`;
  element.style.overflowY = maxHeight && element.scrollHeight > maxHeight ? "auto" : "hidden";
};

const NotmalTextFeild = ({
  value,
  onChange,
  placeholder = "",
  parentClassName = "",
  inputClassName = "",
  rows = 1,
  maxRows,
  disabled = false,
  onFocus,
  setTextareaRef,
}: NotmalTextFeildProps) => {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaRef = (element: HTMLTextAreaElement | null) => {
    internalTextareaRef.current = element;
    setTextareaRef?.(element);
  };

  useEffect(() => {
    resizeTextarea(internalTextareaRef.current, rows, maxRows);
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
        ref={handleTextareaRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        rows={rows}
        disabled={disabled}
        className={`w-full resize-none bg-transparent text-[12px] font-[500] leading-[16px] text-[#232A25] placeholder:font-[400] placeholder:text-[#989eaf] align-middle focus:outline-none ${inputClassName}`}
      />
    </div>
  );
};

export default NotmalTextFeild;
