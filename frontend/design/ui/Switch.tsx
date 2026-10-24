"use client";

import { Description, Field, Label, Switch as HeadlessSwitch } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** An on/off setting that takes effect at once (use a Checkbox inside forms that are saved with a button). */
const Switch = ({ label, checked, onChange, hint, disabled, className }: SwitchProps) => (
  <Field disabled={disabled} className={cn("flex items-start justify-between gap-4", className)}>
    <span className="flex flex-col">
      <Label className="text-body-sm font-medium text-ink data-disabled:opacity-50">{label}</Label>
      {hint ? <Description className="text-caption text-ink-muted">{hint}</Description> : null}
    </span>
    <HeadlessSwitch
      checked={checked}
      onChange={onChange}
      className={cn(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-border",
        "transition-colors duration-(--motion-fast) ease-fast data-checked:bg-primary",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "outline-none data-focus:ring-2 data-focus:ring-primary data-focus:ring-offset-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-5 translate-x-0.5 rounded-full bg-surface shadow-card",
          "transition-transform duration-(--motion-fast) ease-fast group-data-checked:translate-x-5.5",
        )}
      />
    </HeadlessSwitch>
  </Field>
);

export default Switch;
