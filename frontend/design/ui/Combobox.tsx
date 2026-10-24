"use client";

import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Description,
  Field as HeadlessField,
  Label,
} from "@headlessui/react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { controlClasses } from "./Field";
import { CheckIcon, ChevronDownIcon } from "./icons";

export interface ComboboxOptionItem {
  value: string;
  label: string;
  /** Extra text that is searched and shown under the label (e.g. an email). */
  detail?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  label: ReactNode;
  options: ComboboxOptionItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A searchable single choice: type to filter, arrows to move, Enter to pick. */
const Combobox = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
  error,
  required,
  disabled,
  className,
}: ComboboxProps) => {
  const t = useTranslations("ui");
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter((option) =>
      `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(needle),
    );
  }, [options, query]);

  return (
    <HeadlessField disabled={disabled} className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-body-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger">
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> ({t("required")})</span>
          </span>
        ) : null}
      </Label>
      <HeadlessCombobox
        value={selected}
        by="value"
        onChange={(option: ComboboxOptionItem | null) => onChange(option?.value ?? null)}
        onClose={() => setQuery("")}
      >
        <div className="relative">
          <ComboboxInput
            aria-invalid={Boolean(error) || undefined}
            aria-required={required || undefined}
            placeholder={placeholder}
            displayValue={(option: ComboboxOptionItem | null) => option?.label ?? ""}
            onChange={(event) => setQuery(event.target.value)}
            className={controlClasses(Boolean(error), "h-10 pr-9")}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted">
            <ChevronDownIcon />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          className={cn(
            "z-50 mt-1 max-h-64 w-(--input-width) overflow-y-auto rounded-input border border-border bg-surface p-1 shadow-overlay",
            "empty:invisible",
          )}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-body-sm text-ink-muted">{t("noResults")}</div>
          ) : (
            filtered.map((option) => (
              <ComboboxOption
                key={option.value}
                value={option}
                disabled={option.disabled}
                className={cn(
                  "group flex cursor-pointer items-start gap-2 rounded-input px-3 py-2 text-body-sm text-ink",
                  "data-focus:bg-primary-soft data-disabled:cursor-not-allowed data-disabled:opacity-50",
                )}
              >
                <CheckIcon className="mt-0.5 invisible text-primary group-data-selected:visible" />
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {option.detail ? <span className="text-caption text-ink-muted">{option.detail}</span> : null}
                </span>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </HeadlessCombobox>
      {hint ? <Description className="text-caption text-ink-muted">{hint}</Description> : null}
      {error ? <Description className="text-caption text-danger">{error}</Description> : null}
    </HeadlessField>
  );
};

export default Combobox;
