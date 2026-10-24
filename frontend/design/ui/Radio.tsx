"use client";

import { useId, type ReactNode } from "react";
import { cn, focusRing } from "./cn";

export interface RadioOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** The question, read as the group's name. */
  legend: ReactNode;
  name: string;
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: ReactNode;
  /** Lay the choices out in a row on wider screens. */
  inline?: boolean;
  className?: string;
}

/** One choice out of a few (up to ~6; use Select or Combobox for more). Arrow keys move between choices. */
const RadioGroup = ({ legend, name, options, value, onChange, error, inline = false, className }: RadioGroupProps) => {
  const id = useId();

  return (
    <fieldset
      className={cn("flex flex-col gap-2", className)}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1 text-body-sm font-medium text-ink">{legend}</legend>
      <div className={cn("flex flex-col gap-2", inline && "sm:flex-row sm:flex-wrap sm:gap-6")}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-2">
              <span className="flex h-5 items-center">
                <input
                  id={optionId}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  disabled={option.disabled}
                  onChange={() => onChange(option.value)}
                  className={cn("size-4 cursor-pointer accent-primary disabled:cursor-not-allowed", focusRing)}
                />
              </span>
              <span className="flex flex-col">
                <label htmlFor={optionId} className="cursor-pointer text-body-sm text-ink">
                  {option.label}
                </label>
                {option.hint ? <span className="text-caption text-ink-muted">{option.hint}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};

export default RadioGroup;
