"use client";

import { useTranslations } from "next-intl";
import { useId, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn, focusRing } from "./cn";
import Field from "./Field";
import { CloseIcon } from "./icons";

export interface TagInputProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  tags: string[];
  /** Adds the typed value as a tag (Enter, comma or space also add it). */
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Tags shown in red as invalid; clicking one calls onTagClick (e.g. to edit it). */
  invalidIndices?: number[];
  onTagClick?: (index: number) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

/** Several values typed one by one (emails, phones, IDs), shown as removable chips. */
const TagInput = ({
  label,
  value,
  onChange,
  tags,
  onAdd,
  onRemove,
  invalidIndices = [],
  onTagClick,
  placeholder,
  hint,
  error,
  inputRef,
  className,
}: TagInputProps) => {
  const t = useTranslations("ui");
  const listId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === "," || event.key === " ") && value.trim() !== "") {
      event.preventDefault();
      onAdd();
    } else if (event.key === "Backspace" && value === "" && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div
          className={cn(
            "flex min-h-11 w-full flex-wrap items-center gap-2 rounded-input border bg-surface px-2 py-1.5",
            "focus-within:ring-2",
            invalid ? "border-danger focus-within:ring-danger" : "border-border focus-within:ring-primary",
          )}
        >
          {tags.length ? (
            <ul id={listId} className="contents">
              {tags.map((tag, index) => {
                const bad = invalidIndices.includes(index);
                return (
                  <li
                    key={`${tag}-${index}`}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-body-sm",
                      bad ? "bg-danger-soft text-danger" : "bg-canvas text-ink",
                    )}
                  >
                    {onTagClick ? (
                      <button type="button" onClick={() => onTagClick(index)} className={cn("truncate rounded-sm text-left", focusRing)}>
                        {tag}
                      </button>
                    ) : (
                      <span className="truncate">{tag}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      aria-label={t("removeTag", { label: tag })}
                      className={cn("inline-flex size-5 items-center justify-center rounded-full hover:bg-border", focusRing)}
                    >
                      <CloseIcon className="size-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={value}
            placeholder={tags.length === 0 ? placeholder : undefined}
            aria-describedby={[describedBy, tags.length ? listId : null].filter(Boolean).join(" ") || undefined}
            aria-invalid={invalid || undefined}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-w-32 flex-1 bg-transparent px-1 text-body text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
      )}
    </Field>
  );
};

export default TagInput;
