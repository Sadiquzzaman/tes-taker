"use client";

import { useTranslations } from "next-intl";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import Field, { controlClasses, type FieldProps } from "./Field";
import { ChevronDownIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">,
    Pick<FieldProps, "label" | "hint" | "error" | "hideLabel"> {
  options: SelectOption[];
  /** Text of the empty first choice; pass `false` for no empty choice. */
  placeholder?: string | false;
  fieldClassName?: string;
}

/** A native drop-down (best on phones). For long lists the user should search, use Combobox. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, hideLabel, required, options, placeholder, className, fieldClassName, ...rest }, ref) => {
    const t = useTranslations("ui");

    return (
      <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={fieldClassName}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <select
              ref={ref}
              id={id}
              required={required}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={controlClasses(invalid, cn("h-10 appearance-none pr-9", className))}
              {...rest}
            >
              {placeholder !== false ? <option value="">{placeholder ?? t("selectPlaceholder")}</option> : null}
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          </div>
        )}
      </Field>
    );
  },
);
Select.displayName = "Select";

export default Select;
