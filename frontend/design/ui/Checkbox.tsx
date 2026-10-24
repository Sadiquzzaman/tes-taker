"use client";

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn, focusRing } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Shows a dash: some but not all items are chosen (e.g. "select all" in a table). */
  indeterminate?: boolean;
}

/** A checkbox with its label. Without a visible label, pass aria-label. */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, indeterminate = false, className, id, ...rest }, forwardedRef) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const innerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const input = (
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={inputId}
        type="checkbox"
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded-sm border-border accent-primary disabled:cursor-not-allowed",
          focusRing,
          className,
        )}
        {...rest}
      />
    );

    if (!label) {
      return input;
    }

    return (
      <div className="flex items-start gap-2">
        <span className="flex h-5 items-center">{input}</span>
        <span className="flex flex-col">
          <label htmlFor={inputId} className="cursor-pointer text-body-sm text-ink">
            {label}
          </label>
          {hint ? (
            <span id={`${inputId}-hint`} className="text-caption text-ink-muted">
              {hint}
            </span>
          ) : null}
        </span>
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";

export default Checkbox;
