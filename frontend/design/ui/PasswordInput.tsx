"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useState } from "react";
import { cn, focusRing } from "./cn";
import Field, { controlClasses } from "./Field";
import { EyeIcon, EyeOffIcon } from "./icons";
import type { InputProps } from "./Input";

export type PasswordInputProps = Omit<InputProps, "type" | "leadingIcon" | "trailing">;

/** A password field with a button that shows or hides what was typed. */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, error, hideLabel, required, className, fieldClassName, ...rest }, ref) => {
    const t = useTranslations("ui.password");
    const [visible, setVisible] = useState(false);
    return (
      <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={fieldClassName}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <input
              ref={ref}
              id={id}
              type={visible ? "text" : "password"}
              required={required}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={controlClasses(invalid, cn("h-10 pr-11", className))}
              {...rest}
            />
            <button
              type="button"
              aria-label={visible ? t("hide") : t("show")}
              aria-pressed={visible}
              aria-controls={id}
              onClick={() => setVisible((value) => !value)}
              className={cn("absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-input text-ink-muted hover:text-ink", focusRing)}
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        )}
      </Field>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
