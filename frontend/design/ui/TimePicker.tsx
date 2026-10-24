"use client";

import { forwardRef } from "react";
import Input, { type InputProps } from "./Input";

export interface TimePickerProps extends Omit<InputProps, "type" | "value" | "onChange" | "step"> {
  /** "HH:MM" (24-hour) or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes between choices in the picker (default 5). */
  stepMinutes?: number;
}

/** A time field using the browser's own picker. Combine with a DatePicker and convert to UTC on save. */
const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(({ value, onChange, stepMinutes = 5, ...rest }, ref) => (
  <Input
    ref={ref}
    type="time"
    value={value}
    step={stepMinutes * 60}
    onChange={(event) => onChange(event.target.value)}
    {...rest}
  />
));
TimePicker.displayName = "TimePicker";

export default TimePicker;
