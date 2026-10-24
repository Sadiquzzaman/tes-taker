"use client";

import { forwardRef } from "react";
import Input, { type InputProps } from "./Input";

export interface DatePickerProps extends Omit<InputProps, "type" | "value" | "onChange" | "min" | "max"> {
  /** "YYYY-MM-DD" or "" when empty. School days are dates in the organisation's time zone, not instants. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

/**
 * A date field using the browser's own picker (a full calendar on phones). The value is a plain
 * "YYYY-MM-DD" day, so it never shifts with time zones.
 */
const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(({ value, onChange, ...rest }, ref) => (
  <Input ref={ref} type="date" value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
));
DatePicker.displayName = "DatePicker";

export default DatePicker;
