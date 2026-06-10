type NotmalTextFeildProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  parentClassName?: string;
  inputClassName?: string;
  rows?: number;
  maxRows?: number;
  disabled?: boolean;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  setTextareaRef?: (element: HTMLTextAreaElement | null) => void;
};
