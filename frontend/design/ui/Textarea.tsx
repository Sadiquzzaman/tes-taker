"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import Field, { controlClasses, type FieldProps } from "./Field";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    Pick<FieldProps, "label" | "hint" | "error" | "hideLabel"> {
  fieldClassName?: string;
}

/** Multi-line text with label, hint and error. Grows with `rows`; the user can resize it vertically. */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, hideLabel, required, rows = 4, className, fieldClassName, ...rest }, ref) => (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClasses(invalid, `resize-y py-2 ${className ?? ""}`)}
          {...rest}
        />
      )}
    </Field>
  ),
);
Textarea.displayName = "Textarea";

export default Textarea;
