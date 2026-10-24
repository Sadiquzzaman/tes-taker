"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import Field, { controlClasses, type FieldProps } from "./Field";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    Pick<FieldProps, "label" | "hint" | "error" | "hideLabel"> {
  /** An icon inside the field, on the left (e.g. a search glass). */
  leadingIcon?: ReactNode;
  fieldClassName?: string;
}

/** A one-line text field with label, hint and error. */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hideLabel, required, leadingIcon, className, fieldClassName, ...rest }, ref) => (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leadingIcon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={controlClasses(invalid, cn("h-10", leadingIcon ? "pl-9" : undefined, className))}
            {...rest}
          />
        </div>
      )}
    </Field>
  ),
);
Input.displayName = "Input";

export default Input;
